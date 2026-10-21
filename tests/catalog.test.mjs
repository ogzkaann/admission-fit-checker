import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createFetcher, allowedUrl, MAX_BYTES } from "../scripts/catalog/fetch.mjs";
import { extractProgram, parseSource, hash } from "../scripts/catalog/extract.mjs";
import { applyReview, assertEvidence, differences, markStale, reviewTemplate, revisionFor } from "../scripts/catalog/core.mjs";
import { renderReviewReport } from "../scripts/catalog/report.mjs";

const require = createRequire(import.meta.url);
const { programSchema, programRequirementSchema } = require("../.test-build/domain/eligibilitySchemas.js");
const { analyzeFit } = require("../.test-build/domain/fit/admissionFit.js");
const { readCatalog, catalogStatusLabel } = require("../.test-build/domain/catalog.js");
const { CatalogEvidence } = require("../.test-build/components/CatalogEvidence.js");
const { ProgramCard } = require("../.test-build/components/ProgramCard.js");
const { askAboutProgram } = require("../.test-build/ai/askProgram.js");
const schema = { program: programSchema, requirement: programRequirementSchema };
const now = new Date("2026-10-21T20:00:00Z");
const url = "https://university.example.invalid/program";
const hosts = ["university.example.invalid"];
const json = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const response = (text, status = 200, headers = {}) => new Response(text, { status, headers: { "content-type": "text/html", ...headers } });

function network(routes, options = {}) {
  const calls = [], delays = [];
  let time = now.getTime();
  const fetchSource = createFetcher({ hosts, now: () => time, sleep: async (delay) => { delays.push(delay); time += delay; }, fetchImpl: async (target) => { calls.push(target); return routes(target); }, ...options });
  return { fetchSource, calls, delays };
}
const html = `<html><head><title>Synthetic program</title></head><body><nav>Not admission content</nav><main><h1>Synthetic program</h1><p>For winter semester 2026: at least 30 ECTS in Mathematics.</p><p>English C1 is required.</p><ul><li>Language alternatives:<ul><li>Test A &amp; Test B</li></ul></li></ul><a href="/regulation.pdf">Admission regulations</a><a href="https://external.example.invalid/apply">Application</a></main></body></html>`;
const fetched = (text = html) => ({ url, requestedUrl: url, bytes: Buffer.from(text), mediaType: "text/html", retrievedAt: "2026-10-18T10:00:00Z", robotsStatus: 200, redirects: [] });
const seed = () => ({ id: "synthetic", university: "Synthetic fixture only", programName: "Synthetic program", city: "", language: "English", description: "Not a real admission policy", sources: [{ id: "source", url }], extract: [
  { id: "math", category: "credits", source: "source", anchor: "at least 30 ECTS", requirement: true, label: "Synthetic mathematics", kind: "ects", extractor: "subject_ects", subject: "Mathematics" },
  { id: "language", category: "language", source: "source", anchor: "English C1", requirement: true, label: "Synthetic English", kind: "language", extractor: "cefr", language: "English" },
  { id: "tuition", category: "tuition", source: "source" },
] });
async function fixture() {
  const snapshot = await parseSource(fetched(), hosts);
  const program = extractProgram(seed(), { source: snapshot }, {}, "2026-10-18T10:00:00Z");
  program.catalogVersion = revisionFor(program);
  return { snapshot, snapshots: { [snapshot.id]: snapshot }, program };
}
function approvedReview(program) {
  const review = reviewTemplate(program);
  review.reviewer = "Synthetic test reviewer";
  review.reviewedAt = "2026-10-18T11:00:00Z";
  review.note = "Synthetic fixture policy checked in full.";
  review.applicability = { semesters: ["2026-winter"], evidence: program.requirements[0].evidence, explanation: "Fixture explicitly names winter semester 2026." };
  review.sources.forEach((entry) => { entry.decision = "approve"; });
  review.facts.forEach((entry) => { if (program.facts.find((fact) => fact.id === entry.id).value) entry.decision = "approve"; });
  review.requirements = review.requirements.filter((entry) => entry.requirement.id !== "inventory-review").map((entry) => ({ ...entry, decision: "approve" }));
  review.removedRequirements = [{ id: "inventory-review", reason: "Synthetic fixture contains only the two stated rules; completeness checked for this test.", evidence: program.requirements[0].evidence }];
  review.requirementsComplete = true;
  return review;
}

