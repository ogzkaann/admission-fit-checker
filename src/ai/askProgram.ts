import type { AppSettings, EvidenceCitation, Program, ProgramAnswer } from "../domain/types";
import { callOpenAICompatible } from "./client";
import { hasUsableAiSettings } from "./settings";
import { chunkText, retrieveChunks, type TextChunk } from "../rag/retrieval";

// Builds the searchable text for a single program from its own fields only.
function programChunks(program: Program): TextChunk[] {
  const sections = [
    program.description,
    program.admissionText ?? "",
    ...program.requirements.map((req) => `${req.label}. ${req.sourceText ?? ""}`),
    program.deadline ? `Application deadline: ${program.deadline}.` : "",
    program.fee ? `Tuition/fee: ${program.fee}.` : "",
  ].filter(Boolean);

  return sections.flatMap((section, index) => chunkText(section, `${program.id}-s${index}`));
}

function toCitations(program: Program, chunks: TextChunk[]): EvidenceCitation[] {
  return chunks.map((chunk) => ({
    id: chunk.id,
    programId: program.id,
    label: `${program.programName} — ${program.university}`,
    snippet: chunk.text.length > 320 ? `${chunk.text.slice(0, 320)}…` : chunk.text,
    sourceUrl: program.sourceUrl,
    lastChecked: program.lastChecked,
  }));
}

function localAnswer(question: string, citations: EvidenceCitation[]): string {
  return [
    "Based only on this program's stated information:",
    "",
    ...citations.map((citation, index) => `[${index + 1}] ${citation.snippet}`),
    "",
    "Add an API key in Settings for a written summary. Always confirm details on the official program page.",
  ].join("\n");
}

export async function askAboutProgram(
  question: string,
  program: Program,
  settings: AppSettings,
): Promise<ProgramAnswer> {
  const chunks = programChunks(program);
  const retrieved = retrieveChunks(question, chunks, 4);

  if (retrieved.length === 0) {
    return {
      question,
      answer: "Not found in this program's information. Try rephrasing, or check the official source link.",
      citations: [],
      status: "not-found",
      createdAt: new Date().toISOString(),
    };
  }

  const citations = toCitations(program, retrieved);

  if (!hasUsableAiSettings(settings)) {
    return {
      question,
      answer: localAnswer(question, citations),
      citations,
      status: "answered",
      createdAt: new Date().toISOString(),
    };
  }

  const packet = retrieved.map((chunk, index) => `[${index + 1}] ${chunk.text}`).join("\n\n");

  try {
    const answer = await callOpenAICompatible(settings, [
      {
        role: "system",
        content:
          "You are an admission advisor assistant. Answer ONLY from the provided program information about a single university program. If the answer is not present, say 'Not found in this program's information.' Cite claims with [number]. Do not invent admission rules, deadlines, or fees.",
      },
      {
        role: "user",
        content: `Program: ${program.programName} at ${program.university}.\n\nQuestion: ${question}\n\nProgram information:\n${packet}\n\nAnswer concisely with citations.`,
      },
    ]);
    return { question, answer, citations, status: "answered", createdAt: new Date().toISOString() };
  } catch (error) {
    return {
      question,
      answer: localAnswer(question, citations),
      citations,
      warning: "AI provider unavailable. Showing the matching program text instead.",
      providerError: error instanceof Error ? error.message : "Unknown error",
      status: "answered",
      createdAt: new Date().toISOString(),
    };
  }
}
