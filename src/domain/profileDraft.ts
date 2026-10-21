import type { AcademicProfile, ExtractedProfile } from "./types";

// Draft extraction is never a review, equivalence decision, or credential approval.
export function applyExtracted(profile: AcademicProfile, extracted: ExtractedProfile): AcademicProfile {
  return {
    ...profile,
    name: extracted.name ?? profile.name, degree: extracted.degree ?? profile.degree,
    field: extracted.field ?? profile.field, university: extracted.university ?? profile.university,
    gpa: extracted.gpa ?? profile.gpa, ects: extracted.ects ?? profile.ects,
    graduationDate: extracted.graduationDate ?? profile.graduationDate,
    courses: extracted.courses?.length ? extracted.courses : profile.courses,
    workExperience: extracted.workExperience?.length ? extracted.workExperience.join("\n") : profile.workExperience,
    languageCertificates: (extracted.languageCertificates?.length ? extracted.languageCertificates : profile.languageCertificates).map(({ evidence: _evidence, ...certificate }) => certificate),
    extracted, evidence: undefined, degreeType: undefined, degreeCompleted: undefined, reviewedAt: undefined,
    metrics: undefined, educationLanguage: undefined, admissionAssessments: [], courseEquivalences: [], transcriptComplete: false,
    academicCourses: extracted.academicCourses?.length ? extracted.academicCourses.map((course, index) => ({ ...course, id: `draft-course-${index}` })) : profile.academicCourses?.map(({ evidence: _evidence, ...course }) => course),
  };
}
