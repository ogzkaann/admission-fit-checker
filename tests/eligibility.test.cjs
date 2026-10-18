const { test } = require("node:test");
const assert = require("node:assert/strict");
const { analyzeFit, parseEcts } = require("../.test-build/domain/fit/admissionFit.js");
const { normalizeProgram, rulesForRequirement } = require("../.test-build/domain/programCompatibility.js");
const { programSchema, academicProfileSchema, extractedProfileSchema } = require("../.test-build/domain/schemas.js");
const { demoPrograms } = require("../.test-build/data/demoPrograms.js");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { FitResult } = require("../.test-build/components/FitResult.js");
const { getProfileCompleteness, profileHasAcademicData } = require("../.test-build/domain/profileStatus.js");

// All names, policies, source assertions and transcripts below are synthetic.
const semester = "2026-winter";
const options = { semester, asOf: "2026-10-18T12:00:00Z" };
const source = () => ({ url: "https://synthetic.example.invalid/regulations", quote: "Synthetic test policy, not a university requirement.", status: "verified", sourceType: "official", reviewedBy: "Synthetic fixture reviewer", lastChecked: "2026-10-01", validFor: [semester], locator: "Fixture section 1" });
const evidence = (quote) => ({ documentId: "doc", quote, reviewedAt: "2026-10-10" });
const documents = () => [{ id: "doc", kind: "transcript", fileName: "synthetic.txt", status: "parsed", createdAt: "2026-10-01", text: "Bachelor completed. Computer Science. Total 180 ECTS. Mathematics 10 ECTS. IELTS Academic English C1 overall 7 reading 6.5. IELTS General English B1 overall 5. Master completed. Business Science." }];
const profile = () => ({
  id: "local-profile", degree: "Bachelor", degreeType: "bachelor", degreeCompleted: true, field: "Computer Science", ects: "180", courses: [], workExperience: "", updatedAt: "2026-10-10", reviewedAt: "2026-10-10",
  evidence: { degree: evidence("Bachelor completed."), field: evidence("Computer Science."), ects: evidence("Total 180 ECTS.") },
  languageCertificates: [{ language: "English", test: "IELTS Academic", level: "C1", score: 7, componentScores: { reading: 6.5 }, evidence: evidence("IELTS Academic English C1 overall 7 reading 6.5.") }],
});
const req = (id, rule, overrides = {}) => ({ id, kind: rule.type === "language" ? "language" : "academic", label: `Synthetic ${id}`, mandatory: true, rule, evidence: [source()], ...overrides });
const degree = () => req("degree", { type: "degree", accepted: ["bachelor"], completionRequired: true });
const ects = (minimum = 180) => req("ects", { type: "total_ects", minimum });
const language = (accepted = [{ test: "IELTS Academic", minScore: 6.5 }]) => req("language", { type: "language", language: "English", accepted });
const program = (requirements = [degree(), ects(), language()]) => ({ id: "synthetic", university: "Synthetic fixture university", programName: "Synthetic master's", degreeType: "master", language: "English", country: "Germany", city: "", description: "Test fixture only", requiredDocuments: [], requirements, origin: "catalog", isDemo: false, createdAt: "2026-10-01", schemaVersion: 2, catalogVersion: "fixture-v1", verificationStatus: "verified", sources: [source()], validFor: [semester], requirementsComplete: true });
const analyze = (p = profile(), pr = program(), docs = documents(), opt = options) => analyzeFit(p, docs, pr, opt);

test("all mandatory rules supported by reviewed evidence can meet the modeled requirements", () => {
  const result = analyze();
  assert.equal(result.verdict, "strong_fit");
  assert.ok(result.checks.every((c) => c.status === "met"));
  assert.match(result.summary, /not a guarantee/);
});

test("one mandatory failure overrides any number of favorable checks", () => {
  const pr = program([degree(), language(), ...Array.from({ length: 10 }, (_, i) => req(`pass-${i}`, { type: "total_ects", minimum: 100 })), ects(210)]);
  const result = analyze(profile(), pr);
  assert.equal(result.verdict, "not_recommended");
  assert.equal(result.checks.filter((c) => c.hardBlocker).length, 1);
  assert.ok(result.score > 0.8, "coverage is never the verdict");
});

test("mandatory failure still blocks when a different mandatory rule is unknown", () => {
  const result = analyze(profile(), program([ects(210), req("manual", { type: "manual", explanation: "Synthetic manual assessment" })]));
  assert.equal(result.verdict, "not_recommended");
});

