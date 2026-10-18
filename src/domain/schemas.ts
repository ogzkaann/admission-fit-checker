import { z } from "zod";
import { degreeTypeSchema, profileEvidenceSchema, semesterSchema, sourceEvidenceSchema, timestampSchema } from "./eligibilitySchemas";

export { programSchema } from "./eligibilitySchemas";

export const languageCertificateSchema = z.object({
  language: z.string(),
  test: z.string().optional(),
  provider: z.string().optional(),
  level: z.string().optional(),
  date: z.string().optional(),
  score: z.number().finite().nonnegative().optional(),
  componentScores: z.record(z.number().finite().nonnegative()).optional(),
});

export const extractedProfileSchema = z.object({
  name: z.string().optional(),
  degree: z.string().optional(),
  field: z.string().optional(),
  university: z.string().optional(),
  gpa: z.string().optional(),
  ects: z.string().optional(),
  graduationDate: z.string().optional(),
  courses: z.array(z.string()).optional(),
  workExperience: z.array(z.string()).optional(),
  languageCertificates: z.array(languageCertificateSchema).optional(),
});

export const academicProfileSchema = z.object({
  id: z.literal("local-profile"),
  name: z.string().optional(),
  degree: z.string().optional(),
  field: z.string().optional(),
  university: z.string().optional(),
  gpa: z.string().optional(),
  ects: z.string().optional(),
  graduationDate: z.string().optional(),
  courses: z.array(z.string()).default([]),
  languageCertificates: z.array(languageCertificateSchema.extend({ evidence: profileEvidenceSchema.optional() })).default([]),
  workExperience: z.string().default(""),
  targetCountry: z.string().optional(),
  targetCity: z.string().optional(),
  extracted: extractedProfileSchema.optional(),
  updatedAt: z.string(),
  degreeType: degreeTypeSchema.optional(),
  degreeCompleted: z.boolean().optional(),
  evidence: z.object({ degree: profileEvidenceSchema.optional(), field: profileEvidenceSchema.optional(), ects: profileEvidenceSchema.optional() }).optional(),
  academicCourses: z.array(z.object({ id: z.string().min(1), title: z.string().min(1), ects: z.number().finite().nonnegative().optional(), evidence: profileEvidenceSchema.optional() })).optional(),
  courseEquivalences: z.array(z.object({
    courseId: z.string(), programId: z.string(), catalogVersion: z.string(), requirementId: z.string(),
    semester: semesterSchema, decision: z.enum(["accepted", "rejected", "pending"]), evidence: sourceEvidenceSchema.optional(),
  })).optional(),
  transcriptComplete: z.boolean().optional(),
  reviewedAt: timestampSchema.optional(),
});

export const appSettingsSchema = z.object({
  providerId: z.enum(["custom", "gemini", "openai", "anthropic"]).default("custom"),
  providerName: z.string().default("OpenAI-compatible"),
  endpoint: z.string(),
  apiKey: z.string(),
  model: z.string(),
});
