// TEST ONLY. No university requirements or real applicant/reviewer identities.
export const semester = "2026-winter";
export const asOf = "2026-10-21T20:00:00Z";
export const source = (quote = "Fictional fully reviewed test policy; NOT Passau admission requirements.") => ({ url: "https://synthetic.example.invalid/test-policy", quote, status: "verified", sourceType: "official", reviewedBy: "Fictional test reviewer", lastChecked: "2026-10-20", validFor: [semester], locator: "Synthetic fixture only" });
const requirement = (id, rule, extra = {}) => ({ id, kind: "academic", label: `Fictional ${id}`, mandatory: true, rule, evidence: [source()], ...extra });
export function policy() {
  return {
    id: "synthetic-transcript-policy", university: "Fictional test institution (NOT Passau)", programName: "Synthetic policy demonstration", degreeType: "master", language: "English", country: "Germany", city: "", description: "Test policy only", requiredDocuments: [], origin: "catalog", isDemo: false, schemaVersion: 2, createdAt: "2026-10-20", catalogVersion: "synthetic-v1", verificationStatus: "verified", sources: [source()], validFor: [semester], requirementsComplete: true,
    requirements: [
      requirement("degree", { type: "degree", accepted: ["bachelor"], completionRequired: true }),
      requirement("duration", { type: "metric", metric: "degree_years", minimum: 3 }),
      requirement("field", { type: "field", accepted: ["Computer Science"], exhaustive: false }),
      requirement("grades", { type: "any", rules: [{ type: "metric", metric: "german_grade", maximum: 2.7 }, { type: "metric", metric: "cohort_top_percent", maximum: 70 }] }),
      requirement("cs", { type: "subject_ects", subject: "Fictional CS grouping", minimum: 110 }),
      requirement("research", { type: "subject_ects", subject: "Fictional research grouping", minimum: 10 }),
      requirement("english", { type: "any", rules: [{ type: "language", language: "English", accepted: [{ test: "IELTS Academic", minScore: 6.5 }] }, { type: "education_language", accepted: ["English"] }] }),
      requirement("german", { type: "language", language: "German", accepted: [{ test: "Goethe-Zertifikat A1", minLevel: "A1" }] }, { conditionalAdmission: { description: "Fictional A1 deferral authorized until 2027-10-01; outstanding proof must be submitted.", alternative: { type: "assessment", key: "german-a1-deferral", explanation: "Explicit fictional deferral decision" }, evidence: [source()] } }),
    ],
  };
}
export const cases = [
  { id: "eligible", verdict: "strong_fit" },
  { id: "ineligible", grade: 3.5, rank: 80, verdict: "not_recommended", check: "grades" },
  { id: "subject-shortage", cs: 100, verdict: "not_recommended", check: "cs" },
  { id: "missing-language", noEnglish: true, verdict: "not_enough_data", check: "english" },
  { id: "conditional", noGerman: true, deferral: true, verdict: "possible_risky", check: "german" },
  { id: "insufficient-evidence", pending: true, verdict: "not_enough_data", check: "cs" },
];
export function transcriptLines(scenario) {
  const cs = scenario.cs ?? 120;
  return ["SYNTHETIC TRANSCRIPT - NOT A REAL APPLICANT", "Name: Synthetic Applicant", "Degree: Bachelor completed", "Major: Computer Science", "Total ECTS: 180", "Standard degree duration: 3 years", `German grade: ${scenario.grade ?? 2.3}`, `Graduating cohort: top ${scenario.rank ?? 50}%`,
    ...["Algorithms", "Software Engineering", "Databases", "Computer Networks", "Operating Systems", "Theoretical Computer Science"].map((title) => `Module: ${title} | ${cs / 6} ECTS`),
    "Module: Independent Scientific Project | 12 ECTS", `Module: General Studies | ${180 - cs - 12} ECTS`,
    ...(!scenario.noEnglish ? ["English: IELTS Academic 7.0"] : []), ...(!scenario.noGerman ? ["German: Goethe-Zertifikat A1"] : []),
    ...(scenario.deferral ? ["Fictional institution authorized German A1 deferral until 2027-10-01."] : []),
    "All names, documents, course-group judgments and policies are fictional test data.",
  ];
}
export function transcriptPdf(lines) {
  const escape = (line) => line.replace(/([\\()])/g, "\\$1");
  const stream = `BT /F1 10 Tf 35 755 Td ${lines.map((line, i) => `${i ? '0 -24 Td ' : ''}(${escape(line)}) Tj`).join(' ')} ET`;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const start = Buffer.byteLength(pdf);
  return Buffer.from(pdf + `xref\n0 6\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`);
}

// Simulates explicit review AFTER extraction. No title-based equivalence inference.
export function reviewDraft(draft, text, scenario, program = policy()) {
  const evidence = (quote) => ({ documentId: "synthetic-doc", quote, reviewedAt: "2026-10-20" });
  const profile = { ...draft, degreeType: "bachelor", degreeCompleted: true, field: "Computer Science", reviewedAt: "2026-10-20", transcriptComplete: !scenario.pending,
    evidence: { degree: evidence("Degree: Bachelor completed"), field: evidence("Major: Computer Science"), ects: evidence("Total ECTS: 180") },
    metrics: { degree_years: { value: 3, evidence: evidence("Standard degree duration: 3 years") }, german_grade: { value: scenario.grade ?? 2.3, evidence: evidence(`German grade: ${scenario.grade ?? 2.3}`) }, cohort_top_percent: { value: scenario.rank ?? 50, evidence: evidence(`Graduating cohort: top ${scenario.rank ?? 50}%`) } },
    languageCertificates: draft.languageCertificates.map((cert) => ({ ...cert, evidence: evidence(text.split('\n').find((line) => line.startsWith(`${cert.language}:`))) })),
    academicCourses: draft.academicCourses.map((course) => ({ ...course, evidence: evidence(text.split('\n').find((line) => line.startsWith(`Module: ${course.title} |`))) })), courseEquivalences: [],
  };
  // Explicit fixture review: rows 0..5 CS, row 6 research, row 7 neither.
  profile.academicCourses.forEach((course, index) => ['cs', 'research'].forEach((id) => profile.courseEquivalences.push({ courseId: course.id, programId: program.id, catalogVersion: program.catalogVersion, requirementId: id, semester, decision: scenario.pending && index === 0 ? 'pending' : (id === 'cs' ? index < 6 : index === 6) ? 'accepted' : 'rejected', evidence: source() })));
  if (scenario.deferral) {
    const quote = "Fictional institution authorized German A1 deferral until 2027-10-01.";
    profile.admissionAssessments = [{ programId: program.id, catalogVersion: program.catalogVersion, requirementId: 'german', assessmentKey: 'german-a1-deferral', semester, decision: 'accepted', validUntil: '2027-10-01T23:59:59Z', evidence: source(quote), profileEvidence: evidence(quote) }];
  }
  return profile;
}