test("fetch allows only explicit HTTPS official hosts and no credentials", () => {
  assert.equal(allowedUrl(`${url}#requirements`, hosts), url);
  for (const target of ["http://university.example.invalid", "https://evil.example.invalid", "https://user:password@university.example.invalid", "https://university.example.invalid:8443"]) assert.throws(() => allowedUrl(target, hosts));
});
test("robots disallow prevents document retrieval", async () => {
  const net = network(() => response("User-agent: *\nDisallow: /program", 200, { "content-type": "text/plain" }));
  await assert.rejects(net.fetchSource(url), /disallows/);
  assert.deepEqual(net.calls, ["https://university.example.invalid/robots.txt"]);
});
test("unavailable or HTML robots policies fail closed", async () => {
  for (const policy of [() => response("unavailable", 500), () => response("<html>login</html>")]) {
    const net = network(policy);
    await assert.rejects(net.fetchSource(url), /robots.txt/);
    assert.equal(net.calls.length, 1);
  }
});
test("robots 404 is allowed, redirects are bounded and checked against allowlist", async () => {
  const net = network((target) => target.endsWith("robots.txt") ? response("", 404) : response("", 302, { location: "https://external.example.invalid/program" }));
  await assert.rejects(net.fetchSource(url), /allowlist/);
  assert.equal(net.calls.length, 2);
  const looping = network((target) => target.endsWith("robots.txt") ? response("", 404) : response("", 302, { location: "/program" }));
  await assert.rejects(looping.fetchSource(url), /Too many redirects/);
  assert.equal(looping.calls.length, 6);
});
test("each redirected path is checked against robots", async () => {
  const net = network((target) => target.endsWith("robots.txt") ? response("User-agent: *\nDisallow: /private") : response("", 302, { location: "/private" }));
  await assert.rejects(net.fetchSource(url), /disallows/);
  assert.equal(net.calls.length, 2);
});
test("rate limits pause the host; no aggressive retry", async () => {
  const net = network((target) => target.endsWith("robots.txt") ? response("", 404) : response("Slow down", 429));
  await assert.rejects(net.fetchSource(url), /HTTP 429/);
  await assert.rejects(net.fetchSource(url), /Host paused/);
  assert.equal(net.calls.length, 2);
});
test("fetch respects crawl delays and captures metadata", async () => {
  const net = network((target) => target.endsWith("robots.txt") ? response("User-agent: *\nCrawl-delay: 3") : response(html, 200, { etag: "test-v1" }));
  const source = await net.fetchSource(url);
  await net.fetchSource(url);
  assert.equal(net.calls.filter((target) => target.endsWith("robots.txt")).length, 1);
  assert.ok(net.delays.slice(1).every((delay) => delay >= 3000));
  assert.equal(source.etag, "test-v1");
  assert.equal(source.mediaType, "text/html");
  assert.ok(source.retrievedAt);
});
test("oversized responses and unsupported content fail closed", async () => {
  for (const headers of [{ "content-length": String(MAX_BYTES + 1) }, { "content-type": "application/zip" }]) {
    const net = network((target) => target.endsWith("robots.txt") ? response("", 404) : response("", 200, headers));
    await assert.rejects(net.fetchSource(url), /size limit|Unsupported/);
  }
});
test("concurrent callers are serialized and streamed bodies enforce the byte limit", async () => {
  const net = network((target) => target.endsWith("robots.txt") ? response("", 404) : response(html));
  await Promise.all([net.fetchSource(url), net.fetchSource(`${url}/second`)]);
  assert.equal(net.calls.filter((target) => target.endsWith("robots.txt")).length, 1);
  assert.ok(net.delays.slice(1).every((delay) => delay >= 1200));
  const large = network((target) => target.endsWith("robots.txt") ? response("", 404) : response(Buffer.alloc(MAX_BYTES + 1)));
  await assert.rejects(large.fetchSource(url), /size limit/);
});
test("HTML parser preserves nested-list labels, entities, and bounded official link discovery", async () => {
  const source = await parseSource(fetched(), hosts);
  assert.doesNotMatch(source.text, /Not admission content/);
  assert.match(source.text, /Language alternatives/);
  assert.match(source.text, /Test A & Test B/);
  assert.deepEqual(source.links.map((link) => link.url), ["https://university.example.invalid/regulation.pdf"]);
  assert.equal(source.contentHash, hash(Buffer.from(html)));
});

