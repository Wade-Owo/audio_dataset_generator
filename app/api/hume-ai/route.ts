import { HumeClient } from "hume";
import fs from "fs";
import path from "path";
import JSZip from "jszip";

const usedSentencesFile = path.resolve("./usedSentences.txt");
const usedCombosFile = path.resolve("./usedCombos.txt");

let usedSentences = new Set<string>();
let usedCombos = new Set<string>();

function loadUsedData() {
  if (fs.existsSync(usedSentencesFile)) {
    const data = fs.readFileSync(usedSentencesFile, "utf-8");
    usedSentences = new Set(data.split("\n").filter(Boolean));
  }
  if (fs.existsSync(usedCombosFile)) {
    const data = fs.readFileSync(usedCombosFile, "utf-8");
    usedCombos = new Set(data.split("\n").filter(Boolean));
  }
}

function saveUsedData(newSentences: string[], newCombos: string[]) {
  if (newSentences.length > 0) {
    fs.appendFileSync(usedSentencesFile, newSentences.join("\n") + "\n", "utf-8");
    newSentences.forEach((s) => usedSentences.add(s));
  }
  if (newCombos.length > 0) {
    fs.appendFileSync(usedCombosFile, newCombos.join("\n") + "\n", "utf-8");
    newCombos.forEach((c) => usedCombos.add(c));
  }
}

function getWordCombo(sentence: string): string {
  const words = sentence.split(" [pause] ").map((w) => w.trim());
  words.sort();
  return words.join(",");
}

export async function POST(request: Request) {
  loadUsedData();

  const { request: { sentences, voiceActors, sentencesPerSpeaker, startingFileNumber = 1 } } = await request.json();

  const humeai = new HumeClient({ apiKey: process.env.HUMEAI_API_KEY });

  const zip = new JSZip();

  const batchSize = 20;
  const totalBatches = Math.ceil(sentences.length / batchSize);

  const successfulSentences: string[] = [];
  const successfulCombos: string[] = [];

  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

  async function generateAudioWithRetry(sentence: string, speaker: string, retries = 1) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const audioStream = await humeai.tts.synthesizeFileStreaming({
          utterances: [{
            text: sentence.trim(),
            voice: {
              name: speaker,
              provider: "HUME_AI"
            },
            description: `Read this sentence exactly once, clearly and slowly.`,
            speed: 0.3
          }],
          format: {
            type: "wav"
          }
        });

        const chunks = [];
        for await (const chunk of audioStream) {
          chunks.push(chunk);
        }
        return Buffer.concat(chunks);

      } catch (err) {
        console.error(`Audio generation attempt ${attempt + 1} failed for sentence "${sentence}":`, err);
        if (attempt === retries) throw err;
        await delay(500);
      }
    }
  }

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const start = batchIndex * batchSize;
    const end = Math.min(start + batchSize, sentences.length);
    const batchSentences = sentences.slice(start, end);

    console.log(`Starting batch ${batchIndex + 1}/${totalBatches} with ${batchSentences.length} sentences`);

    const batchResults = await Promise.allSettled(
      batchSentences.map(async (sentence, idx) => {
        const globalIndex = start + idx;
        const currentSpeaker = voiceActors[Math.floor(globalIndex / sentencesPerSpeaker) % voiceActors.length];

        try {
          const audioBuffer = await generateAudioWithRetry(sentence, currentSpeaker, 1);
          const fileName = `Audio${startingFileNumber + globalIndex}.wav`;

          const cleanedTranscriptLine = sentence.replace(/\[pause\]/g, " ").replace(/\s+/g, " ").trim();

          return { success: true, audioBuffer, fileName, cleanedTranscriptLine, sentenceCombo: getWordCombo(sentence) };
        } catch (err) {
          console.error(`Audio generation failed for sentence index ${globalIndex}:`, err);
          return { success: false };
        }
      })
    );

    let batchSuccessCount = 0;

    for (const result of batchResults) {
      if (result.status === "fulfilled" && result.value.success) {
        const { audioBuffer, fileName, cleanedTranscriptLine, sentenceCombo } = result.value;
        zip.file(fileName, audioBuffer);
        successfulSentences.push(cleanedTranscriptLine);
        successfulCombos.push(sentenceCombo);
        batchSuccessCount++;
      }
    }

    saveUsedData(successfulSentences, successfulCombos);

    const usedMemMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    console.log(`Batch ${batchIndex + 1} completed. Success: ${batchSuccessCount}/${batchSentences.length}`);
    console.log(`Total successful sentences so far: ${successfulSentences.length}`);
    console.log(`Memory usage: ${usedMemMB} MB`);

    if (batchIndex < totalBatches - 1) {
      console.log(`Waiting 15 seconds before next batch...`);
      await delay(15000);
    }
  }

  const transcriptContent = successfulSentences.join("\n");
  zip.file("transcript.txt", transcriptContent);

  const archive = await zip.generateAsync({ type: "arraybuffer" });

  console.log(`All batches completed. Total successful sentences: ${successfulSentences.length}`);

  return new Response(archive, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": "attachment; filename=Audios.zip"
    }
  });
}
