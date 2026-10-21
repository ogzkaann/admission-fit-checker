import type { AppSettings, ExtractedProfile, LanguageCertificate } from "../domain/types";
import { extractedProfileSchema } from "../domain/schemas";
import { callOpenAICompatible } from "./client";
import { hasUsableAiSettings } from "./settings";

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

const DATE_RE =
  /(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}[.\/-]\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\b(?:19|20)\d{2}\b)/i;

// Looks for a date near a match, preferring one that follows the match (dates
// typically appear after the label/certificate they belong to).
function findDateNear(text: string, index: number, radius = 90): string | undefined {
  const forward = text.slice(index, index + radius).match(DATE_RE)?.[0];
  if (forward) return forward;
  return text.slice(Math.max(0, index - radius), index).match(DATE_RE)?.[0];
}

function extractTotalEcts(text: string): string | undefined {
  const explicit = firstMatch(text, [
    /^\s*total\s*ects\s*[:=]?\s*(\d{1,3}(?:[.,]\d+)?)\s*(?:ECTS)?\s*$/im,
    /^\s*total[:\s]+(\d{1,3}(?:[.,]\d+)?)\s*ects\s*$/im,
    /^\s*(?:gesamt|summe)\s*[:=]?\s*(\d{1,3}(?:[.,]\d+)?)\s*ects\s*$/im,
    /^\s*(\d{1,3}(?:[.,]\d+)?)\s*ects\s*(?:in total|total|gesamt)\s*$/im,
  ]);
  if (explicit) return explicit;

  return undefined; // Never convert CP/credits or mistake a module value for the total.
}

export function extractLanguageCertificates(text: string): LanguageCertificate[] {
  const certs: LanguageCertificate[] = [];
  const push = (cert: LanguageCertificate) => {
    if (!cert.language) return;
    // Keep distinct tests/scores separate even when their CEFR levels coincide.
    const existing = certs.find(
      (c) => c.language.toLowerCase() === cert.language.toLowerCase() && c.test === cert.test && c.provider === cert.provider && c.score === cert.score && (c.level ?? "") === (cert.level ?? ""),
    );
    if (existing) {
      existing.provider = existing.provider ?? cert.provider;
      existing.date = existing.date ?? cert.date;
      return;
    }
    certs.push(cert);
  };
  const cefrOf = (window: string) => window.match(/\b([abc][12])\b/i)?.[1]?.toUpperCase();

  const languages = [
    { name: "English", re: /english|englisch/i },
    { name: "German", re: /german|deutsch/i },
    { name: "French", re: /french|fran[cç]ais/i },
    { name: "Spanish", re: /spanish|espa[nñ]ol/i },
    { name: "Italian", re: /italian|italiano/i },
    { name: "Dutch", re: /dutch|nederlands/i },
  ];

  const providers = [
    { name: "IELTS", re: /ielts/i, language: "English" },
    { name: "TOEFL", re: /toefl/i, language: "English" },
    { name: "Cambridge", re: /cambridge|\bCAE\b|\bCPE\b|\bFCE\b/i, language: "English" },
    { name: "PTE", re: /\bPTE\b/i, language: "English" },
    { name: "Duolingo", re: /duolingo/i, language: "English" },
    { name: "TestDaF", re: /testdaf/i, language: "German" },
    { name: "DSH", re: /\bDSH(?:-[123])?\b/i, language: "German" },
    { name: "Goethe", re: /goethe/i, language: "German" },
    { name: "telc", re: /\btelc\b/i, language: "German" },
    { name: "DELF", re: /\bDELF\b/i, language: "French" },
    { name: "DALF", re: /\bDALF\b/i, language: "French" },
    { name: "DELE", re: /\bDELE\b/i, language: "Spanish" },
  ];

  for (const lang of languages) {
    const match = lang.re.exec(text);
    if (!match) continue;
    const window = text.slice(match.index).split(/\r?\n/)[0].slice(0, 100);
    const level = cefrOf(window);
    const provider = providers.find((p) => p.language === lang.name && p.re.test(window));
    if (level && !provider && languages.filter((other) => other.re.test(window)).length === 1) {
      push({ language: lang.name, level, date: findDateNear(window, 0) });
    }
  }

  for (const provider of providers) {
    for (const line of text.split(/\r?\n/)) {
      const match = provider.re.exec(line);
      if (!match) continue;
      const window = line.slice(Math.max(0, match.index - 20), match.index + 100);
      const test = line.slice(match.index).match(/^(?:IELTS (?:Academic|General Training)|TOEFL (?:iBT|PBT|ITP)|Goethe-Zertifikat [ABC][12])/i)?.[0];
      const ambiguous = languages.filter((language) => language.re.test(line)).length > 1 || providers.filter((item) => item.re.test(line)).length > 1;
      const rawScore = test && window.slice(window.toLowerCase().indexOf(test.toLowerCase()) + test.length).match(/^\s*(?:(?:overall|score|band)\s*[:=]?\s*)?(\d+(?:[.,]\d+)?)/i)?.[1];
      push({ language: provider.language, provider: provider.name, test,
        score: rawScore ? Number(rawScore.replace(',', '.')) : undefined,
        level: ambiguous ? undefined : cefrOf(window), date: findDateNear(line, match.index) });
    }
  }

  return certs;
}

