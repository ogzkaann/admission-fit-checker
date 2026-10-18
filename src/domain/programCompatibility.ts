import type { EligibilityRule, Program, ProgramRequirement } from "./types";

// Additive read migration: old records remain readable but never gain verification.
export function normalizeProgram(program: Program): Program {
  const demo = program.isDemo || program.origin === "demo";
  return {
    ...program,
    isDemo: demo,
    verificationStatus: demo ? "demo" : program.verificationStatus ?? "unverified",
    requirementsComplete: program.requirementsComplete ?? false,
    requirements: program.requirements.map((req) => ({ ...req, mandatory: req.mandatory ?? true })),
  };
}

// Legacy fields are conjunctive. A degree must not conceal a field restriction.
export function rulesForRequirement(req: ProgramRequirement): EligibilityRule[] {
  if (req.rule) return [req.rule];
  const rules: EligibilityRule[] = [];
  if (req.degreeType) rules.push({ type: "degree", accepted: [req.degreeType], completionRequired: true });
  if (req.field) rules.push({ type: "field", accepted: [req.field], exhaustive: false });
  if (req.minEcts !== undefined) rules.push({ type: "total_ects", minimum: req.minEcts });
  if (req.language && req.minLevel) rules.push({ type: "language", language: req.language, accepted: [{ minLevel: req.minLevel }] });
  if (req.minGpa || rules.length === 0) rules.push({ type: "manual", explanation: req.minGpa ? "Grade scale and conversion policy require manual review." : "No supported, structured rule is available." });
  return rules;
}
