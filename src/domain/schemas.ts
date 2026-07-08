import { z } from "zod";

export const languageCertificateSchema = z.object({
  language: z.string(),
  test: z.string().optional(),
  provider: z.string().optional(),
  level: z.string().optional(),
  date: z.string().optional(),
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
  languageCertificates: z.array(languageCertificateSchema).default([]),
  workExperience: z.string().default(""),
  targetCountry: z.string().optional(),
  targetCity: z.string().optional(),
  extracted: extractedProfileSchema.optional(),
  updatedAt: z.string(),
});

export const appSettingsSchema = z.object({
  providerId: z.enum(["custom", "gemini", "openai", "anthropic"]).default("custom"),
  providerName: z.string().default("OpenAI-compatible"),
  endpoint: z.string(),
  apiKey: z.string(),
  model: z.string(),
});
