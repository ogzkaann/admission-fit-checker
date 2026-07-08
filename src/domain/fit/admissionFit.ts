import type {
  AcademicProfile,
  EvidenceCitation,
  FitAnalysis,
  FitVerdict,
  Program,
  ProgramRequirement,
  RequirementCheck,
  StoredDocument,
} from "../types";
import { verdictDescriptions } from "../labels";
import { profileHasAcademicData } from "../profileStatus";

const CEFR_RANK: Record<string, number> = {
  none: 0,
  a1: 1,
  a2: 2,
  b1: 3,
  b2: 4,
  c1: 5,
  c2: 6,
};

function cefrRank(level?: string): number | undefined {
  if (!level) return undefined;
  const match = level.toLowerCase().match(/[abc][12]/);
  if (!match) return undefined;
  return CEFR_RANK[match[0]];
}

function parseNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const match = value.replace(",", ".").match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

function normalize(value?: string): string {
  return (value ?? "").toLowerCase();
}

function checkEcts(profile: AcademicProfile, req: ProgramRequirement, missing: string[]): RequirementCheck {
  const have = parseNumber(profile.ects);
  if (have === undefined) {
    missing.push("ECTS credits");
    return check(req, "unknown", true, `Program expects at least ${req.minEcts} ECTS. Your ECTS total is not on file.`);
  }
  return have >= (req.minEcts as number)
    ? check(req, "met", true, `You have ~${have} ECTS, meeting the ${req.minEcts}+ ECTS expectation.`)
    : check(req, "not_met", true, `You have ~${have} ECTS, below the ${req.minEcts} ECTS expectation.`);
}

function checkDegree(profile: AcademicProfile, req: ProgramRequirement, missing: string[]): RequirementCheck {
  const degreeText = normalize(profile.degree);
  if (!degreeText) {
    missing.push("Prior degree");
    return check(req, "unknown", true, `Program expects a ${req.degreeType} degree. No prior degree is on file.`);
  }
  return degreeText.includes(req.degreeType as string)
    ? check(req, "met", true, `Your degree matches the required ${req.degreeType} level.`)
    : check(req, "unknown", true, `Program expects a ${req.degreeType} degree. Verify your degree "${profile.degree}" qualifies.`);
}

function checkField(profile: AcademicProfile, req: ProgramRequirement, missing: string[]): RequirementCheck {
  const field = normalize(req.field);
  const haystack = [profile.field, ...(profile.courses ?? [])].map(normalize).join(" ");
  if (!haystack.trim()) {
    missing.push("Field of study");
    return check(req, "unknown", true, `Program expects a background in ${req.field}. Your field of study is not on file.`);
  }
  const terms = field.split(/[^a-z0-9]+/).filter((term) => term.length > 2);
  const matched = terms.some((term) => haystack.includes(term));
  return matched
    ? check(req, "met", true, `Your background appears related to ${req.field}.`)
    : check(req, "not_met", true, `Program expects a background in ${req.field}, which was not detected in your profile.`);
}

function checkLanguage(profile: AcademicProfile, req: ProgramRequirement, missing: string[]): RequirementCheck {
  const required = cefrRank(req.minLevel);
  const cert = profile.languageCertificates.find((item) => normalize(item.language) === normalize(req.language));
  if (!cert) {
    missing.push(`${req.language} certificate`);
    return check(req, "unknown", true, `Program requires ${req.language} at ${req.minLevel ?? "a stated level"}. No matching certificate is on file.`);
  }
  const have = cefrRank(cert.level);
  if (required === undefined || have === undefined) {
    return check(req, "unknown", true, `You listed ${req.language} (${cert.level ?? cert.test ?? "unspecified"}). Verify it meets ${req.minLevel ?? "the requirement"}.`);
  }
  return have >= required
    ? check(req, "met", true, `Your ${req.language} level (${cert.level}) meets the ${req.minLevel} requirement.`)
    : check(req, "not_met", true, `Your ${req.language} level (${cert.level}) is below the ${req.minLevel} requirement.`);
}

function checkDocument(documents: StoredDocument[], req: ProgramRequirement): RequirementCheck {
  const hasAny = documents.length > 0;
  return check(
    req,
    hasAny ? "unknown" : "unknown",
    false,
    hasAny
      ? `Application document: ${req.label}. Confirm you can provide it.`
      : `Application document: ${req.label}.`,
  );
}

function check(
  req: ProgramRequirement,
  status: RequirementCheck["status"],
  decisive: boolean,
  detail: string,
): RequirementCheck {
  return { requirementId: req.id, label: req.label, kind: req.kind, status, decisive, detail };
}

