// Core domain model for Admission Fit Checker.
// The product compares a locally-stored academic profile against university
// program requirements and produces a source-aware fit verdict.

export type DegreeType = "bachelor" | "master" | "phd" | "other";

export type DocumentKind = "cv" | "diploma" | "transcript" | "language-certificate" | "other";

export type FitVerdict = "strong_fit" | "possible_risky" | "not_recommended" | "not_enough_data";

export interface LanguageCertificate {
  language: string; // e.g. "English", "German"
  test?: string; // e.g. "IELTS", "TOEFL", "TestDaF" (kept for backward compatibility)
  provider?: string; // issuing body, e.g. "telc", "IELTS", "TOEFL", "Goethe"
  level?: string; // CEFR level where known, e.g. "B2", "C1"
  date?: string; // certificate/test date where known
  score?: number;
  componentScores?: Record<string, number>;
  evidence?: ProfileEvidence;
}

// User review confirms transcription, never document authenticity.
export interface ProfileEvidence {
  documentId: string;
  quote: string;
  reviewedAt: string;
}

export type AdmissionSemester = `${number}-${"winter" | "summer"}`;
export type SourceVerificationStatus = "unverified" | "verified" | "stale" | "conflicting" | "demo";

export interface SourceEvidence {
  url: string;
  quote: string;
  status: SourceVerificationStatus;
  sourceType: "official" | "user" | "demo";
  lastChecked?: string;
  validFor?: AdmissionSemester[];
  locator?: string; // regulation section or PDF page
  reviewedBy?: string;
  retrievedAt?: string;
  snapshotId?: string;
  contentHash?: string;
}

export interface CatalogFact {
  id: string;
  category: "academic" | "credits" | "language" | "deadline" | "tuition" | "application" | "semester";
  value: string | null;
  note?: string;
  evidence: SourceEvidence[];
}

export interface AcademicCourse {
  id: string;
  title: string;
  ects?: number;
  evidence?: ProfileEvidence;
}

// Equivalence is program/version/semester specific, never inferred from names.
export interface CourseEquivalence {
  courseId: string;
  programId: string;
  catalogVersion: string;
  requirementId: string;
  semester: AdmissionSemester;
  decision: "accepted" | "rejected" | "pending";
  evidence?: SourceEvidence;
}

export interface LanguageOption {
  test?: string; // exact certificate variant, e.g. IELTS Academic, not provider
  minLevel?: string;
  minScore?: number;
  componentMinimums?: Record<string, number>;
}

export type EligibilityRule =
  | { type: "all" | "any"; rules: EligibilityRule[] }
  | { type: "metric"; metric: "degree_years" | "german_grade" | "cohort_top_percent"; minimum?: number; maximum?: number }
  | { type: "education_language"; accepted: string[] }
  | { type: "assessment"; key: string; explanation: string }
  | { type: "degree"; accepted: DegreeType[]; completionRequired: boolean }
  | { type: "field"; accepted: string[]; exhaustive: boolean }
  | { type: "total_ects"; minimum: number }
  | { type: "subject_ects"; subject: string; minimum: number }
  | { type: "language"; language: string; accepted: LanguageOption[] }
  | { type: "document"; documentKind: DocumentKind }
  | { type: "manual"; explanation: string };

// Structured fields an AI/heuristic extractor can read out of a document.
export interface ExtractedProfile {
  academicCourses?: { title: string; ects: number }[];
  name?: string;
  degree?: string;
  field?: string;
  university?: string;
  gpa?: string;
  ects?: string;
  graduationDate?: string;
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
  graduationDate?: string;
  courses: string[];
  languageCertificates: LanguageCertificate[];
  workExperience: string;
  targetCountry?: string;
  targetCity?: string;
  extracted?: ExtractedProfile;
  updatedAt: string;
  degreeType?: DegreeType;
  degreeCompleted?: boolean;
  evidence?: Partial<Record<"degree" | "field" | "ects", ProfileEvidence>>;
  academicCourses?: AcademicCourse[];
  courseEquivalences?: CourseEquivalence[];
  transcriptComplete?: boolean;
  reviewedAt?: string;
  metrics?: Partial<Record<"degree_years" | "german_grade" | "cohort_top_percent", { value: number; evidence?: ProfileEvidence }>>;
  educationLanguage?: { language: string; evidence?: ProfileEvidence };
  // University judgments cannot be replaced by applicant self-assessment.
  admissionAssessments?: {
    programId: string; catalogVersion: string; requirementId: string; assessmentKey: string; semester: AdmissionSemester;
    decision: "accepted" | "rejected" | "pending"; validUntil?: string; evidence: SourceEvidence; profileEvidence: ProfileEvidence;
  }[];
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
  mandatory?: boolean; // legacy omissions default to mandatory
  rule?: EligibilityRule;
  evidence?: SourceEvidence[];
  conditionalAdmission?: {
    description: string;
    alternative: EligibilityRule;
    evidence: SourceEvidence[];
  };
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
  origin: "demo" | "user" | "catalog";
  isDemo: boolean;
  createdAt: string;
  schemaVersion?: 2;
  catalogVersion?: string;
  catalogDraftVersion?: string;
  verificationStatus?: SourceVerificationStatus;
  sources?: SourceEvidence[];
  validFor?: AdmissionSemester[];
  requirementsComplete?: boolean;
  facts?: CatalogFact[];
  catalogIssues?: string[];
  retrievedAt?: string;
}

export interface RequirementCheck {
  requirementId: string;
  label: string;
  kind: RequirementKind;
  status: "met" | "not_met" | "unknown" | "conditional";
  decisive: boolean;
  detail: string;
  mandatory: boolean;
  hardBlocker: boolean;
  comparison: "met" | "not_met" | "unknown";
  reason: "confirmed" | "missing_evidence" | "potential_mismatch" | "unsupported_equivalence" | "source_uncertainty" | "unsupported_rule" | "conditional";
  sourceIssues: string[];
  profileEvidence: ProfileEvidence[];
}

export interface EvidenceCitation {
  id: string;
  programId: string;
  label: string;
  snippet: string;
  sourceUrl?: string;
  lastChecked?: string;
  verificationStatus?: SourceVerificationStatus;
  locator?: string;
}

export interface FitAnalysis {
  programId: string;
  verdict: FitVerdict;
  score: number; // deprecated: confirmed rule coverage only, NOT admission probability
  summary: string;
  checks: RequirementCheck[];
  citations: EvidenceCitation[];
  risks: string[];
  missingProfileData: string[];
  needsVerification: boolean;
  createdAt: string;
  engineVersion: 2;
  semester?: AdmissionSemester;
  sourceIssues: string[];
  illustrative: boolean;
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
