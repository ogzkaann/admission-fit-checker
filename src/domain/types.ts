// Core domain model for Admission Fit Checker.
// The product compares a locally-stored academic profile against university
// program requirements and produces a source-aware fit verdict.

export type DegreeType = "bachelor" | "master" | "phd" | "other";

export type DocumentKind = "cv" | "diploma" | "transcript" | "language-certificate" | "other";

export type FitVerdict = "strong_fit" | "possible_risky" | "not_recommended" | "not_enough_data";

export interface LanguageCertificate {
  language: string; // e.g. "English", "German"
  test?: string; // e.g. "IELTS", "TOEFL", "TestDaF"
  level?: string; // CEFR level where known, e.g. "B2", "C1"
}

// Structured fields an AI/heuristic extractor can read out of a document.
export interface ExtractedProfile {
  name?: string;
  degree?: string;
  field?: string;
  university?: string;
  gpa?: string;
  ects?: string;
  courses?: string[];
  workExperience?: string[];
  languageCertificates?: LanguageCertificate[];
}

// The saved, user-reviewed academic profile (single local record).
export interface AcademicProfile {
  id: "local-profile";
  name?: string;
  degree?: string;
  field?: string;
  university?: string;
  gpa?: string;
  ects?: string;
  courses: string[];
  languageCertificates: LanguageCertificate[];
  workExperience: string;
  targetCountry?: string;
  targetCity?: string;
  extracted?: ExtractedProfile;
  updatedAt: string;
}

export interface StoredDocument {
  id: string;
  kind: DocumentKind;
  fileName: string;
  text: string;
  pageCount?: number;
  extractedProfile?: ExtractedProfile;
  createdAt: string;
  status: "parsed" | "failed" | "manual";
  error?: string;
}

export type RequirementKind = "academic" | "language" | "ects" | "gpa" | "document" | "other";

// A single admission requirement. Optional comparator fields let the fit
// engine evaluate it; when they are absent the requirement is informational.
export interface ProgramRequirement {
  id: string;
  kind: RequirementKind;
  label: string;
  minEcts?: number;
  minGpa?: string; // shown for reference only, cross-scale comparison is not claimed
  degreeType?: DegreeType; // required prior degree
  field?: string; // required/expected field keyword
  language?: string; // language of a language requirement
  minLevel?: string; // CEFR level of a language requirement
  sourceText?: string; // evidence snippet backing the requirement
}

export interface Program {
  id: string;
  university: string;
  programName: string;
  degreeType: DegreeType;
  language: string; // language of instruction
  country: string;
  city: string;
  description: string;
  deadline?: string;
  fee?: string;
  sourceUrl?: string;
  lastChecked?: string;
  requiredDocuments: DocumentKind[];
  requirements: ProgramRequirement[];
  admissionText?: string; // raw pasted/extracted text used for "Ask about this program"
  origin: "demo" | "user";
  isDemo: boolean;
  createdAt: string;
}

export interface RequirementCheck {
  requirementId: string;
  label: string;
  kind: RequirementKind;
  status: "met" | "not_met" | "unknown";
  decisive: boolean;
  detail: string;
}

export interface EvidenceCitation {
  id: string;
  programId: string;
  label: string;
  snippet: string;
  sourceUrl?: string;
  lastChecked?: string;
}

export interface FitAnalysis {
  programId: string;
  verdict: FitVerdict;
  score: number; // rough 0..1 signal, decisive checks only
  summary: string;
  checks: RequirementCheck[];
  citations: EvidenceCitation[];
  missingProfileData: string[];
  needsVerification: boolean;
  createdAt: string;
}

export interface AppSettings {
  providerId: "custom" | "gemini" | "openai" | "anthropic";
  providerName: string;
  endpoint: string;
  apiKey: string;
  model: string;
}

export interface ProgramAnswer {
  question: string;
  answer: string;
  citations: EvidenceCitation[];
  warning?: string;
  providerError?: string;
  status: "answered" | "not-found" | "error";
  createdAt: string;
}