function evaluateRequirement(
  profile: AcademicProfile,
  documents: StoredDocument[],
  req: ProgramRequirement,
  missing: string[],
): RequirementCheck {
  if (req.minEcts !== undefined) return checkEcts(profile, req, missing);
  if (req.language && req.minLevel) return checkLanguage(profile, req, missing);
  if (req.degreeType) return checkDegree(profile, req, missing);
  if (req.field) return checkField(profile, req, missing);
  if (req.kind === "document") return checkDocument(documents, req);
  // Informational (e.g. GPA where cross-scale comparison isn't claimed).
  return check(req, "unknown", false, req.minGpa ? `${req.label} (GPA scales vary — verify manually).` : req.label);
}

function buildCitations(program: Program): EvidenceCitation[] {
  const fromRequirements = program.requirements
    .filter((req) => req.sourceText)
    .map((req) => ({
      id: `${program.id}-${req.id}`,
      programId: program.id,
      label: req.label,
      snippet: req.sourceText as string,
      sourceUrl: program.sourceUrl,
      lastChecked: program.lastChecked,
    }));

  if (fromRequirements.length > 0) return fromRequirements;

  return [
    {
      id: `${program.id}-overview`,
      programId: program.id,
      label: `${program.programName} — ${program.university}`,
      snippet: program.description || program.admissionText || "No source text on file for this program.",
      sourceUrl: program.sourceUrl,
      lastChecked: program.lastChecked,
    },
  ];
}

interface VerdictOutcome {
  verdict: FitVerdict;
  score: number;
  risks: string[];
}

// Language-aware aggregation over decisive checks. A profile that meets the
// academic requirements but is only missing a language certificate should be
// "possible but risky" (language unverified), never "not enough data".
function decideVerdict(decisive: RequirementCheck[]): VerdictOutcome {
  const total = decisive.length;
  if (total === 0) return { verdict: "not_enough_data", score: 0, risks: [] };

  const nonLang = decisive.filter((c) => c.kind !== "language");
  const lang = decisive.filter((c) => c.kind === "language");

  const met = decisive.filter((c) => c.status === "met").length;
  const notMet = decisive.filter((c) => c.status === "not_met").length;
  const score = met / total;

  const risks: string[] = [];
  const languageMissing = lang.some((c) => c.status === "unknown");
  const languageBelow = lang.some((c) => c.status === "not_met");
  if (languageMissing) risks.push("Language requirement is not yet verified.");
  if (languageBelow) risks.push("Your language level appears below the requirement.");

  // If we know nothing about the academic (non-language) requirements, we can't
  // judge fit yet.
  const nonLangKnown = nonLang.filter((c) => c.status !== "unknown").length;
  if (nonLang.length > 0 && nonLangKnown === 0) {
    return { verdict: "not_enough_data", score, risks };
  }

  if (notMet >= 2) return { verdict: "not_recommended", score, risks };

  if (notMet === 0) {
    const nonLangUnknown = nonLang.filter((c) => c.status === "unknown").length;
    if (languageMissing) return { verdict: "possible_risky", score, risks };
    if (nonLangUnknown === 0 && met >= Math.max(2, Math.ceil(total * 0.6))) {
      return { verdict: "strong_fit", score, risks };
    }
    return { verdict: "possible_risky", score, risks };
  }

  // Exactly one requirement not met.
  return { verdict: "possible_risky", score, risks };
}

function summarize(verdict: FitVerdict, program: Program, missing: string[], risks: string[]): string {
  const base = verdictDescriptions[verdict];
  if (verdict === "not_enough_data" && missing.length > 0) {
    return `${base} Add the following to your profile for a better check: ${Array.from(new Set(missing)).join(", ")}.`;
  }
  if (risks.length > 0) {
    return `${base} ${risks.join(" ")}`;
  }
  return `${base} Always verify against ${program.university}'s official page before applying.`;
}

export function analyzeFit(
  profile: AcademicProfile | undefined,
  documents: StoredDocument[],
  program: Program,
): FitAnalysis {
  const missing: string[] = [];

  const emptyProfile = !profile || !profileHasAcademicData(profile);

  const checks: RequirementCheck[] = emptyProfile
    ? []
    : program.requirements.map((req) => evaluateRequirement(profile as AcademicProfile, documents, req, missing));

  const decisive = checks.filter((c) => c.decisive);
  const outcome: VerdictOutcome = emptyProfile
    ? { verdict: "not_enough_data", score: 0, risks: [] }
    : decideVerdict(decisive);

  if (emptyProfile) {
    missing.push("Academic profile (degree, field, ECTS, language)");
  }

  return {
    programId: program.id,
    verdict: outcome.verdict,
    score: outcome.score,
    summary: summarize(outcome.verdict, program, missing, outcome.risks),
    checks,
    citations: buildCitations(program),
    risks: outcome.risks,
    missingProfileData: Array.from(new Set(missing)),
    needsVerification: program.origin === "demo" || decisive.some((c) => c.status === "unknown") || emptyProfile,
    createdAt: new Date().toISOString(),
  };
}
