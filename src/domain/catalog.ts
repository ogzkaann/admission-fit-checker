import type { Program } from "./types";
import { programSchema } from "./eligibilitySchemas";

// Static published DTO boundary; a future HTTP/PostgreSQL catalog uses this contract.
export function readCatalog(input: unknown, now = new Date()): Program[] {
  if (!Array.isArray(input)) throw new Error("Catalog must be an array of program records.");
  return input.map((record) => {
    const program = programSchema.parse(record) as Program;
    if (program.origin !== "catalog" || program.isDemo) throw new Error("Invalid catalog origin.");
    const outdated = !program.sources?.length || program.sources.some((source) => {
      const checked = Date.parse(source.lastChecked ?? "");
      return !Number.isFinite(checked) || checked > now.getTime() || now.getTime() - checked > 366 * 86400000;
    });
    if (!outdated) return program;
    const stale = (sources: Program["sources"]) => sources?.map((source) => ({ ...source, status: "stale" as const }));
    return { ...program, verificationStatus: "stale", sources: stale(program.sources), facts: program.facts?.map((fact) => ({ ...fact, evidence: stale(fact.evidence) ?? [] })), requirements: program.requirements.map((req) => ({ ...req, evidence: stale(req.evidence), conditionalAdmission: req.conditionalAdmission ? { ...req.conditionalAdmission, evidence: stale(req.conditionalAdmission.evidence) ?? [] } : undefined })), catalogIssues: [...(program.catalogIssues ?? []), "Source checks are outdated; retrieve and review the current official information."] };
  });
}

export function catalogStatusLabel(program: Program): string {
  if (program.isDemo || program.origin === "demo") return "Illustrative demo";
  if (program.verificationStatus === "verified") return "Editorially verified";
  if (program.verificationStatus === "stale") return "Source check needed";
  if (program.verificationStatus === "conflicting") return "Conflicting information";
  return program.origin === "catalog" ? "Official sources / unverified" : "Unverified";
}
