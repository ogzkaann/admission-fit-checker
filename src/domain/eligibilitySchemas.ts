import { z } from "zod";

export const degreeTypeSchema = z.enum(["bachelor", "master", "phd", "other"]);
export const documentKindSchema = z.enum(["cv", "diploma", "transcript", "language-certificate", "other"]);
export const semesterSchema = z.string().regex(/^\d{4}-(winter|summer)$/);
export const timestampSchema = z.string().refine((value) => /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value) && Number.isFinite(Date.parse(value)), "Invalid date");
export const verificationStatusSchema = z.enum(["unverified", "verified", "stale", "conflicting", "demo"]);
export const sourceEvidenceSchema = z.object({
  url: z.string().url().refine((url) => /^https?:\/\//i.test(url), "HTTP(S) source required"),
  quote: z.string().trim().min(1),
  status: verificationStatusSchema,
  sourceType: z.enum(["official", "user", "demo"]),
  lastChecked: timestampSchema.optional(),
  validFor: z.array(semesterSchema).optional(),
  locator: z.string().optional(),
  reviewedBy: z.string().optional(),
  retrievedAt: timestampSchema.optional(),
  snapshotId: z.string().optional(),
  contentHash: z.string().optional(),
});
export const profileEvidenceSchema = z.object({
  documentId: z.string().min(1),
  quote: z.string().trim().min(1),
  reviewedAt: timestampSchema,
});
const credits = z.number().finite().nonnegative();
const level = z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]);
export const eligibilityRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("degree"), accepted: z.array(degreeTypeSchema).min(1), completionRequired: z.boolean() }).strict(),
  z.object({ type: z.literal("field"), accepted: z.array(z.string().trim().min(1)).min(1), exhaustive: z.boolean() }).strict(),
  z.object({ type: z.literal("total_ects"), minimum: credits }).strict(),
  z.object({ type: z.literal("subject_ects"), subject: z.string().trim().min(1), minimum: credits }).strict(),
  z.object({ type: z.literal("language"), language: z.string().trim().min(1), accepted: z.array(z.object({
    test: z.string().trim().min(1).optional(), minLevel: level.optional(), minScore: credits.optional(),
    componentMinimums: z.record(credits).optional(),
  }).strict().refine((option) => Boolean(option.test || option.minLevel), "Specify a test or CEFR level")
    .refine((option) => (option.minScore === undefined && !option.componentMinimums) || Boolean(option.test), "Scores require a specific test")).min(1) }).strict(),
  z.object({ type: z.literal("document"), documentKind: documentKindSchema }).strict(),
  z.object({ type: z.literal("manual"), explanation: z.string().min(1) }).strict(),
]);

export const programRequirementSchema = z.object({
  id: z.string().min(1), kind: z.enum(["academic", "language", "ects", "gpa", "document", "other"]), label: z.string().min(1),
  minEcts: credits.optional(), minGpa: z.string().optional(), degreeType: degreeTypeSchema.optional(),
  field: z.string().optional(), language: z.string().optional(), minLevel: z.string().optional(), sourceText: z.string().optional(),
  mandatory: z.boolean().optional(), rule: eligibilityRuleSchema.optional(), evidence: z.array(sourceEvidenceSchema).optional(),
  conditionalAdmission: z.object({ description: z.string().min(1), alternative: eligibilityRuleSchema, evidence: z.array(sourceEvidenceSchema).min(1) }).strict().optional(),
}).strict().refine((req) => !req.rule || [req.minEcts, req.minGpa, req.degreeType, req.field, req.language, req.minLevel].every((value) => value === undefined), "Do not mix V2 rules with legacy comparators; split them into explicit requirements");

export const programSchema = z.object({
  id: z.string().min(1), university: z.string(), programName: z.string(), degreeType: degreeTypeSchema,
  language: z.string(), country: z.string(), city: z.string(), description: z.string(),
  deadline: z.string().optional(), fee: z.string().optional(), sourceUrl: z.string().optional(), lastChecked: z.string().optional(),
  requiredDocuments: z.array(documentKindSchema), requirements: z.array(programRequirementSchema),
  admissionText: z.string().optional(), origin: z.enum(["demo", "user", "catalog"]), isDemo: z.boolean(), createdAt: z.string(),
  schemaVersion: z.literal(2).optional(), catalogVersion: z.string().optional(), catalogDraftVersion: z.string().optional(), verificationStatus: verificationStatusSchema.optional(),
  sources: z.array(sourceEvidenceSchema).optional(), validFor: z.array(semesterSchema).optional(), requirementsComplete: z.boolean().optional(),
  facts: z.array(z.object({ id: z.string(), category: z.enum(["academic", "credits", "language", "deadline", "tuition", "application", "semester"]), value: z.string().nullable(), note: z.string().optional(), evidence: z.array(sourceEvidenceSchema) })).optional(),
  catalogIssues: z.array(z.string()).optional(), retrievedAt: timestampSchema.optional(),
}).refine((program) => new Set(program.requirements.map((req) => req.id)).size === program.requirements.length, "Duplicate requirement IDs");
