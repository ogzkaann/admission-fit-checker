import { hash, normalizeText } from "./extract.mjs";

const volatile = new Set(["createdAt", "retrievedAt", "lastChecked", "catalogVersion"]);
export function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().filter((key) => !volatile.has(key)).map((key) => [key, stable(value[key])]));
  return value;
}
export const revisionFor = (program) => hash(stable(program));

export function differences(before, after) {
  const changes = [];
  for (const collection of ["requirements", "facts", "sources"]) {
    const key = (item) => item.id ?? item.url;
    const old = new Map((before?.[collection] ?? []).map((item) => [key(item), item]));
    const next = new Map((after[collection] ?? []).map((item) => [key(item), item]));
    for (const id of new Set([...old.keys(), ...next.keys()])) {
      if (JSON.stringify(stable(old.get(id))) !== JSON.stringify(stable(next.get(id)))) changes.push({ collection, id, change: !old.has(id) ? "added" : !next.has(id) ? "removed" : "changed", before: old.get(id) ?? null, after: next.get(id) ?? null });
    }
  }
  return changes;
}

export function assertEvidence(citation, snapshots) {
  const source = snapshots[citation.snapshotId];
  if (!source || source.contentHash !== citation.contentHash || source.url !== citation.url) throw new Error("Evidence is not bound to the captured source revision");
  const quote = normalizeText(citation.quote);
  const present = citation.locator === "Source document identity" ? normalizeText(source.title) === quote : source.blocks.some((block) => block.locator === citation.locator && normalizeText(block.text).includes(quote));
  if (!quote || !present) throw new Error("Evidence quote or locator is absent from the source snapshot");
  if (citation.sourceType !== "official") throw new Error("Catalog evidence must reference an official source");
}

export function reviewTemplate(program) {
  return {
    schemaVersion: 1, programId: program.id, revision: program.catalogVersion,
    reviewer: "", reviewedAt: "", note: "", requirementsComplete: false,
    applicability: { semesters: [], evidence: [], explanation: "" },
    sources: (program.sources ?? []).map((source) => ({ snapshotId: source.snapshotId, decision: "pending" })),
    requirements: program.requirements.map((requirement) => ({ decision: "pending", requirement: structuredClone(requirement) })),
    facts: (program.facts ?? []).map((fact) => ({ id: fact.id, decision: "pending" })),
  };
}

