import type {
  AcademicProfile, AdmissionSemester, EligibilityRule, EvidenceCitation, FitAnalysis,
  FitVerdict, Program, ProfileEvidence, ProgramRequirement, RequirementCheck, SourceEvidence, StoredDocument,
} from "../types";
import { academicProfileSchema } from "../schemas";
import { eligibilityRuleSchema, programSchema, semesterSchema, sourceEvidenceSchema } from "../eligibilitySchemas";
import { normalizeProgram, rulesForRequirement } from "../programCompatibility";

export interface AnalysisOptions {
  semester?: AdmissionSemester;
  asOf?: string; // injectable clock for reproducible reports/tests
}

type State = "met" | "not_met" | "unknown";
interface Evaluation {
  status: State;
  comparison: State;
  reason: RequirementCheck["reason"];
  detail: string;
  evidence: ProfileEvidence[];
}
interface Context {
  profile?: AcademicProfile;
  documents: StoredDocument[];
  program: Program;
  requirement: ProgramRequirement;
  semester?: AdmissionSemester;
  now: number;
}

const normalize = (value?: string) => (value ?? "").normalize("NFKC").trim().toLocaleLowerCase("en").replace(/\s+/g, " ");
const unique = (items: string[]) => [...new Set(items)];
const rank = (value?: string) => ["a1", "a2", "b1", "b2", "c1", "c2"].indexOf(normalize(value));
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

function containsValue(quote: string, value: string): boolean {
  if (/^\d+(?:\.\d+)?$/.test(value)) {
    return (quote.match(/\d+(?:[.,]\d+)?/g) ?? []).some((token) => Number(token.replace(",", ".")) === Number(value));
  }
  return quote.includes(normalize(value));
}

// Do not convert foreign credits, ranges, or approximate numbers to ECTS.
export function parseEcts(value?: string): number | undefined {
  const match = value?.trim().match(/^(\d+(?:[.,]\d+)?)\s*(?:ECTS)?$/i);
  if (!match) return undefined;
  const number = Number(match[1].replace(",", "."));
  return finite(number) ? number : undefined;
}

function unknown(detail: string, reason: Evaluation["reason"] = "missing_evidence", comparison: State = "unknown"): Evaluation {
  return { status: "unknown", comparison, reason, detail, evidence: [] };
}

function validProfileEvidence(evidence: ProfileEvidence | undefined, context: Context, values: string[] = []): evidence is ProfileEvidence {
  if (!evidence || !Number.isFinite(Date.parse(evidence.reviewedAt)) || Date.parse(evidence.reviewedAt) > context.now) return false;
  const doc = context.documents.find((item) => item.id === evidence.documentId && item.status !== "failed");
  const quote = normalize(evidence.quote);
  return Boolean(doc && quote && normalize(doc.text).includes(quote) && values.every((value) => containsValue(quote, value)));
}

function documented(status: Exclude<State, "unknown">, detail: string, evidence: ProfileEvidence | undefined, context: Context, values: string[] = []): Evaluation {
  if (!validProfileEvidence(evidence, context, values)) return unknown(`${detail} Supporting document text must be linked and reviewed.`, status === "not_met" ? "potential_mismatch" : "missing_evidence", status);
  return { status, comparison: status, reason: "confirmed", detail, evidence: [evidence] };
}

function all(evaluations: Evaluation[]): Evaluation {
  const failure = evaluations.find((item) => item.status === "not_met");
  const unresolved = evaluations.find((item) => item.status === "unknown");
  return {
    status: failure ? "not_met" : unresolved ? "unknown" : "met",
    comparison: evaluations.some((item) => item.comparison === "not_met") ? "not_met" : evaluations.some((item) => item.comparison === "unknown") ? "unknown" : "met",
    reason: failure?.reason ?? unresolved?.reason ?? "confirmed",
    detail: unique(evaluations.map((item) => item.detail)).join(" "), evidence: evaluations.flatMap((item) => item.evidence),
  };
}

function any(evaluations: Evaluation[]): Evaluation {
  const selected = evaluations.find((item) => item.status === "met") ?? evaluations.find((item) => item.status === "unknown") ?? evaluations[0];
  if (!selected) return unknown("No supported alternatives are specified.", "unsupported_rule");
  return { ...selected, detail: evaluations.length === 1 ? selected.detail : evaluations.map((item, i) => `Alternative ${i + 1} (${item.status}): ${item.detail}`).join(" ") };
}

