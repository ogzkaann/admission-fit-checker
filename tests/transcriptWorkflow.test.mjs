import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { hasUnsupportedRule } from "../scripts/catalog/core.mjs";
import { cases, policy, transcriptLines, transcriptPdf, reviewDraft, semester, asOf, source } from "./fixtures/transcriptCases.mjs";
const require = createRequire(import.meta.url);
const { textFromPdfItems } = require('../.test-build/rag/pdfText.js');
const { extractProfileFromDocumentText, heuristicExtractProfile } = require('../.test-build/ai/profileExtraction.js');
const { applyExtracted } = require('../.test-build/domain/profileDraft.js');
const { academicProfileSchema } = require('../.test-build/domain/schemas.js');
const { analyzeFit } = require('../.test-build/domain/fit/admissionFit.js');
const { renderToStaticMarkup } = require('react-dom/server');
const { createElement } = require('react');
const { FitResult } = require('../.test-build/components/FitResult.js');
const empty = { id: 'local-profile', courses: [], languageCertificates: [], workExperience: '', updatedAt: '2026-10-20' };
export async function extractScenario(scenario) {
  const pdf = await getDocument({ data: new Uint8Array(transcriptPdf(transcriptLines(scenario))), useSystemFonts: true, isEvalSupported: false }).promise;
  let text;
  try { text = textFromPdfItems((await (await pdf.getPage(1)).getTextContent()).items); } finally { await pdf.destroy(); }
  const extraction = await extractProfileFromDocumentText(text, { apiKey: '', endpoint: '', model: '' });
  assert.equal(extraction.method, 'local-heuristic');
  const draft = applyExtracted(empty, extraction.profile);
  const documents = [{ id: 'synthetic-doc', kind: 'transcript', fileName: `${scenario.id}-synthetic.pdf`, text, status: 'parsed', createdAt: '2026-10-20' }];
  return { draft, text, documents };
}
for (const scenario of cases) test(`PDF -> extraction -> explicit fixture review -> result: ${scenario.id}`, async () => {
  const { draft, text, documents } = await extractScenario(scenario);
  assert.equal(draft.field, 'Computer Science', 'PDF rows must not merge labeled fields');
  assert.equal(draft.ects, '180');
  assert.equal(draft.academicCourses.length, 8);
  assert.equal(draft.reviewedAt, undefined);
  assert.equal(analyzeFit(draft, documents, policy(), { semester, asOf }).verdict, 'not_enough_data', 'extraction cannot approve evidence');
  const profile = academicProfileSchema.parse(reviewDraft(draft, text, scenario));
  const result = analyzeFit(profile, documents, policy(), { semester, asOf });
  assert.equal(result.verdict, scenario.verdict);
  if (scenario.check) assert.ok(result.checks.find((check) => check.requirementId === scenario.check).status !== 'met');
  assert.ok(result.checks.filter((check) => check.status === 'met' || check.hardBlocker || check.status === 'conditional').every((check) => check.profileEvidence.length));
  assert.equal(result.citations.length, 9);
  const html = renderToStaticMarkup(createElement(FitResult, { analysis: result }));
  assert.match(html, /not official admission advice/);
  if (scenario.verdict === 'not_recommended') assert.match(html, /Hard blocker/);
  if (scenario.deferral) assert.match(html, /2027-10-01/);
  const real = JSON.parse(readFileSync('src/data/catalogPrograms.json')).find((program) => program.id === 'de-passau-msc-computer-science');
  const actual = analyzeFit(profile, documents, real, { semester, asOf });
  assert.equal(actual.verdict, 'not_enough_data', 'fictional approvals cannot verify Passau');
  assert.ok(actual.checks.every((check) => !check.hardBlocker));
  mkdirSync('artifacts/transcript-demo', { recursive: true });
  writeFileSync(`artifacts/transcript-demo/${scenario.id}.pdf`, transcriptPdf(transcriptLines(scenario)));
  writeFileSync(`artifacts/transcript-demo/${scenario.id}.json`, JSON.stringify({ warning: 'SYNTHETIC TEST ONLY; not a Passau policy or real applicant', extractedDraft: draft, reviewedFixtureProfile: profile, syntheticPolicyResult: result, realPassauResult: actual }, null, 2));
});