test("unknown mandatory rules and missing certificates require more information", () => {
  const p = profile(); p.languageCertificates = [];
  const result = analyze(p);
  assert.equal(result.verdict, "not_enough_data");
  assert.equal(result.checks.find((c) => c.kind === "language").reason, "missing_evidence");
  assert.ok(result.checks.every((c) => !c.hardBlocker));
  assert.equal(analyze(profile(), program([req("manual", { type: "manual", explanation: "Unmodeled aptitude assessment" })])).verdict, "not_enough_data");
});

test("self-reported shortfalls are potential mismatches, not confirmed blockers", () => {
  const p = profile(); delete p.evidence;
  const result = analyze(p, program([ects(210)]));
  assert.equal(result.verdict, "not_enough_data");
  assert.equal(result.checks[0].comparison, "not_met");
  assert.equal(result.checks[0].reason, "potential_mismatch");
});

test("deleted documents, failed extraction, and invented excerpts cannot confirm rules", () => {
  assert.equal(analyze(profile(), program(), []).verdict, "not_enough_data");
  assert.equal(analyze(profile(), program(), [{ ...documents()[0], status: "failed" }]).verdict, "not_enough_data");
  const p = profile(); p.evidence.ects.quote = "Invented 180 ECTS";
  assert.equal(analyze(p, program([ects()])).checks[0].status, "unknown");
});

test("numeric evidence must match a full number, not a substring of other credits", () => {
  const p = profile(); p.ects = "18";
  assert.equal(analyze(p, program([ects(20)])).checks[0].status, "unknown");
  p.ects = "179,5"; p.evidence.ects.quote = "Total 179,5 ECTS.";
  const docs = documents(); docs[0].text += " Total 179,5 ECTS.";
  assert.equal(analyze(p, program([ects(180)]), docs).verdict, "not_recommended");
});

test("degree completion and explicit accepted degree levels are mandatory", () => {
  const p = profile(); p.degree = "Master"; p.degreeType = "master"; p.evidence.degree = evidence("Master completed.");
  assert.equal(analyze(p, program([degree()])).verdict, "not_recommended");
  delete p.degreeType;
  assert.equal(analyze(p, program([degree()])).verdict, "not_enough_data");
  p.degreeType = "bachelor"; delete p.degreeCompleted;
  assert.equal(analyze(p, program([degree()])).verdict, "not_enough_data");
});

test("field matching requires explicit full-field equivalence, never shared words or course names", () => {
  const p = profile(); p.field = "Business Science"; p.evidence.field = evidence("Business Science."); p.courses = ["Computer Science"];
  const rule = { type: "field", accepted: ["Computer Science"], exhaustive: false };
  const result = analyze(p, program([req("field", rule)]));
  assert.equal(result.checks[0].reason, "unsupported_equivalence");
  assert.equal(result.verdict, "not_enough_data");
  assert.equal(analyze(p, program([req("field", { ...rule, exhaustive: true })])).verdict, "not_recommended");
});

const subjectFixture = () => {
  const p = profile();
  p.academicCourses = [{ id: "math", title: "Mathematics", ects: 10, evidence: evidence("Mathematics 10 ECTS.") }];
  p.transcriptComplete = true;
  p.courseEquivalences = [{ courseId: "math", programId: "synthetic", catalogVersion: "fixture-v1", requirementId: "subject", semester, decision: "accepted", evidence: source() }];
  return { p, pr: program([req("subject", { type: "subject_ects", subject: "Mathematics", minimum: 20 })]) };
};

test("complete reviewed transcript with insufficient equivalent credits is a blocker", () => {
  const { p, pr } = subjectFixture();
  assert.equal(analyze(p, pr).verdict, "not_recommended");
  pr.requirements[0].rule.minimum = 10;
  assert.equal(analyze(p, pr).verdict, "strong_fit");
});

test("partial transcripts, unsupported or outdated equivalences stay unknown", () => {
  for (const mutate of [p => { p.transcriptComplete = false; }, p => { p.courseEquivalences = []; }, p => { p.courseEquivalences[0].catalogVersion = "old"; }, p => { p.courseEquivalences[0].semester = "2025-winter"; }, p => { p.courseEquivalences[0].evidence.status = "unverified"; }]) {
    const { p, pr } = subjectFixture(); mutate(p);
    assert.equal(analyze(p, pr).verdict, "not_enough_data");
  }
});

test("duplicate courses or conflicting equivalence decisions cannot double count credits", () => {
  const { p, pr } = subjectFixture(); p.academicCourses.push({ ...p.academicCourses[0] });
  assert.equal(analyze(p, pr).verdict, "not_enough_data");
  p.academicCourses.pop(); p.courseEquivalences.push({ ...p.courseEquivalences[0], decision: "rejected" });
  assert.equal(analyze(p, pr).verdict, "not_enough_data");
});

