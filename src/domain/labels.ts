import type { DegreeType, DocumentKind, FitVerdict, RequirementKind } from "./types";

export const verdictLabels: Record<FitVerdict, string> = {
  strong_fit: "Strong fit",
  possible_risky: "Possible but risky",
  not_recommended: "Not recommended",
  not_enough_data: "Not enough data",
};

export const verdictDescriptions: Record<FitVerdict, string> = {
  strong_fit: "Your profile matches the program's stated requirements well.",
  possible_risky: "You may qualify, but some requirements are weak or unclear.",
  not_recommended: "One or more core requirements do not appear to be met.",
  not_enough_data: "There isn't enough profile or program data to judge fit yet.",
};

export const degreeTypeLabels: Record<DegreeType, string> = {
  bachelor: "Bachelor's",
  master: "Master's",
  phd: "PhD",
  other: "Other",
};

export const documentKindLabels: Record<DocumentKind, string> = {
  cv: "CV / Résumé",
  diploma: "Diploma",
  transcript: "Transcript",
  "language-certificate": "Language certificate",
  other: "Other",
};

export const requirementKindLabels: Record<RequirementKind, string> = {
  academic: "Academic background",
  language: "Language",
  ects: "ECTS credits",
  gpa: "Grade / GPA",
  document: "Required document",
  other: "Other",
};