// Verification is editorial metadata, not an automatic claim that a URL is official.
// The one-year freshness ceiling is product policy, additional to semester validity.
function sourceIssues(sources: SourceEvidence[] | undefined, semester: AdmissionSemester | undefined, now: number): string[] {
  if (!sources?.length) return ["No source evidence is available."];
  const issues: string[] = [];
  for (const source of sources) {
    if (!sourceEvidenceSchema.safeParse(source).success) { issues.push("Source evidence is malformed."); continue; }
    if (source.status !== "verified" || source.sourceType !== "official" || !source.reviewedBy?.trim()) issues.push("Source has not been verified by a named reviewer against official information.");
    const checked = Date.parse(source.lastChecked ?? "");
    if (!Number.isFinite(checked) || checked > now || now - checked > 366 * 86400000) issues.push("Source check date is missing, invalid, in the future, or older than one year.");
    if (!semester || !source.validFor?.includes(semester)) issues.push("Source validity is not established for the selected admission semester.");
  }
  return unique(issues);
}

function evaluate(rule: EligibilityRule, context: Context): Evaluation {
  if (!eligibilityRuleSchema.safeParse(rule).success) return unknown("This rule is malformed or unsupported and requires review.", "unsupported_rule");
  const { profile, requirement, program } = context;
  if (rule.type === "manual") return unknown(rule.explanation, "unsupported_rule");
  if (rule.type === "all" || rule.type === "any") return (rule.type === "all" ? all : any)(rule.rules.map((child) => evaluate(child, context)));
  if (rule.type === "document") {
    const doc = context.documents.find((item) => item.kind === rule.documentKind && item.status !== "failed");
    return unknown(doc ? `A ${rule.documentKind} is uploaded; completeness and certification still require review.` : `Required ${rule.documentKind} is not on file.`);
  }
  if (!profile) return unknown("Save a reviewed academic profile with supporting evidence.");
  if (rule.type === "metric") {
    const metric = profile.metrics?.[rule.metric];
    if (!metric) return unknown(`Reviewed ${rule.metric.replace(/_/g, " ")} evidence is missing. No foreign-grade conversion or cohort-rank inference is performed.`);
    const units = { degree_years: /\b(years?|jahre?n?)\b/i, german_grade: /german grade|deutsche.*note/i, cohort_top_percent: /top.*%|besten.*prozent|cohort.*percent/i };
    if (!units[rule.metric].test(metric.evidence?.quote ?? "")) return unknown(`The excerpt must explicitly identify ${rule.metric.replace(/_/g, " ")}, not merely a nearby number.`);
    const met = (rule.minimum === undefined || metric.value >= rule.minimum) && (rule.maximum === undefined || metric.value <= rule.maximum);
    return documented(met ? "met" : "not_met", `${rule.metric.replace(/_/g, " ")}: ${metric.value}; required ${rule.minimum !== undefined ? `at least ${rule.minimum}` : ""}${rule.minimum !== undefined && rule.maximum !== undefined ? " and " : ""}${rule.maximum !== undefined ? `at most ${rule.maximum}` : ""}.`, metric.evidence, context, [String(metric.value)]);
  }
  if (rule.type === "education_language") {
    const proof = profile.educationLanguage;
    if (!proof || !/entire|exclusively|vollständig|ausschließlich/i.test(proof.evidence?.quote ?? "") || !/\bdegree\b|bachelor|studiengang|hochschulabschluss/i.test(proof.evidence?.quote ?? "")) return unknown("Evidence that the entire qualifying degree was taught in an accepted language is missing; a language mention is not an exemption.");
    return documented(rule.accepted.some((language) => normalize(language) === normalize(proof.language)) ? "met" : "not_met", `Qualifying degree instruction language: ${proof.language}; accepted: ${rule.accepted.join(", ")}.`, proof.evidence, context, [proof.language]);
  }
  if (rule.type === "assessment") {
    const decisions = profile.admissionAssessments?.filter((item) => item.programId === program.id && item.catalogVersion === program.catalogVersion && item.requirementId === requirement.id && item.assessmentKey === rule.key && item.semester === context.semester) ?? [];
    if (decisions.length !== 1 || decisions[0].decision === "pending") return unknown(`${rule.explanation} A program/version/semester-bound university decision is required.`, "unsupported_equivalence");
    const decision = decisions[0];
    if (decision.validUntil && Date.parse(decision.validUntil) < context.now) return unknown("The recorded university decision/deferral has expired. Obtain current evidence or an explicit extension; no continuing authorization is assumed.");
    if (sourceIssues([decision.evidence], context.semester, context.now).length || normalize(decision.evidence.quote) !== normalize(decision.profileEvidence.quote)) return unknown("The university decision must have reviewed official provenance and the same linked applicant-document excerpt.", "unsupported_equivalence");
    return documented(decision.decision === "accepted" ? "met" : "not_met", `${rule.explanation} Recorded university decision: ${decision.decision}.`, decision.profileEvidence, context);
  }
  if (rule.type === "degree") {
    if (!profile.degreeType || !profile.degree?.trim()) return unknown("Record the degree title and select the prior degree level; free-text titles are not classified automatically.");
    if (!rule.accepted.includes(profile.degreeType)) return documented("not_met", `Prior degree level ${profile.degreeType} is outside the accepted levels: ${rule.accepted.join(", ")}.`, profile.evidence?.degree, context, [profile.degree]);
    if (rule.completionRequired && profile.degreeCompleted === undefined) return unknown("Degree completion has not been confirmed.");
    if (rule.completionRequired) {
      const quote = profile.evidence?.degree?.quote ?? "";
      const incomplete = /not (?:yet )?completed|in progress|nicht abgeschlossen|noch nicht/i.test(quote);
      const complete = !incomplete && /\bcompleted\b|\bawarded\b|\bconferred\b|abgeschlossen|verliehen/i.test(quote);
      if (profile.degreeCompleted ? !complete : !incomplete) return unknown("The linked degree excerpt does not explicitly support the recorded completion status.");
    }
    return documented(rule.completionRequired && !profile.degreeCompleted ? "not_met" : "met", rule.completionRequired && !profile.degreeCompleted ? "The required degree is not yet completed." : "The recorded degree level and completion meet this rule.", profile.evidence?.degree, context, [profile.degree]);
  }
  if (rule.type === "field") {
    if (!profile.field?.trim()) return unknown("Field of study is missing.");
    if (rule.accepted.some((field) => normalize(field) === normalize(profile.field))) return documented("met", `Recorded field matches an explicitly accepted field: ${profile.field}.`, profile.evidence?.field, context, [profile.field]);
    if (!rule.exhaustive) return unknown(`Field "${profile.field}" is not an exact listed match. Related-field equivalence needs university review.`, "unsupported_equivalence", "not_met");
    return documented("not_met", `Field "${profile.field}" is outside the explicitly exhaustive accepted list.`, profile.evidence?.field, context, [profile.field]);
  }
  if (rule.type === "total_ects") {
    const credits = parseEcts(profile.ects);
    if (credits === undefined) return unknown("An unambiguous total in ECTS is missing; other credit systems are not converted.");
    return documented(credits >= rule.minimum ? "met" : "not_met", `Recorded total: ${credits} ECTS; required: ${rule.minimum} ECTS.`, profile.evidence?.ects, context, [String(credits)]);
  }
  if (rule.type === "subject_ects") {
    const courses = profile.academicCourses ?? [];
    if (!courses.length) return unknown(`Course-level credits and explicit equivalence decisions for ${rule.subject} are missing. Course names alone are not evidence of equivalence.`, "unsupported_equivalence");
    if (new Set(courses.map((course) => course.id)).size !== courses.length) return unknown("Duplicate course IDs prevent reliable credit counting.", "unsupported_equivalence");
    const excerpts = courses.filter((course) => course.evidence).map((course) => `${course.evidence!.documentId}:${normalize(course.evidence!.quote)}`);
    if (new Set(excerpts).size !== excerpts.length) return unknown("Repeated course evidence may double count credits; provide distinct course excerpts.", "unsupported_equivalence");
    let credits = 0;
    let unresolved = !profile.transcriptComplete;
    const evidence: ProfileEvidence[] = [];
    for (const course of courses) {
      const decisions = (profile.courseEquivalences ?? []).filter((item) => item.courseId === course.id && item.programId === program.id && item.requirementId === requirement.id && item.catalogVersion === program.catalogVersion && item.semester === context.semester);
      if (!program.catalogVersion || decisions.length !== 1 || decisions[0].decision === "pending" || sourceIssues(decisions[0].evidence ? [decisions[0].evidence] : [], context.semester, context.now).length) { unresolved = true; continue; }
      if (!finite(course.ects) || !validProfileEvidence(course.evidence, context, [course.title, String(course.ects)])) { unresolved = true; continue; }
      if (decisions[0].decision === "rejected") { evidence.push(course.evidence); continue; }
      const overlaps = (profile.courseEquivalences ?? []).some((item) => item.courseId === course.id && item.programId === program.id && item.catalogVersion === program.catalogVersion && item.semester === context.semester && item.requirementId !== requirement.id && item.decision === "accepted");
      if (overlaps) { unresolved = true; continue; }
      credits += course.ects;
      evidence.push(course.evidence);
    }
    const detail = `Confirmed equivalent credits in ${rule.subject}: ${credits}; required: ${rule.minimum} ECTS.`;
    if (credits >= rule.minimum) return { status: "met", comparison: "met", reason: "confirmed", detail, evidence };
    if (unresolved) return unknown(`${detail} The transcript or equivalence decisions are incomplete; a shortfall cannot be confirmed.`, "unsupported_equivalence");
    return { status: "not_met", comparison: "not_met", reason: "confirmed", detail: `${detail} The complete reviewed course list falls short.`, evidence };
  }
  if (rule.type === "language") {
    const certificates = profile.languageCertificates.filter((cert) => normalize(cert.language) === normalize(rule.language));
    if (!certificates.length) return unknown(`No ${rule.language} certificate is on file. This is missing evidence, not a confirmed language failure.`);
    return any(certificates.map((certificate) => any(rule.accepted.map((option) => {
      const details: string[] = [];
      const values: string[] = [];
      let failed = false;
      let missing = false;
      if (option.test) {
        if (!certificate.test?.trim()) return unknown(`Required certificate type: ${option.test}. The exact test is missing; scores cannot be compared across unspecified tests.`);
        if (normalize(certificate.test) !== normalize(option.test)) return documented("not_met", `Certificate type ${certificate.test} is not the explicitly accepted ${option.test}.`, certificate.evidence, context, [certificate.test]);
        values.push(certificate.test);
        details.push(`Required certificate type: ${option.test}; recorded: ${certificate.test || "unspecified"}.`);
      }
      if (option.minLevel) {
        const have = rank(certificate.level);
        if (have < 0) missing = true;
        else { failed ||= have < rank(option.minLevel); values.push(certificate.level!); }
        details.push(`CEFR minimum ${option.minLevel}; recorded ${certificate.level || "unknown"}.`);
      }
      if (option.minScore !== undefined) {
        if (!finite(certificate.score)) missing = true;
        else { failed ||= certificate.score < option.minScore; values.push(String(certificate.score)); }
        details.push(`Score minimum ${option.minScore}; recorded ${certificate.score ?? "unknown"}.`);
      }
      for (const [component, minimum] of Object.entries(option.componentMinimums ?? {})) {
        const score = certificate.componentScores?.[component];
        if (!finite(score)) missing = true;
        else { failed ||= score < minimum; values.push(String(score)); }
        details.push(`${component} minimum ${minimum}; recorded ${score ?? "unknown"}.`);
      }
      if (!failed && missing) return unknown(`${details.join(" ")} No test-to-CEFR or provider-to-test conversion is assumed.`);
      return documented(failed ? "not_met" : "met", details.join(" "), certificate.evidence, context, values);
    }))));
  }
  return unknown("Unsupported rule requires manual review.", "unsupported_rule");
}