test("all certificates and all explicitly allowed language alternatives are considered", () => {
  const p = profile(); p.languageCertificates.unshift({ language: "English", test: "IELTS General", level: "B1", score: 5, evidence: evidence("IELTS General English B1 overall 5.") });
  assert.equal(analyze(p, program([language([{ test: "TOEFL iBT", minScore: 100 }, { test: "IELTS Academic", minScore: 6.5 }])])).verdict, "strong_fit");
});

test("scores, certificate variants, and component minimums are enforced without conversions", () => {
  assert.equal(analyze(profile(), program([language([{ test: "IELTS Academic", minScore: 8 }])])).verdict, "not_recommended");
  assert.equal(analyze(profile(), program([language([{ test: "IELTS General", minScore: 6 }])])).verdict, "not_recommended");
  assert.equal(analyze(profile(), program([language([{ test: "IELTS Academic", componentMinimums: { reading: 7 } }])])).verdict, "not_recommended");
  assert.equal(analyze(profile(), program([language([{ test: "IELTS Academic", componentMinimums: { writing: 7 } }])])).verdict, "not_enough_data");
  const p = profile(); delete p.languageCertificates[0].test; p.languageCertificates[0].provider = "IELTS";
  assert.equal(analyze(p).verdict, "not_enough_data");
});

test("malformed CEFR labels do not become matches", () => {
  const p = profile(); p.languageCertificates[0].level = "not C1";
  assert.equal(analyze(p, program([language([{ minLevel: "C1" }])])).verdict, "not_enough_data");
});

test("low scores from an unknown test cannot prove a language failure", () => {
  const p = profile(); delete p.languageCertificates[0].test; p.languageCertificates[0].score = 5;
  assert.equal(analyze(p, program([language()])).verdict, "not_enough_data");
});

test("course evidence cannot be counted twice across IDs or subject groups", () => {
  const { p, pr } = subjectFixture();
  p.academicCourses.push({ ...p.academicCourses[0], id: "duplicate" });
  p.courseEquivalences.push({ ...p.courseEquivalences[0], courseId: "duplicate" });
  assert.equal(analyze(p, pr).verdict, "not_enough_data");
  p.academicCourses.pop(); p.courseEquivalences.pop();
  p.courseEquivalences.push({ ...p.courseEquivalences[0], requirementId: "other-subject" });
  assert.equal(analyze(p, pr).verdict, "not_enough_data");
});

test("rejected equivalences still need a reviewed transcript before confirming a shortfall", () => {
  const { p, pr } = subjectFixture(); p.courseEquivalences[0].decision = "rejected";
  delete p.academicCourses[0].evidence;
  assert.equal(analyze(p, pr).verdict, "not_enough_data");
});

test("conditional admission requires an explicit sourced and satisfied alternative", () => {
  const pr = program([ects(210)]);
  pr.requirements[0].conditionalAdmission = { description: "Synthetic bridge-credit condition to be fulfilled after enrollment.", alternative: { type: "total_ects", minimum: 180 }, evidence: [source()] };
  const result = analyze(profile(), pr);
  assert.equal(result.verdict, "possible_risky");
  assert.equal(result.checks[0].status, "conditional");
  assert.equal(result.checks[0].hardBlocker, false);
  pr.requirements[0].conditionalAdmission.evidence[0].status = "unverified";
  assert.equal(analyze(profile(), pr).verdict, "not_enough_data");
  pr.requirements[0].conditionalAdmission.evidence = [source()];
  pr.requirements[0].conditionalAdmission.alternative.minimum = 200;
  assert.equal(analyze(profile(), pr).verdict, "not_recommended");
});

test("source uncertainty never creates confirmed eligibility or a confirmed blocker", () => {
  for (const mutate of [pr => { pr.verificationStatus = "unverified"; }, pr => { pr.requirements[0].evidence = []; }, pr => { pr.sources[0].status = "conflicting"; }, pr => { pr.sources[0].lastChecked = "2024-01-01"; }, pr => { pr.sources[0].lastChecked = "2027-01-01"; }, pr => { pr.sources[0].sourceType = "user"; }, pr => { pr.sources[0].reviewedBy = ""; }, pr => { pr.validFor = ["2025-winter"]; }]) {
    const pr = program([ects(210)]); mutate(pr);
    const result = analyze(profile(), pr);
    assert.equal(result.verdict, "not_enough_data");
    assert.equal(result.checks[0].hardBlocker, false);
    assert.ok(result.sourceIssues.length);
  }
});

test("semester and complete requirement inventory are prerequisites for a positive verdict", () => {
  assert.equal(analyze(profile(), program(), documents(), {}).verdict, "not_enough_data");
  const pr = program(); pr.requirementsComplete = false;
  assert.equal(analyze(profile(), pr).verdict, "not_enough_data");
  assert.equal(analyze(profile(), program([])).verdict, "not_enough_data");
});