function syntheticPdf(text) {
  // Minimal valid text PDF fixture, generated without a PDF-writing dependency.
  const stream = `BT /F1 12 Tf 50 750 Td (${text}) Tj ET`;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const start = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(pdf);
}
test("PDF extraction records readable text and page locators", async () => {
  const source = await parseSource({ ...fetched(), mediaType: "application/pdf", bytes: syntheticPdf("Synthetic policy: at least 20 ECTS.") }, hosts);
  assert.match(source.text, /at least 20 ECTS/);
  assert.equal(source.blocks[0].locator, "PDF page 1");
});
test("empty/scanned-only PDF and empty HTML require manual extraction", async () => {
  await assert.rejects(parseSource({ ...fetched(), mediaType: "application/pdf", bytes: syntheticPdf("") }, hosts), /No readable source text/);
  await assert.rejects(parseSource(fetched("<html><body><script>ignored</script></body></html>"), hosts), /No readable/);
});
test("structured extraction is anchored, source-bound and always unverified", async () => {
  const { program, snapshot, snapshots } = await fixture();
  assert.equal(programSchema.safeParse(program).success, true);
  assert.deepEqual(program.requirements[0].rule, { type: "subject_ects", subject: "Mathematics", minimum: 30 });
  assert.equal(program.requirements[1].rule.accepted[0].minLevel, "C1");
  assert.equal(program.verificationStatus, "unverified");
  assert.equal(program.requirementsComplete, false);
  assert.deepEqual(program.validFor, []);
  assert.equal(program.facts.find((fact) => fact.id === "tuition").value, null);
  const evidence = program.requirements[0].evidence[0];
  assert.equal(evidence.snapshotId, snapshot.id);
  assertEvidence(evidence, snapshots);
});
test("missing anchors and ambiguous scalars stay manual, never invented", async () => {
  const { snapshot } = await fixture();
  const config = seed(); config.extract[0].anchor = "not present";
  let program = extractProgram(config, { source: snapshot }, {}, now.toISOString());
  assert.equal(program.facts[0].value, null);
  assert.equal(program.requirements[0].rule.type, "manual");
  config.extract[0].anchor = "English C1";
  program = extractProgram(config, { source: snapshot }, {}, now.toISOString());
  assert.equal(program.requirements[0].rule.type, "manual");
  const ambiguous = await parseSource(fetched("<p>At least 30 ECTS or at least 20 ECTS with bridging.</p>"), hosts);
  config.extract[0].anchor = "At least";
  assert.equal(extractProgram(config, { source: ambiguous }, {}, now.toISOString()).requirements[0].rule.type, "manual");
  const alternative = await parseSource(fetched("<p>At least 30 ECTS or relevant professional experience.</p>"), hosts);
  assert.equal(extractProgram(config, { source: alternative }, {}, now.toISOString()).requirements[0].rule.type, "manual");
});
test("a missing contextual anchor invalidates the whole extraction, not just the exception", async () => {
  const { snapshot } = await fixture();
  const config = seed(); config.extract[0].anchors = ["at least 30 ECTS", "missing exception clause"];
  assert.equal(extractProgram(config, { source: snapshot }, {}, now.toISOString()).facts[0].value, null);
});
test("fabricated evidence, wrong URLs, hashes or locators are rejected", async () => {
  const { program, snapshots } = await fixture();
  const evidence = program.requirements[0].evidence[0];
  for (const change of [{ quote: "Invented 999 ECTS" }, { url: `${url}/fake` }, { contentHash: "bad" }, { locator: "invented section" }, { sourceType: "user" }]) assert.throws(() => assertEvidence({ ...evidence, ...change }, snapshots));
});
test("rechecks do not create revisions, while source/rule changes do", async () => {
  const { program } = await fixture();
  const rechecked = structuredClone(program); rechecked.sources[0].lastChecked = "2026-10-19"; rechecked.retrievedAt = "2026-10-19";
  assert.equal(revisionFor(program), revisionFor(rechecked));
  const changed = structuredClone(program); changed.sources[0].contentHash = "new-content";
  assert.notEqual(revisionFor(program), revisionFor(changed));
  assert.deepEqual(differences(program, changed).map((item) => [item.collection, item.change]), [["sources", "changed"]]);
  changed.requirements[0].rule.minimum = 40;
  assert.ok(differences(program, changed).some((item) => item.collection === "requirements" && item.change === "changed"));
});
test("requirement diffs identify additions and removals", async () => {
  const { program } = await fixture();
  const changed = structuredClone(program); changed.requirements.shift(); changed.requirements.push({ ...program.requirements[0], id: "new-rule" });
  const diff = differences(program, changed).filter((item) => item.collection === "requirements");
  assert.deepEqual(diff.map((item) => item.change).sort(), ["added", "removed"]);
});
test("review templates cannot approve data; explicit sourced human review can", async () => {
  const { program, snapshots } = await fixture();
  assert.throws(() => applyReview(program, reviewTemplate(program), snapshots, schema, now), /reviewer/);
  const editable = reviewTemplate(program); editable.requirements[0].requirement.rule.minimum = 999;
  assert.equal(program.requirements[0].rule.minimum, 30, "review drafts cannot mutate captured program data");
  const review = approvedReview(program);
  const reviewed = applyReview(program, review, snapshots, schema, now);
  assert.equal(reviewed.verificationStatus, "verified");
  assert.equal(reviewed.requirementsComplete, true);
  assert.equal(reviewed.sources[0].reviewedBy, "Synthetic test reviewer");
  assert.notEqual(reviewed.catalogVersion, program.catalogVersion, "editorial changes version engine equivalence bindings");
  assert.equal(reviewed.catalogDraftVersion, program.catalogVersion);
  const pending = structuredClone(review); pending.requirementsComplete = false; pending.requirements[0].decision = "pending";
  assert.equal(applyReview(program, pending, snapshots, schema, now).verificationStatus, "unverified");
});
test("stale review revisions, unknown facts, missing applicability and future reviews fail", async () => {
  const { program, snapshots } = await fixture();
  for (const mutate of [r => { r.revision = "old"; }, r => { r.applicability.semesters = []; }, r => { r.applicability.evidence = []; }, r => { r.reviewedAt = "2027-01-01"; }, r => { r.facts.find((f) => f.id === "tuition").decision = "approve"; }, r => { r.sources = []; }, r => { r.requirements[0].requirement.evidence[0].quote = "Fabricated evidence"; }]) {
    const review = approvedReview(program); mutate(review);
    assert.throws(() => applyReview(program, review, snapshots, schema, now));
  }
});
test("unsupported inventory cannot be promoted as complete; changed review gets a new version", async () => {
  const { program, snapshots } = await fixture();
  const review = approvedReview(program);
  const first = applyReview(program, review, snapshots, schema, now);
  review.requirements[0].requirement.rule.minimum = 40;
  assert.notEqual(applyReview(program, review, snapshots, schema, now).catalogVersion, first.catalogVersion);
  review.requirements[0].requirement.rule = { type: "manual", explanation: "Not yet modeled" };
  assert.throws(() => applyReview(program, review, snapshots, schema, now), /Incomplete or unsupported/);
});
test("review cannot forge source last-checked timestamps", async () => {
  const { program, snapshots } = await fixture();
  const review = approvedReview(program); review.requirements[0].requirement.evidence[0].lastChecked = "2099-01-01";
  assert.equal(applyReview(program, review, snapshots, schema, now).requirements[0].evidence[0].lastChecked, program.sources[0].lastChecked);
});
test("source failures preserve evidence but make the catalog stale", async () => {
  const { program } = await fixture();
  const stale = markStale(program, "Synthetic robots denial");
  assert.equal(stale.verificationStatus, "stale");
  assert.equal(stale.facts[0].value, program.facts[0].value);
  assert.equal(stale.requirements[0].evidence[0].status, "stale");
  const expired = readCatalog([program], new Date("2028-01-01"))[0];
  assert.equal(expired.verificationStatus, "stale");
  assert.equal(expired.facts[0].evidence[0].status, "stale");
});
test("reviewed synthetic catalog integrates with Engine V2 and mandatory failures", async () => {
  const { program, snapshots } = await fixture();
  const review = approvedReview(program);
  // A deliberately synthetic, evidence-backed language-only catalog fixture.
  review.requirements = review.requirements.filter((entry) => entry.requirement.id === "language");
  review.removedRequirements.push({ id: "math", reason: "This synthetic regression tests a language-only policy.", evidence: program.requirements[0].evidence });
  const published = applyReview(program, review, snapshots, schema, now);
  const evidence = { documentId: "doc", quote: "English C1", reviewedAt: "2026-10-18" };
  const profile = { id: "local-profile", courses: [], workExperience: "", updatedAt: "2026-10-18", languageCertificates: [{ language: "English", level: "C1", evidence }] };
  const docs = [{ id: "doc", kind: "language-certificate", fileName: "synthetic.txt", text: "English C1", status: "parsed", createdAt: "2026-10-18" }];
  const options = { semester: "2026-winter", asOf: now.toISOString() };
  assert.equal(analyzeFit(profile, docs, published, options).verdict, "strong_fit");
  profile.languageCertificates[0].level = "B1"; evidence.quote = "English B1"; docs[0].text = "English B1";
  assert.equal(analyzeFit(profile, docs, published, options).verdict, "not_recommended");
  assert.equal(analyzeFit(profile, docs, program, options).verdict, "not_enough_data");
});
test("five real pilot records have captured evidence, explicit unknowns, and no automatic approval", () => {
  const programs = json("../src/data/catalogPrograms.json");
  const state = json("../catalog/current.json");
  assert.equal(programs.length, 5);
  assert.equal(new Set(programs.map((program) => program.university)).size, 5);
  let pdf = false;
  for (const program of readCatalog(programs, now)) {
    assert.equal(program.origin, "catalog");
    assert.equal(program.isDemo, false);
    assert.notEqual(program.verificationStatus, "verified");
    assert.equal(program.requirementsComplete, false);
    const version = json(`../catalog/versions/${program.id}/${state.programs[program.id].revision}.json`);
    assert.equal(revisionFor(version.program), program.catalogVersion);
    const sources = Object.fromEntries(program.sources.map((source) => [source.snapshotId, json(`../catalog/snapshots/${source.snapshotId}.json`)]));
    for (const snapshot of Object.values(sources)) pdf ||= snapshot.mediaType === "application/pdf";
    for (const fact of program.facts) {
      if (fact.value !== null) assert.ok(fact.evidence.length);
      fact.evidence.forEach((citation) => assertEvidence(citation, sources));
    }
    assert.equal(analyzeFit(undefined, [], program, { semester: "2026-winter", asOf: now.toISOString() }).verdict, "not_enough_data");
  }
  assert.ok(pdf, "pilot exercises real PDF capture");
});
test("catalog UI exposes review status, unknowns, source links and no acceptance probabilities", async () => {
  const { program } = await fixture();
  const markup = renderToStaticMarkup(React.createElement(CatalogEvidence, { program }));
  assert.match(markup, /Official sources \/ unverified/);
  assert.match(markup, /not established/);
  assert.match(markup, /unknown/);
  assert.match(markup, /university.example.invalid/);
  const card = renderToStaticMarkup(React.createElement(ProgramCard, { program, onOpen: () => {} }));
  assert.match(card, /unverified/);
  assert.doesNotMatch(card, /\d+%/);
  assert.equal(catalogStatusLabel(markStale(program, "failed")), "Source check needed");
});
test("program Q&A preserves per-document citations and catalog uncertainty without AI calls", async () => {
  const { program } = await fixture();
  program.facts[1].evidence[0].url = "https://university.example.invalid/language-policy.pdf";
  const result = await askAboutProgram("English", program, { endpoint: "", apiKey: "", model: "" });
  assert.equal(result.status, "answered");
  assert.match(result.warning, /unverified/);
  assert.equal(result.citations[0].sourceUrl, "https://university.example.invalid/language-policy.pdf");
  assert.equal(result.citations[0].verificationStatus, "unverified");
  const unknown = await askAboutProgram("tuition", program, { endpoint: "", apiKey: "", model: "" });
  assert.match(unknown.answer, /Information unknown/);
  assert.equal(unknown.citations[0].sourceUrl, undefined);
});