// A local editorial assertion, not university approval or credential authentication.
export function applyReview(program, review, snapshots, schema, now = new Date()) {
  if (review.programId !== program.id || review.revision !== program.catalogVersion) throw new Error("Review targets a different catalog revision");
  if (!review.reviewer?.trim() || !review.note?.trim()) throw new Error("Named reviewer and review rationale required");
  const reviewed = Date.parse(review.reviewedAt);
  if (!Number.isFinite(reviewed) || reviewed > now.getTime() || reviewed < Date.parse(program.createdAt)) throw new Error("Invalid review timestamp");
  if (program.sources?.some((source) => reviewed < Date.parse(source.retrievedAt))) throw new Error("Review predates captured source evidence");
  const semesters = review.applicability?.semesters;
  if (!Array.isArray(semesters) || !semesters.length || semesters.some((value) => !/^\d{4}-(winter|summer)$/.test(value))) throw new Error("Explicit admission semester applicability required");
  if (!review.applicability.explanation?.trim() || !review.applicability.evidence?.length) throw new Error("Source-backed semester applicability required");
  const sourceIds = new Set((program.sources ?? []).map((source) => source.snapshotId));
  const validateCitation = (citation) => {
    if (!sourceIds.has(citation.snapshotId)) throw new Error("Review evidence must use this revision's sources");
    assertEvidence(citation, snapshots);
  };
  review.applicability.evidence.forEach(validateCitation);
  const decisions = new Set(["pending", "approve", "reject"]);
  for (const entries of [review.sources, review.requirements, review.facts]) {
    if (!Array.isArray(entries) || entries.some((entry) => !decisions.has(entry.decision))) throw new Error("Invalid review decisions");
  }
  const exactIds = (expected, actual) => expected.length === actual.length && new Set(actual).size === actual.length && expected.every((id) => actual.includes(id));
  if (!exactIds([...sourceIds], review.sources.map((entry) => entry.snapshotId))) throw new Error("Review must cover every source exactly once");
  if (!exactIds((program.facts ?? []).map((fact) => fact.id), review.facts.map((entry) => entry.id))) throw new Error("Review must cover every fact exactly once");
  // Requirements may be split/corrected by a reviewer, but missing/unsupported clauses
  // cannot be declared a complete inventory. The immutable draft remains auditable.
  const approve = (source) => {
    validateCitation(source);
    if (!review.sources.some((item) => item.snapshotId === source.snapshotId && item.decision === "approve")) throw new Error("Requirement/fact approval needs source approval");
    const captured = program.sources.find((item) => item.snapshotId === source.snapshotId);
    return { ...source, lastChecked: captured.lastChecked, retrievedAt: captured.retrievedAt, status: "verified", reviewedBy: review.reviewer.trim(), validFor: semesters };
  };
  const requirements = review.requirements.map(({ decision, requirement }) => {
    const parsed = schema.requirement.parse(requirement);
    [...(parsed.evidence ?? []), ...(parsed.conditionalAdmission?.evidence ?? [])].forEach(validateCitation);
    if (decision === "approve" && !parsed.evidence?.length) throw new Error("Approved requirement needs evidence");
    return { ...parsed, evidence: (parsed.evidence ?? []).map((source) => decision === "approve" ? approve(source) : { ...source, status: decision === "reject" ? "conflicting" : "unverified", reviewedBy: undefined, validFor: [] }), conditionalAdmission: parsed.conditionalAdmission ? { ...parsed.conditionalAdmission, evidence: parsed.conditionalAdmission.evidence.map((source) => decision === "approve" ? approve(source) : { ...source, status: "unverified", reviewedBy: undefined, validFor: [] }) } : undefined };
  });
  const sources = program.sources.map((source) => review.sources.find((item) => item.snapshotId === source.snapshotId).decision === "approve" ? approve(source) : { ...source, status: "unverified" });
  const facts = (program.facts ?? []).map((fact) => {
    const decision = review.facts.find((item) => item.id === fact.id).decision;
    if (decision === "approve" && (!fact.value || !fact.evidence.length)) throw new Error("An unknown fact cannot be approved");
    return { ...fact, evidence: fact.evidence.map((source) => decision === "approve" ? approve(source) : { ...source, status: decision === "reject" ? "conflicting" : "unverified" }) };
  });
  const allApproved = sources.length > 0 && sources.every((source) => source.status === "verified") && requirements.length > 0 && review.requirements.every((item) => item.decision === "approve") && facts.every((fact) => fact.value === null || fact.evidence.every((source) => source.status === "verified"));
  if (review.requirementsComplete && (!allApproved || requirements.some((req) => !req.rule || req.rule.type === "manual"))) throw new Error("Incomplete or unsupported rules cannot form a complete verified inventory");
  const rejected = [...review.sources, ...review.requirements, ...review.facts].some((item) => item.decision === "reject");
  return schema.program.parse({ ...program, catalogDraftVersion: program.catalogVersion, catalogVersion: hash({ draft: program.catalogVersion, review }), sources, facts, requirements, validFor: semesters, requirementsComplete: review.requirementsComplete === true, verificationStatus: program.verificationStatus === "stale" ? "stale" : rejected ? "conflicting" : allApproved ? "verified" : "unverified", catalogIssues: allApproved ? ["Editorial review is not an admission decision. Check applicant-specific rules with the university."] : program.catalogIssues });
}

export function markStale(program, reason) {
  const stale = (evidence) => evidence?.map((source) => ({ ...source, status: "stale" }));
  return { ...program, verificationStatus: "stale", catalogIssues: [...new Set([...(program.catalogIssues ?? []), reason])], sources: stale(program.sources), facts: program.facts?.map((fact) => ({ ...fact, evidence: stale(fact.evidence) })), requirements: program.requirements.map((req) => ({ ...req, evidence: stale(req.evidence), conditionalAdmission: req.conditionalAdmission ? { ...req.conditionalAdmission, evidence: stale(req.conditionalAdmission.evidence) } : undefined })) };
}
