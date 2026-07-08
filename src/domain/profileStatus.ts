import type { AcademicProfile, ExtractedProfile, StoredDocument } from "./types";

export type Completeness = "complete" | "partial" | "missing";

export interface ProfileCompleteness {
  academic: Completeness;
  ects: Completeness;
  language: Completeness;
  workExperience: Completeness; // optional field, "complete" or "missing"
}

function hasText(value?: string): boolean {
  return Boolean(value && value.trim());
}

// True when the profile carries enough academic signal to attempt a fit check.
export function profileHasAcademicData(profile?: AcademicProfile): boolean {
  if (!profile) return false;
  return (
    hasText(profile.degree) ||
    hasText(profile.field) ||
    hasText(profile.ects) ||
    hasText(profile.gpa) ||
    profile.courses.length > 0 ||
    profile.languageCertificates.length > 0
  );
}

function extractedHasData(extracted?: ExtractedProfile): boolean {
  if (!extracted) return false;
  return Boolean(
    extracted.degree ||
      extracted.field ||
      extracted.university ||
      extracted.gpa ||
      extracted.ects ||
      extracted.courses?.length ||
      extracted.languageCertificates?.length,
  );
}

// True when uploaded documents produced extractable fields (used to prompt the
// user to review + save before running a fit analysis).
export function documentsHaveExtraction(documents: StoredDocument[]): boolean {
  return documents.some((document) => extractedHasData(document.extractedProfile));
}

export function getProfileCompleteness(profile?: AcademicProfile): ProfileCompleteness {
  if (!profile) {
    return { academic: "missing", ects: "missing", language: "missing", workExperience: "missing" };
  }

  const academicFields = [profile.degree, profile.field, profile.university, profile.gpa].filter(hasText).length;
  const academic: Completeness =
    hasText(profile.degree) && hasText(profile.field)
      ? "complete"
      : academicFields > 0 || profile.courses.length > 0
        ? "partial"
        : "missing";

  const language: Completeness = profile.languageCertificates.some((cert) => cert.language && cert.level)
    ? "complete"
    : profile.languageCertificates.length > 0
      ? "partial"
      : "missing";

  return {
    academic,
    ects: hasText(profile.ects) ? "complete" : "missing",
    language,
    workExperience: hasText(profile.workExperience) ? "complete" : "missing",
  };
}