function evaluateRequirement(context: Context, programIssues: string[]): RequirementCheck {
  const req = context.requirement;
  const mandatory = req.mandatory !== false;
  const result = all(rulesForRequirement(req).map((rule) => evaluate(rule, context)));
  const issues = unique([...programIssues, ...sourceIssues(req.evidence, context.semester, context.now)]);
  let status: RequirementCheck["status"] = issues.length ? "unknown" : result.status;
  let reason: RequirementCheck["reason"] = issues.length ? "source_uncertainty" : result.reason;
  let detail = result.detail;
  let evidence = result.evidence;
  if (result.status !== "met" && status !== "met" && req.conditionalAdmission) {
    const condition = req.conditionalAdmission;
    const conditionIssues = sourceIssues(condition.evidence, context.semester, context.now);
    const alternative = evaluate(condition.alternative, context);
    if (!issues.length && !conditionIssues.length && alternative.status === "met") {
      status = "conditional"; reason = "conditional";
      detail += ` Explicit conditional route: ${condition.description} ${alternative.detail}`;
      evidence = [...evidence, ...alternative.evidence];
    } else if (conditionIssues.length || alternative.status === "unknown") {
      status = "unknown"; reason = issues.length || conditionIssues.length ? "source_uncertainty" : "missing_evidence";
      detail += ` A conditional route exists but cannot yet be established: ${condition.description} ${alternative.detail}`;
      issues.push(...conditionIssues);
    }
  }
  return {
    requirementId: req.id, label: req.label, kind: req.kind, status, decisive: mandatory,
    mandatory, hardBlocker: mandatory && status === "not_met", comparison: result.comparison, reason,
    detail, sourceIssues: unique(issues), profileEvidence: evidence,
  };
}

