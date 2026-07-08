// Lightweight keyword retrieval over a small set of in-memory text chunks.
// Used to ground "Ask about this program" answers in the program's own text.

export interface TextChunk {
  id: string;
  text: string;
  label?: string;
}

export interface ScoredChunk extends TextChunk {
  score: number;
  matchedTerms: string[];
}

const stopWords = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "for", "from", "how",
  "i", "in", "is", "it", "my", "of", "on", "or", "the", "to", "what", "with", "you", "your",
]);

export function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !stopWords.has(term));
}

export function chunkText(text: string, label: string, wordsPerChunk = 90, overlap = 15): TextChunk[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length === 0) return [];

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;
  while (start < words.length) {
    const end = Math.min(start + wordsPerChunk, words.length);
    chunks.push({ id: `${label}-${index}`, label, text: words.slice(start, end).join(" ") });
    index += 1;
    if (end >= words.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

export function retrieveChunks(query: string, chunks: TextChunk[], limit = 4): ScoredChunk[] {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  return chunks
    .map((chunk) => {
      const text = chunk.text.toLowerCase();
      const matchedTerms = Array.from(new Set(queryTerms.filter((term) => text.includes(term))));
      const density = matchedTerms.reduce((score, term) => {
        const matches = text.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"));
        return score + (matches?.length ?? 0);
      }, 0);
      return { ...chunk, score: matchedTerms.length * 2 + density * 0.4, matchedTerms };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