test('alternatives retain unknown routes; a bad grade alone is not an exhaustive failure', async () => {
  const scenario = cases[0]; const { draft, text, documents } = await extractScenario(scenario);
  const profile = reviewDraft(draft, text, scenario); delete profile.metrics.cohort_top_percent;
  profile.metrics.german_grade = { value: 3.5, evidence: { documentId: 'synthetic-doc', quote: 'German grade: 3.5', reviewedAt: '2026-10-20' } }; documents[0].text += '\nGerman grade: 3.5';
  assert.equal(analyzeFit(profile, documents, policy(), { semester, asOf }).checks.find(c => c.requirementId === 'grades').status, 'unknown');
});
test('MOI requires an entire-degree documentary statement, not English course titles', async () => {
  const { draft, text, documents } = await extractScenario(cases[0]); const p = reviewDraft(draft, text, cases[0]); p.languageCertificates = p.languageCertificates.filter(c => c.language !== 'English');
  const quote = 'Entire qualifying degree taught exclusively in English.'; documents[0].text += '\n'+quote;
  p.educationLanguage = { language: 'English', evidence: { documentId: 'synthetic-doc', quote, reviewedAt: '2026-10-20' } };
  assert.equal(analyzeFit(p, documents, policy(), { semester, asOf }).verdict, 'strong_fit');
  p.educationLanguage.evidence.quote = 'English'; assert.equal(analyzeFit(p, documents, policy(), { semester, asOf }).verdict, 'not_enough_data');
});
test('university decisions cannot be reused across program versions or semesters', async () => {
  const scenario = cases.find(c=>c.deferral); const { draft, text, documents } = await extractScenario(scenario); const p = reviewDraft(draft, text, scenario);
  p.admissionAssessments[0].catalogVersion = 'old';
  assert.equal(analyzeFit(p, documents, policy(), { semester, asOf }).verdict, 'not_enough_data');
  assert.equal(analyzeFit(p, documents, policy(), { semester: '2027-summer', asOf }).verdict, 'not_enough_data');
  p.admissionAssessments[0].catalogVersion = 'synthetic-v1'; p.admissionAssessments[0].evidence = source('Unrelated official policy quote');
  assert.equal(analyzeFit(p, documents, policy(), { semester, asOf }).verdict, 'not_enough_data');
});
test('re-extraction invalidates all previously reviewed admissions and course evidence', () => {
  const p = { ...empty, metrics: { degree_years: { value: 3 } }, educationLanguage: { language: 'English' }, admissionAssessments: [{}], courseEquivalences: [{}], reviewedAt: asOf, academicCourses: [{ id:'x',title:'X',ects:10,evidence:{} }] };
  const draft = applyExtracted(p, {});
  assert.equal(draft.metrics, undefined); assert.equal(draft.educationLanguage, undefined); assert.deepEqual(draft.admissionAssessments, []); assert.deepEqual(draft.courseEquivalences, []); assert.equal(draft.academicCourses[0].evidence, undefined);
});
test('generic credits, CP and a single module are never guessed as total ECTS', () => {
  for (const text of ['Total credits: 180', 'Total CP: 180', 'Module: Algorithms | 20 ECTS', 'Total ECTS: 1800', 'Total ECTS: 180-210']) assert.equal(heuristicExtractProfile(text).ects, undefined);
  assert.equal(heuristicExtractProfile('Total ECTS: 179.5').ects, '179.5');
});

test('test variants stay distinct and nearby German levels do not attach to English proof', () => {
  const draft=heuristicExtractProfile('English: IELTS Academic 7.0\nEnglish: IELTS General Training 5.0\nGerman: Goethe-Zertifikat A1');
  assert.deepEqual(draft.languageCertificates.filter(c=>c.language==='English').map(c=>[c.test,c.score,c.level]),[['IELTS Academic',7,undefined],['IELTS General Training',5,undefined]]);
  assert.equal(heuristicExtractProfile('English: IELTS Academic 7.0; German A1').languageCertificates.find(c=>c.test==='IELTS Academic').level,undefined);
  assert.equal(heuristicExtractProfile('English: IELTS 7.0').languageCertificates[0].test,undefined);
});
test('nested unsupported conditions cannot be hidden in a complete editorial policy', () => {
  assert.equal(hasUnsupportedRule({ type:'any',rules:[{type:'degree',accepted:['bachelor'],completionRequired:true},{type:'all',rules:[{type:'manual',explanation:'Unresolved exception'}]}] }), true);
});

