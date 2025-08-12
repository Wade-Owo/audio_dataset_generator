import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { wordPool } from "./wordPool";

let availableWords: string[] = [];

const usedSentencesFile = path.resolve("./usedSentences.txt");
const usedCombosFile = path.resolve("./usedCombos.txt");

let usedSentences = new Set<string>();
let usedCombos = new Set<string>();

function shuffle(arr: string[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function resetPool() {
  availableWords = [...wordPool];
  shuffle(availableWords);
}

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

function generateSentence(minWords = 3, maxWords = 6): string {
  if (availableWords.length < maxWords) {
    resetPool();
  }
  const wordCount = Math.floor(Math.random() * (maxWords - minWords + 1)) + minWords;
  const words = availableWords.splice(0, wordCount);
  return words.join(" [pause] ");
}

function getWordCombo(sentence: string): string {
  const words = sentence.split(" [pause] ").map((w) => w.trim());
  words.sort();
  return words.join(",");
}

function generateUniqueSentenceWithCombo(minWords = 3, maxWords = 6, maxAttempts = 20): { sentence: string; combo: string } {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const sentence = generateSentence(minWords, maxWords);
    if (usedSentences.has(sentence)) {
      continue;
    }
    const combo = getWordCombo(sentence);
    if (!usedCombos.has(combo)) {
      return { sentence, combo };
    }
  }
  while (true) {
    const sentence = generateSentence(minWords, maxWords);
    if (!usedSentences.has(sentence)) {
      return { sentence, combo: getWordCombo(sentence) };
    }
  }
}

export async function POST(request: Request) {
  loadUsedData();
  resetPool();

  const { totalSentences } = await request.json();

  if (typeof totalSentences !== "number" || totalSentences < 1) {
    return NextResponse.json({ error: "Invalid totalSentences value" }, { status: 400 });
  }

  const newSentences: string[] = [];
  const newCombos: string[] = [];

  for (let i = 0; i < totalSentences; i++) {
    const { sentence, combo } = generateUniqueSentenceWithCombo();
    newSentences.push(sentence);
    newCombos.push(combo);
  }

  // **Do NOT save sentences or combos here!**
  // Save only after successful audio generation

  return NextResponse.json(newSentences);
}