test("fee table extraction binds program, degree and amount in one source row", async () => {
  const snapshot = await parseSource(fetched('<main><table><tr><th>Program</th><th>Degree</th><th>Fee</th></tr><tr><td>Synthetic Analytics</td><td>Bachelor</td><td>1000</td></tr><tr><td>Synthetic Analytics</td><td>Master</td><td>4000</td></tr></table></main>'), hosts);
  const config = seed(); config.extract = [{ id: "tuition", category: "tuition", source: "source", anchor: "Synthetic Analytics | Master | 4000" }];
  const program = extractProgram(config, { source: snapshot }, {}, now.toISOString());
  assert.equal(program.facts[0].value, "Synthetic Analytics | Master | 4000");
  assert.match(program.facts[0].evidence[0].locator, /table row/);
  assert.doesNotMatch(program.facts[0].value, /1000/);
  assertEvidence(program.facts[0].evidence[0], { [snapshot.id]: snapshot });
});

test("bounded PDF-style clause extraction retains an exact quote and fails on missing boundaries", async () => {
  const snapshot = await parseSource(fetched('<p>Other section. START At least 10 ECTS of research or equivalent work. END Curriculum 120 ECTS.</p>'), hosts);
  const config = seed(); config.extract[0] = { ...config.extract[0], anchor: "10 ECTS", quoteFrom: "START", quoteUntil: "END" };
  const program = extractProgram(config, { source: snapshot }, {}, now.toISOString());
  assert.equal(program.facts[0].value, "START At least 10 ECTS of research or equivalent work.");
  assert.equal(program.requirements[0].rule.type, "manual", "the equivalent-work alternative cannot be dropped");
  assertEvidence(program.facts[0].evidence[0], { [snapshot.id]: snapshot });
  config.extract[0].quoteUntil = "missing boundary";
  assert.equal(extractProgram(config, { source: snapshot }, {}, now.toISOString()).facts[0].value, null);
});