function citations(program: Program): EvidenceCitation[] {
  return program.requirements.flatMap((req): EvidenceCitation[] => {
    const evidence = [...(req.evidence ?? []), ...(req.conditionalAdmission?.evidence ?? [])];
    if (evidence.length) return evidence.map((source, i) => ({ id: `${program.id}-${req.id}-${i}`, programId: program.id, label: req.label, snippet: source.quote, sourceUrl: /^https?:\/\//i.test(source.url) ? source.url : undefined, lastChecked: source.lastChecked, verificationStatus: source.status, locator: source.locator }));
    return req.sourceText ? [{ id: `${program.id}-${req.id}`, programId: program.id, label: req.label, snippet: req.sourceText, sourceUrl: /^https?:\/\//i.test(program.sourceUrl ?? "") ? program.sourceUrl : undefined, verificationStatus: program.isDemo ? "demo" : "unverified" }] : [];
  });
}

export function analyzeFit(profile: AcademicProfile | undefined, documents: StoredDocument[], input: Program, options: AnalysisOptions = {}): FitAnalysis {
  const now = Date.parse(options.asOf ?? new Date().toISOString());
  const program = normalizeProgram(input);
  const issues: string[] = [];
  if (!Number.isFinite(now)) issues.push("Analysis date is invalid.");
  if (!programSchema.safeParse(program).success) issues.push("Program data is malformed or uses unsupported rules.");
  if (!options.semester || !semesterSchema.safeParse(options.semester).success) issues.push("Select an admission semester to establish source validity.");
  if (program.isDemo) issues.push("Illustrative demo data only. These are not verified university requirements.");
  if (program.verificationStatus !== "verified") issues.push(`Program source status: ${program.verificationStatus}.`);
  if (!program.validFor?.includes(options.semester!)) issues.push("Program validity is not established for this admission semester.");
  issues.push(...sourceIssues(program.sources, options.semester, now));
  const parsedProfile = academicProfileSchema.safeParse(profile);
  const validProfile = parsedProfile.success ? parsedProfile.data as AcademicProfile : undefined;
  const checks = program.requirements.map((requirement) => evaluateRequirement({ profile: validProfile, documents, program, requirement, semester: options.semester, now }, issues));
  if (!program.requirementsComplete) issues.push("The requirement set has not been verified as complete; additional conditions may apply.");
  if (!checks.length) issues.push("No admission requirements are modeled.");
  for (const kind of new Set(program.requiredDocuments)) {
    if (!program.requirements.some((req) => req.rule?.type === "document" && req.rule.documentKind === kind)) checks.push(evaluateRequirement({ profile: validProfile, documents, program, requirement: { id: `required-document-${kind}`, kind: "document", label: `Required document: ${kind}`, mandatory: true, rule: { type: "document", documentKind: kind } }, semester: options.semester, now }, issues));
  }
  const mandatory = checks.filter((check) => check.mandatory);
  const blockers = mandatory.filter((check) => check.hardBlocker);
  const sourceUncertainty = unique([...issues, ...checks.flatMap((check) => check.sourceIssues)]);
  let verdict: FitVerdict;
  if (blockers.length) verdict = "not_recommended";
  else if (!mandatory.length || mandatory.some((check) => check.status === "unknown") || sourceUncertainty.length) verdict = "not_enough_data";
  else if (mandatory.some((check) => check.status === "conditional")) verdict = "possible_risky";
  else verdict = "strong_fit";
  const summary = {
    not_recommended: "At least one mandatory requirement is confirmed unmet against the reviewed evidence. Other matches cannot offset this blocker.",
    not_enough_data: "Eligibility cannot be established. Resolve the missing evidence, uncertain equivalences, or source verification issues below.",
    possible_risky: "An explicitly sourced conditional route applies. Outstanding conditions still need to be fulfilled and confirmed by the university.",
    strong_fit: "All modeled mandatory requirements are supported by reviewed document evidence for this semester. This is not a guarantee of admission.",
  }[verdict];
  return {
    engineVersion: 2, programId: program.id, verdict,
    score: mandatory.length ? mandatory.filter((check) => check.status === "met").length / mandatory.length : 0,
    summary, checks, citations: citations(program),
    risks: checks.filter((check) => check.status === "not_met" || check.status === "conditional" || check.comparison === "not_met").map((check) => check.detail),
    missingProfileData: unique(checks.filter((check) => check.status === "unknown" && check.reason !== "source_uncertainty" && check.reason !== "unsupported_rule").map((check) => check.label)),
    needsVerification: verdict !== "strong_fit", createdAt: Number.isFinite(now) ? new Date(now).toISOString() : new Date().toISOString(),
    semester: options.semester, sourceIssues: sourceUncertainty, illustrative: program.isDemo,
  };
}
