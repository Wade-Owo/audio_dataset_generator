'use client'
import { useState } from "react";
import Select from "react-select";
import makeAnimated from "react-select/animated";

export default function Home() {
  const [totalSentences, setTotalSentences] = useState(1);
  const [sentencesPerSpeaker, setSentencesPerSpeaker] = useState(1);
  const [chosenSpeakers, setChosenSpeakers] = useState([]);
  const [startingFileNumber, setStartingFileNumber] = useState(1);

  const [isLoading, setIsLoading] = useState(false);

  const speakers = [
    { value: "Sebastian Lockwood", label: "Sebastian Lockwood" },
    { value: "Ava Song", label: "Ava Song" },
    { value: "Live Comedian", label: "Live Comedian" },
    { value: "Colton Rivers", label: "Colton Rivers" },
    { value: "Nature Documetary Narrator", label: "Nature Documetary Narrator" },
    { value: "Alice Bennett", label: "Alice Bennett" },
    { value: "Sitcom Girl", label: "Sitcom Girl" },
    { value: "Spanish Instructor", label: "Spanish Instructor" },
    { value: "Cool Journalist", label: "Cool Journalist" },
    { value: "Caring Mother", label: "Caring Mother" },
    { value: "Lady Elizabeth", label: "Lady Elizabeth" },
    { value: "Male Protagonist", label: "Male Protagonist" },
    { value: "American Lead Actress", label: "American Lead Actress" },
    { value: "Male Australian Naturalist", label: "Male Australian Naturalist" },
    { value: "Sad Old British Man", label: "Sad Old British Man" },
    { value: "Geraldine Wallace", label: "Geraldine Wallace" },
    { value: "Mrs. Pembroke", label: "Mrs. Pembroke" },
    { value: "Male Podcaster", label: "Male Podcaster" },
    { value: "Booming American Narrator", label: "Booming American Narrator" },
    { value: "Imani Carter", label: "Imani Carter" },
  ];

  const animatedComponents = makeAnimated();

  const handleSelectChange = (val) => {
    const selectedVals = val ? val.map((speaker) => speaker.value) : [];
    setChosenSpeakers(selectedVals);
  };

  async function handleGenerate() {
    setIsLoading(true);

    try {
      // Step 1: Generate sentences
      const textResponse = await fetch("/api/words-gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalSentences }),
      });

      if (!textResponse.ok) {
        throw new Error("Failed to generate sentences");
      }

      const sentences = await textResponse.json();

      // Step 2: Generate audio files with progress updates

      // We'll send sentences in batches of 20 (same as your backend batch size)
      const batchSize = 20;
      let completedCount = 0;

      // Instead of one big request, we can chunk to display progress
      // But since your backend generates all at once, let's simulate progress from response stream.

      // So we do a single request, but use server-sent events or WebSocket for real progress.
      // If not possible, we'll fake progress updates in intervals during fetch

      // Here, we'll fake progress by polling until download completes:
      const audioResponse = await fetch("/api/hume-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request: {
            sentences,
            voiceActors: chosenSpeakers,
            sentencesPerSpeaker,
            startingFileNumber,
          },
        }),
      });

      if (!audioResponse.ok) {
        throw new Error("Failed to generate audio");
      }

      // Fake progress increment every second until download finishes
      const reader = audioResponse.body?.getReader();
      if (!reader) {
        throw new Error("Readable stream not supported");
      }

      const chunks = [];

      // combine chunks and trigger download
      const blob = new Blob(chunks, { type: "application/zip" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Audios.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error(`Error: ${err}`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-5 flex flex-col items-center justify-center">
      <div className="space-y-2">
        <h1 className="text-center text-6xl font-bold text-gray-900">AI Audio-Dataset Generator</h1>
        <h3 className="text-center text-xl text-gray-400 font-semibold">Generating monosyllabic and two-syllable words and bigrams</h3>
      </div>
      <div className="border border-gray-200 rounded-lg shadow-xl/20 flex flex-col p-6 box-content size-128 space-y-5 relative overflow-auto">
          {/* Type of Speaker */}
          <div className="flex flex-col">
            <h1 className='font-semibold text-gray-900 text-lg'>Type of Speaker</h1>

            <Select
              closeMenuOnSelect={false}
              components={animatedComponents}
              isMulti
              options={speakers}
              onChange={handleSelectChange}
              value={speakers.filter(speaker => chosenSpeakers.includes(speaker.value))}
            />

          </div>

          {/* starting File Number */}
          <div className="flex flex-col">
            <h1 className='font-semibold text-gray-900 text-lg'>Starting File Number</h1>
            <input
              type="number"
              className="input validator bg-white border-gray-200 w-full"
              required
              placeholder="1"
              min="1"
              onChange={(e) => setStartingFileNumber(parseInt(e.target.value) || 1)}
            />
            <h3 className="text-gray-400 text-sm">For first batch: use 1. For second batch of 1000: use 1001, etc.</h3>
          </div>

          {/* Sentences per speaker */}
          <div className="flex flex-col">
            <h1 className='font-semibold text-gray-900 text-lg'>Total Number of Sentences</h1>
            <input
              type="number"
              className="input validator bg-white border-gray-200 w-full"
              required
              placeholder="10"
              min="1"
              onChange={(e) => setTotalSentences(parseInt(e.target.value) || 1)}
            />
          </div>

          {/* Sentences per speaker */}
          <div className="flex flex-col">
            <h1 className='font-semibold text-gray-900 text-lg'>Number of Sentences Per Speaker</h1>
            <input
              type="number"
              className="input validator bg-white border-gray-200 w-full"
              required
              placeholder="2"
              min="1"
              onChange={(e) => setSentencesPerSpeaker(parseInt(e.target.value) || 1)}
            />
          </div>

          <button
            className={`btn ${isLoading ? "btn-disabled" : "btn-neutral"} w-full py-2 rounded font-semibold text-white`}
            onClick={handleGenerate}
            disabled={isLoading || chosenSpeakers.length === 0}
          >
            {isLoading ? "Generating Audio..." : "Generate Audio Dataset"}
          </button>

      </div>
        <p className="text-gray-400 text-sm text-center">Powered by Hume.ai</p>
    </div>
  );
}