test("unknown advisory rules do not block when all mandatory rules pass", () => {
  const pr = program([degree(), req("advisory", { type: "manual", explanation: "Optional preparation recommendation" }, { mandatory: false })]);
  assert.equal(analyze(profile(), pr).verdict, "strong_fit");
});

test("legacy compound degree and field constraints are both checked", () => {
  const legacy = { id: "legacy", kind: "academic", label: "Legacy compound", degreeType: "bachelor", field: "Mathematics", evidence: [source()] };
  assert.equal(rulesForRequirement(legacy).length, 2);
  assert.equal(analyze(profile(), program([legacy])).verdict, "not_enough_data");
  const old = program(); delete old.verificationStatus; delete old.requirementsComplete;
  const normalized = normalizeProgram(old);
  assert.equal(normalized.verificationStatus, "unverified");
  assert.equal(normalized.requirementsComplete, false);
  assert.equal(old.verificationStatus, undefined, "normalization does not mutate stored data");
});

test("legacy profile collection defaults are applied before evaluation", () => {
  const p = profile(); delete p.courses; delete p.languageCertificates;
  assert.equal(analyze(p).verdict, "not_enough_data");
});

test("profile readiness recognizes test scores and structured course records", () => {
  const p = profile(); delete p.languageCertificates[0].level;
  assert.equal(getProfileCompleteness(p).language, "complete");
  assert.equal(profileHasAcademicData({ id: "local-profile", courses: [], academicCourses: [{ id: "course", title: "Synthetic course", ects: 5 }], languageCertificates: [], workExperience: "", updatedAt: "2026-10-10" }), true);
});

test("demo data remains illustrative even if verification metadata is accidentally set", () => {
  for (const demo of demoPrograms) {
    const result = analyze(profile(), { ...demo, verificationStatus: "verified", requirementsComplete: true, sources: [source()], validFor: [semester] });
    assert.equal(result.verdict, "not_enough_data");
    assert.equal(result.illustrative, true);
  }
});

test("required-document metadata cannot be omitted from the assessment", () => {
  const pr = program(); pr.requiredDocuments = ["diploma"];
  const result = analyze(profile(), pr);
  assert.equal(result.verdict, "not_enough_data");
  assert.ok(result.checks.some((c) => c.kind === "document"));
});

test("invalid rules fail closed and malformed profile numbers are rejected", () => {
  const pr = program([ects(-10)]);
  assert.equal(programSchema.safeParse(pr).success, false);
  assert.equal(analyze(profile(), pr).verdict, "not_enough_data");
  const p = profile(); p.languageCertificates[0].score = NaN;
  assert.equal(academicProfileSchema.safeParse(p).success, false);
  assert.equal(analyze(p).verdict, "not_enough_data");
  const future = program(); future.requirements[0].unmodeledConstraint = "Synthetic extra mandatory constraint";
  assert.equal(analyze(profile(), future).verdict, "not_enough_data");
  const mixed = program(); mixed.requirements[0].minGpa = "Unmodeled legacy grade condition";
  assert.equal(analyze(profile(), mixed).verdict, "not_enough_data");
});

test("schema round trips retain V2 evidence but AI extraction cannot assert review", () => {
  const p = profile();
  assert.deepEqual(academicProfileSchema.parse(p), p);
  const { pr } = subjectFixture(); assert.deepEqual(programSchema.parse(pr), pr);
  const extracted = extractedProfileSchema.parse({ languageCertificates: p.languageCertificates, evidence: p.evidence, degreeType: "bachelor" });
  assert.equal(extracted.evidence, undefined);
  assert.equal(extracted.languageCertificates[0].evidence, undefined);
});

test("ECTS parsing rejects negatives, ranges, approximations and foreign credit units", () => {
  for (const value of ["-180", "180-210", "about 180", "120 credits", "180 CP", "Infinity", "180 ECTS pending"]) assert.equal(parseEcts(value), undefined);
  assert.equal(parseEcts("180 ECTS"), 180);
  assert.equal(parseEcts("179,5"), 179.5);
});

test("result UI distinguishes blockers, missing evidence, and illustrative sources without probabilities", () => {
  const render = (analysis) => renderToStaticMarkup(React.createElement(FitResult, { analysis }));
  const blocked = render(analyze(profile(), program([ects(210)])));
  assert.match(blocked, /Hard blockers/);
  assert.match(blocked, /Mandatory blocker/);
  assert.doesNotMatch(blocked, /\d+%/);
  const p = profile(); p.languageCertificates = [];
  assert.match(render(analyze(p)), /Missing evidence and uncertain requirements/);
  assert.match(render(analyze(profile(), demoPrograms[0])), /Illustrative data, not verified admission information/);
});
