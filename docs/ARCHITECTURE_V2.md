# Eligibility V2: Architecture Audit and Next Phase

## Scope and retained architecture

The initial production target is German master's admission eligibility. Bachelor's and Ausbildung are future tracks with separate rule inventories. This phase retains the local-first React/TypeScript application and its visual identity. It adds no scraping, server, authentication or credentials.

| Area | Audit finding | Decision |
| --- | --- | --- |
| Frontend | `App.tsx` coordinates the dashboard, profile, library and custom check. Components separate display from fit evaluation. | Retain homepage, navigation, styling, OCR imports and BYOK settings. Add evidence inputs and explanatory result groups. |
| Extraction | pdf.js reads selectable text; Tesseract handles images and up to five scanned pages, currently in English. Heuristics and optional BYOK AI suggest profile fields. | Retain as a draft-producing layer. Extraction cannot assert source verification or course equivalence. Review remains required before saving. |
| Extraction limits | The ECTS heuristic may select the largest adjacent number; nearby language mentions can be conflated; OCR is capped and mixed scanned/text PDFs can be incomplete. | Linked excerpts and explicit review reduce silent assumptions, but do not authenticate documents. Track page coverage and field provenance next. |
| Program model | Legacy requirements mix degree, field, ECTS and language. A source URL and date alone establish no authority. | Add discriminated rules, requirement-level sources, verification metadata, semester validity, completeness and catalog versions. Retain legacy fields through a read adapter. |
| Fit engine | Compound requirements short-circuited, shared field keywords counted as matches, and one failure could yield a favorable verdict. | Replace aggregation with mandatory blockers and explicit uncertainty. Only a sourced conditional alternative can override an otherwise blocking requirement. |
| Storage | Dexie version 1 stores documents, one profile and user programs; settings use localStorage. | Retain tables and IDs. Optional additive properties need no index migration. Normalize old programs on read, validate new writes, never silently promote verification. |
| Tests | No automated tests existed. The old lint command did not traverse project references. | Add Node built-in tests with synthetic fixtures, result rendering tests, and `tsc -b`. No test dependency added. |
| Documentation | Scoring docs described majority scoring; the roadmap still listed OCR as absent. | Update rules, product priority, validation commands and limitations. |

## Domain and trust boundaries

`src/domain/types.ts` defines serializable catalog, rule, source, transcript and evidence contracts. `eligibilitySchemas.ts` validates supported rules. AI extraction uses a narrower schema that cannot supply reviewed evidence. `src/domain/fit/admissionFit.ts` remains the only eligibility evaluator; it accepts an explicit semester and an injectable analysis date.

A profile comparison is confirmed only against a linked excerpt present in an available document and marked reviewed. This is user-reviewed transcription, not authenticated credentials, official equivalence or degree recognition. Structured degree level and completion are explicitly reviewed, not inferred from free-text titles.

A requirement is trusted only when program and requirement source records are official, verified by a named reviewer, checked within one year, not future-dated, and valid for the selected semester. The one-year ceiling is product policy, not a university rule. Source URLs are references, not proof of authority. Verification metadata is currently a local data assertion; there is no trusted reviewer service. Existing UI flows cannot promote pasted text to verified catalog data.

Missing source provenance preserves provisional comparisons but makes requirements unresolved. Demo and pasted-text rules cannot produce confirmed eligibility or blockers. A complete verified requirement inventory is required for a positive result. Unsupported GPA, aptitude, recognition and document-certification rules remain unknown. No score threshold drives decisions. The deprecated `score` field represents confirmed mandatory-rule coverage, not admission probability, and is not displayed.

Subject ECTS uses course credit records and explicit accepted/rejected equivalence decisions bound to program ID, catalog version, requirement ID and semester. Names alone never establish equivalence. Partial transcripts, pending mappings, duplicate evidence and cross-subject credit reuse stay uncertain. Sufficient confirmed credits can pass before the full transcript is mapped; a confirmed shortfall requires a complete reviewed inventory. Partial credit allocation and explicit credit-sharing policies are not modeled yet.

Language rules support exact certificate variants, CEFR levels, overall scores and component minimums. Alternatives are evaluated across all certificates. Provider names are not certificate variants; score-to-CEFR conversions are never inferred. Expiry, exemptions and country-specific proof require additional explicit rules.

## Verified German university ingestion: next phase

1. Start with a small human-curated set of German master's programs. Assign stable university/program IDs and immutable catalog revisions. Retain official regulation/program URLs, quoted clauses, page/section locators, publication/retrieval timestamps, source snapshots/hashes and admission-semester applicability.
2. Separate source capture, draft extraction, editorial review and publication. A reviewer must check each value, conjunction, alternative, exception, audience restriction and semester. Unmodeled mandatory clauses remain manual/unknown. Do not mark an inventory complete while unresolved clauses remain.
3. Establish reviewer authority, conflict resolution between regulations and summaries, source diffs, expiry/recheck queues and an audit trail. Record who verified each requirement and why. Fetching or parsing a page never constitutes approval.
4. Validate each snapshot with domain schemas and regression cases. Add program-specific cases grounded in reviewed quotations, linked to source revisions. Include changed semesters, conditional routes and contradictory sources. Gate publication on review.
5. Introduce a read-only catalog provider at the existing `storage/repository.ts` boundary, retaining local user programs and offline snapshots. Keep the pure engine independent of transport and persistence. Publish versioned DTOs rather than exposing database tables.
6. When needed, use PostgreSQL entities for universities, programs, catalog_versions, source_snapshots, requirements, requirement_sources, conditional_routes and review_events. Use stable IDs/foreign keys and versioned, schema-validated rule payloads. Add a server-side read/publication API later; never expose privileged credentials in the browser.
7. Keep personal documents local by default. Equivalence decisions require provenance, privacy controls and a reviewer interface before real approvals can be accepted. Credential recognition and final selection remain external decisions.

## Validation and limitations

Run `npm test`, `npm run typecheck` and `npm run build`. Tests use fictional programs and `.example.invalid` sources, never app catalog data. Test compilation output is ignored in `.test-build/`. Coverage includes mandatory failures, unknowns, sources, semester validity, compound legacy rules, course credits, language variants/scores, conditions, compatibility and result rendering.

No verified real university catalog is supplied in this phase. No catalog-verification or equivalence-approval editor is exposed. Demo/user-program results intentionally remain provisional. General nested Boolean rules, multiple prior degrees, official grade conversion, recognition, document authenticity, certified copies and certificate expiry need further modeling. The existing Vite bundle-size warning remains; OCR/PDF dependencies are substantial. Repository screenshots remain unchanged.