export function heuristicExtractProfile(text: string): ExtractedProfile {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  // Line-bounded fields are matched against the raw text (newlines intact) so
  // negated character classes stop at the end of a line.
  const name = firstMatch(text, [/name\s*[:|-]\s*([^\n]+)/i, /full name\s*[:|-]\s*([^\n]+)/i]);
  const degree = firstMatch(text, [
    /\b(Bachelor|Master|B\.?Sc\.?|M\.?Sc\.?|B\.?A\.?|M\.?A\.?|B\.?Eng\.?|M\.?Eng\.?|Diplom(?:a)?|PhD|Doktor)[^,.\n]{0,80}/i,
  ]);
  const university = firstMatch(text, [
    /(?:University|Universität|Hochschule|Institute of Technology|Polytechnic|College)\s+(?:of\s+)?([A-ZÄÖÜ][^,.\n]{2,60})/,
    /([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.\- ]{2,50}(?:University|Universität|Hochschule|Institute of Technology))/,
  ]);
  const gpa = firstMatch(text, [
    /\b(?:CGPA|GPA|grade point average|final grade|overall grade|abschlussnote|gesamtnote|note)\s*[:=|-]?\s*([0-9](?:[.,][0-9]{1,2})?)/i,
    /\b([0-4][.,][0-9]{1,2})\s*\/\s*4(?:[.,]0)?\b/,
    /\b([1-6][.,][0-9])\s*\/\s*(?:1|6)[.,]0\b/,
  ]);
  const ects = extractTotalEcts(text);
  const graduationDate = (() => {
    const idx = text.search(/graduat|conferred|awarded|abschluss|degree awarded|date of award/i);
    if (idx === -1) return undefined;
    return findDateNear(text, idx, 60);
  })();
  const field = firstMatch(text, [
    /(?:field of study|study field|major|studiengang|programme|program)\s*[:|-]\s*([^,.\n]{2,80})/i,
    /\b(?:Bachelor|Master|B\.?Sc\.?|M\.?Sc\.?|B\.?A\.?|M\.?A\.?)\s+(?:of\s+Science\s+)?(?:in|of)\s+([^,.\n]{2,80})/i,
  ]);
  const courses = lines
    .filter((line) => /course|module|modul|lecture|seminar/i.test(line))
    .slice(0, 12)
    .map((line) => line.replace(/^(course|module|modul|lecture|seminar)\s*[:|-]\s*/i, "").trim())
    .filter(Boolean);
  const workExperience = lines
    .filter((line) => /\b(intern(ship)?|engineer|developer|analyst|assistant|manager|researcher|consultant|employee|werkstudent)\b/i.test(line))
    .slice(0, 8);

  return {
    name,
    degree,
    field,
    university,
    gpa,
    ects,
    graduationDate,
    courses: courses.length ? courses : undefined,
    academicCourses: lines.flatMap((line) => {
      const course = line.match(/^(?:course|module|modul)\s*[:|-]\s*(.+?)\s*\|\s*(\d+(?:[.,]\d+)?)\s*ECTS\s*$/i);
      return course ? [{ title: course[1].trim(), ects: Number(course[2].replace(',', '.')) }] : [];
    }),
    workExperience: workExperience.length ? workExperience : undefined,
    languageCertificates: extractLanguageCertificates(text),
  };
}

function parseJsonObject(content: string) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? content;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("No JSON object found in provider response.");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

// Merges AI-extracted fields over the local heuristic result so we never lose
// a value the heuristic found when the model omits it.
function mergeExtracted(base: ExtractedProfile, ai: ExtractedProfile): ExtractedProfile {
  return {
    ...base,
    ...Object.fromEntries(Object.entries(ai).filter(([, value]) => value !== undefined && value !== null)),
    languageCertificates:
      ai.languageCertificates?.length ? ai.languageCertificates : base.languageCertificates,
    courses: ai.courses?.length ? ai.courses : base.courses,
    academicCourses: ai.academicCourses?.length ? ai.academicCourses : base.academicCourses,
    workExperience: ai.workExperience?.length ? ai.workExperience : base.workExperience,
  };
}

export async function extractProfileFromDocumentText(text: string, settings: AppSettings) {
  const heuristic = heuristicExtractProfile(text);

  if (!hasUsableAiSettings(settings)) {
    return {
      profile: heuristic,
      method: "local-heuristic" as const,
      warning: undefined,
    };
  }

  try {
    const content = await callOpenAICompatible(settings, [
      {
        role: "system",
        content:
          "Extract structured academic profile fields from the document text. Return only JSON. Do not infer unsupported values; leave unknown fields out. Keys: name, degree, field, university, gpa, ects (total ECTS as a number string), graduationDate, courses (array), workExperience (array), languageCertificates (array of {language, provider, level, date}).",
      },
      { role: "user", content: text.slice(0, 24000) },
    ]);

    const ai = extractedProfileSchema.parse(parseJsonObject(content));
    return {
      profile: mergeExtracted(heuristic, ai),
      method: "byok-ai" as const,
      warning: undefined,
    };
  } catch (error) {
    return {
      profile: heuristic,
      method: "local-heuristic" as const,
      warning: `AI extraction failed, so local extraction was used. ${error instanceof Error ? error.message : ""}`,
    };
  }
}