test('a provisional-degree decision never satisfies unconditional degree equivalence', async () => {
  const { draft, text, documents } = await extractScenario(cases[0]); const p = reviewDraft(draft, text, cases[0]);
  const pr = policy(); pr.requirements = [{ id:'degree', kind:'academic', label:'Fictional degree alternatives', mandatory:true, evidence:[source()], rule:{type:'any',rules:[{type:'degree',accepted:['bachelor'],completionRequired:true},{type:'assessment',key:'degree-equivalence',explanation:'Fictional completed equivalent degree'}]}, conditionalAdmission:{description:'Fictional provisional degree; final proof remains due',alternative:{type:'assessment',key:'provisional-degree',explanation:'Fictional provisional authorization'},evidence:[source()]} }];
  documents[0].text += '\nDegree: Bachelor not yet completed\nFictional provisional degree authorized.';
  p.degreeCompleted = false; p.evidence.degree.quote = 'Degree: Bachelor not yet completed';
  const quote = 'Fictional provisional degree authorized.';
  p.admissionAssessments = [{programId:pr.id,catalogVersion:pr.catalogVersion,requirementId:'degree',assessmentKey:'provisional-degree',semester,decision:'accepted',evidence:source(quote),profileEvidence:{documentId:'synthetic-doc',quote,reviewedAt:'2026-10-20'}}];
  const result = analyzeFit(p,documents,pr,{semester,asOf}); assert.equal(result.verdict,'possible_risky'); assert.equal(result.checks[0].status,'conditional');
  p.admissionAssessments[0].assessmentKey = 'unrelated'; assert.equal(analyzeFit(p,documents,pr,{semester,asOf}).verdict,'not_enough_data');
});
test('expired conditional authorization and unverified conditional sources remain unresolved', async () => {
  const scenario = cases.find(c=>c.deferral); const {draft,text,documents}=await extractScenario(scenario); const p=reviewDraft(draft,text,scenario); const pr=policy();
  assert.equal(analyzeFit(p,documents,pr,{semester,asOf:'2027-10-02T00:00:00Z'}).checks.find(c=>c.requirementId==='german').status,'unknown');
  pr.requirements.find(r=>r.id==='german').conditionalAdmission.evidence[0].status='unverified';
  const result=analyzeFit(p,documents,pr,{semester,asOf});assert.equal(result.verdict,'not_enough_data');assert.equal(result.checks.find(c=>c.requirementId==='german').reason,'source_uncertainty');
});

test('a provisionally met base rule does not request an irrelevant deferral', async () => {
  const {draft,text,documents}=await extractScenario(cases[0]);const p=reviewDraft(draft,text,cases[0]);const pr=policy();pr.verificationStatus='unverified';
  const check=analyzeFit(p,documents,pr,{semester,asOf}).checks.find(c=>c.requirementId==='german');
  assert.equal(check.status,'unknown');assert.equal(check.reason,'source_uncertainty');assert.doesNotMatch(check.detail,/conditional route exists/);
});
test('completion flags and MOI statements need semantically supporting excerpts', async () => {
  const {draft,text,documents}=await extractScenario(cases[0]);const p=reviewDraft(draft,text,cases[0]);p.degreeCompleted=false;
  assert.equal(analyzeFit(p,documents,policy(),{semester,asOf}).checks.find(c=>c.requirementId==='degree').status,'unknown');
  p.degreeCompleted=true;p.languageCertificates=p.languageCertificates.filter(c=>c.language!=='English');const quote='Entire programming course taught in English.';documents[0].text+='\n'+quote;p.educationLanguage={language:'English',evidence:{documentId:'synthetic-doc',quote,reviewedAt:'2026-10-20'}};
  assert.equal(analyzeFit(p,documents,policy(),{semester,asOf}).checks.find(c=>c.requirementId==='english').status,'unknown');
});