test("human review cannot silently remove a draft requirement or use an unsupported removal", async () => {
  const { program, snapshots } = await fixture();
  const review = approvedReview(program);
  delete review.removedRequirements;
  assert.throws(() => applyReview(program, review, snapshots, schema, now), /omitted draft requirement/);
  review.removedRequirements = [{ id: "inventory-review", reason: "", evidence: [] }];
  assert.throws(() => applyReview(program, review, snapshots, schema, now), /rationale and source evidence/);
  review.removedRequirements = [{ id: "inventory-review", reason: "Synthetic rationale", evidence: [{ ...program.sources[0], quote: "Invented removal basis" }] }];
  assert.throws(() => applyReview(program, review, snapshots, schema, now), /quote or locator/);
});

test("generated evidence checklists preserve source failures, retrieval dates and pending approval", async () => {
  const { program } = await fixture();
  const before = JSON.stringify(program);
  const config = seed(); config.sources.push({ id: "blocked", url: `${url}/blocked.pdf` });
  const report = renderReviewReport(program, config, { source: { lastAttempt: "2026-10-21", lastSuccessfulCheck: "2026-10-21", snapshotId: "test" }, blocked: { lastAttempt: "2026-10-21", error: "robots.txt disallows this source" } });
  assert.match(report, /no human approval/);
  assert.match(report, /robots.txt disallows/);
  assert.match(report, /2026-10-21/);
  assert.match(report, /Missing evidence/);
  assert.match(report, /snapshots\//);
  assert.equal(JSON.stringify(program), before);
});

test("audited pilot retains material exceptions, exact fee rows and source-stated intake scope", () => {
  const programs = json("../src/data/catalogPrograms.json");
  const fact = (id, factId) => programs.find((p) => p.id.includes(id)).facts.find((f) => f.id === factId);
  assert.match(fact("passau", "research-credits").value, /mindestens 10 ECTS/);
  assert.match(fact("passau", "research-credits").value, /andere.*wissenschaftliche Arbeit/);
  assert.match(fact("saarland", "accepted-certificates").value, /IELTS.*7.0/);
  assert.match(fact("saarland", "accepted-certificates").value, /95 out of 120.*2026: 5/);
  assert.match(fact("saarland", "accepted-certificates").value, /Only native speakers/);
  assert.equal(programs.find((p) => p.id.includes("saarland")).requirements.find((r) => r.id === "language").rule.type, "manual");
  assert.match(fact("fau", "tuition").value, /Data Science\* \| Master of Science \| Yes \| 4,000 euros/);
  assert.doesNotMatch(fact("fau", "tuition").value, /Bachelor of Science \| Yes \| 1,000/);
  assert.match(fact("fau", "tuition").value, /summer semester 2027/);
  assert.match(fact("fau", "application-fee").value, /winter semester 2026\/27.*100 euros/);
  assert.match(fact("fau", "intake-dates").value, /Sommersemester 2027/);
  assert.match(fact("fau", "intake-dates").value, /Data Science \(M.Sc.\)/);
  assert.equal(fact("fau", "credits").value, null, "curriculum ECTS do not become admission credits");
  assert.match(fact("stuttgart", "grades").value, /should be better than/);
  assert.match(fact("stuttgart", "aps").value, /scholarship from Germany or the EU/);
  assert.match(fact("tuhh", "credits").value, /30 CP/);
  for (const program of programs) {
    assert.notEqual(program.verificationStatus, "verified");
    assert.deepEqual(program.validFor, []);
    assert.equal(program.requirementsComplete, false);
    assert.ok(program.requirements.every((req) => req.rule.type === "manual"));
  }
});

const pilotProfile = () => {
  const reviewedAt = "2026-10-20";
  const text = "Bachelor of Science completed. Computer Science. Total 180 ECTS. Mathematics 5 ECTS. Algorithms 6 ECTS. English IELTS Academic C1 overall 7.0.";
  const evidence = (quote) => ({ documentId: "synthetic-applicant", quote, reviewedAt });
  return {
    profile: { id: "local-profile", degree: "Bachelor of Science", degreeType: "bachelor", degreeCompleted: true, field: "Computer Science", ects: "180", evidence: { degree: evidence("Bachelor of Science completed."), field: evidence("Computer Science."), ects: evidence("Total 180 ECTS.") }, courses: ["Mathematics", "Algorithms"], academicCourses: [{ id: "math", title: "Mathematics", ects: 5, evidence: evidence("Mathematics 5 ECTS.") }, { id: "algorithms", title: "Algorithms", ects: 6, evidence: evidence("Algorithms 6 ECTS.") }], transcriptComplete: true, courseEquivalences: [], languageCertificates: [{ language: "English", test: "IELTS Academic", level: "C1", score: 7, evidence: evidence("English IELTS Academic C1 overall 7.0.") }], workExperience: "", updatedAt: reviewedAt, reviewedAt },
    documents: [{ id: "synthetic-applicant", kind: "transcript", fileName: "synthetic-applicant.txt", text, status: "parsed", createdAt: reviewedAt }],
    semester: "2027-summer",
  };
};
for (const [name, mutate] of [
  ["complete CS graduate with language evidence", () => {}],
  ["incomplete first degree and partial transcript", (fixture) => { fixture.profile.degreeCompleted = false; fixture.profile.transcriptComplete = false; delete fixture.profile.evidence.degree; }],
  ["few subject credits and unsupported course equivalence", (fixture) => { fixture.profile.academicCourses[0].ects = 2; fixture.profile.academicCourses[0].evidence.quote = "Mathematics 2 ECTS."; fixture.documents[0].text = fixture.documents[0].text.replace("Mathematics 5", "Mathematics 2"); }],
  ["missing language certificates", (fixture) => { fixture.profile.languageCertificates = []; }],
  ["wrong test variant and weak language evidence", (fixture) => { fixture.profile.languageCertificates = [{ language: "English", test: "IELTS General", level: "B1", score: 4 }]; }],
  ["old certificate with unsupported expiry assessment", (fixture) => { fixture.profile.languageCertificates[0].date = "2022-01-01"; }],
  ["unestablished admission semester", (fixture) => { fixture.semester = "2025-winter"; }],
  ["invented document excerpt", (fixture) => { fixture.profile.evidence.ects.quote = "Total 999 ECTS."; }],
]) {
  test(`real pilot safety regression: ${name}`, () => {
    for (const program of json("../src/data/catalogPrograms.json")) {
      const fixture = pilotProfile(); mutate(fixture);
      const result = analyzeFit(fixture.profile, fixture.documents, program, { semester: fixture.semester, asOf: now.toISOString() });
      assert.equal(result.verdict, "not_enough_data", `${program.university}: no unreviewed record can establish eligibility or rejection`);
      assert.ok(result.checks.every((check) => !check.hardBlocker));
      assert.ok(result.sourceIssues.some((issue) => /not been verified|source status/.test(issue)));
      assert.ok(result.sourceIssues.some((issue) => /semester/.test(issue)));
    }
  });
}
