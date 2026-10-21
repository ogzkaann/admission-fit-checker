const escape = (value) => String(value ?? "").replace(/[\\`*_[\]<>|]/g, "\\$&").replace(/\s+/g, " ").trim();
const preview = (value, length = 200) => escape(value.length > length ? `${value.slice(0, length)}...` : value);

export function renderReviewReport(program, seed, observations) {
  const evidence = [];
  function refs(citations = []) {
    return citations.map((citation) => {
      let index = evidence.findIndex((item) => item.snapshotId === citation.snapshotId && item.locator === citation.locator && item.quote === citation.quote);
      if (index < 0) { index = evidence.length; evidence.push(citation); }
      return `[E${index + 1}](#e${index + 1})`;
    }).join(", ") || "Missing evidence";
  }
  const lines = [
    `# ${escape(program.university)}: ${escape(program.programName)}`,
    "", `Draft: \`${program.catalogDraftVersion ?? program.catalogVersion}\``, "",
    `Catalog status: **${program.verificationStatus}**. Inventory complete: **${program.requirementsComplete ? "yes" : "no"}**.`,
    `Admission-semester validity: **${program.validFor?.join(", ") || "not established"}**.`,
    "This evidence checklist records no human approval. Preview quotations are abbreviated; open the bound snapshot and official document to check complete clauses and exceptions.", "",
    "## Source Checks", "", "| Source | Latest attempt (UTC) | Last successful check (UTC) | Result |", "| --- | --- | --- | --- |",
    ...seed.sources.map((source) => {
      const check = observations[source.id];
      return `| [${source.id}](<${source.url}>) | ${check?.lastAttempt ?? "Never"} | ${check?.lastSuccessfulCheck ?? "Never"} | ${escape(check?.error ?? (check?.snapshotId ? "Captured; unapproved" : "Not captured"))} |`;
    }), "", "## Requirement Checklist", "",
    ...program.requirements.map((requirement) => `- [ ] **${escape(requirement.label)}** (${requirement.mandatory === false ? "advisory" : "mandatory"}; ${requirement.rule?.type ?? "unsupported"}): ${refs(requirement.evidence)}.`),
    "", "## Captured Facts and Gaps", "", "| Fact | Captured preview | Evidence |", "| --- | --- | --- |",
    ...(program.facts ?? []).map((fact) => `| ${fact.category}: ${escape(fact.id)} | ${fact.value === null ? "**Unknown**" : preview(fact.value)}${fact.note ? ` Note: ${escape(fact.note)}` : ""} | ${refs(fact.evidence)} |`),
    "", "## Unresolved Review Items", "", ...(program.catalogIssues ?? []).map((issue) => `- [ ] ${escape(issue)}`),
    "- [ ] Establish the controlling regulation, amendment history and applicant scope.",
    "- [ ] Verify source-stated semester applicability; capture missing evidence before approval.",
    "- [ ] Resolve all manual rules and omitted clauses before declaring the inventory complete.",
    "- [ ] A named human reviewer records source, fact and requirement decisions using the revision-specific review template.",
    "", "## Bound Evidence", "",
  ];
  evidence.forEach((source, index) => {
    lines.push(`### E${index + 1}`, "", `[Official source](<${source.url}>) | ${escape(source.locator)} | captured ${source.retrievedAt ?? "unknown"} | checked ${source.lastChecked ?? "unknown"} | ${source.status}`, "", `> ${preview(source.quote, 320)}`, "", `[Full captured snapshot](../snapshots/${source.snapshotId}.json); raw-content SHA-256: \`${source.contentHash}\`.`, "");
  });
  return `${lines.join("\n")}\n`;
}
