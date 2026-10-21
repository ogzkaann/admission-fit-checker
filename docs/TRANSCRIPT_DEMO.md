# Document-to-result demonstration

All applicants, review identities, course-group judgments and approved policies here are **fictional test fixtures**, not Passau regulations or real human approvals. Policy lives only under `tests/fixtures/`, never in the application catalog.

Run `npm test`. Workflow tests create actual selectable-text PDFs and use pdf.js, the browser's line-reconstruction helper, actual local profile extractor/draft adapter, profile schema, Eligibility Engine V2 and FitResult server rendering. No AI calls.

Extraction never produces review/equivalence metadata. A separate **fictional fixture-review step** supplies exact excerpts, values and predetermined course grouping decisions, never keyword equivalence. Tests first assert unreviewed drafts cannot establish eligibility.

| Synthetic PDF | Reviewed fictional-policy result | Decisive evidence |
| --- | --- | --- |
| `eligible.pdf` | `strong_fit` | Completed Bachelor, three-year standard duration, grade/cohort,120 explicitly mapped CS ECTS, separate12 research ECTS and exact fictional-policy certificates. No guarantee. |
| `ineligible.pdf` | `not_recommended` | German grade3.5 AND top80% both fail fictional grade-or-rank rule. Other matches cannot cancel blocker. |
| `subject-shortage.pdf` | `not_recommended` | Complete inventory,100 accepted CS ECTS below fictional110 minimum. Rejected mappings also explicit. |
| `missing-language.pdf` | `not_enough_data` | Neither English certificate nor entire-degree MOI proof. Absence is not a confirmed language failure. |
| `conditional.pdf` | `possible_risky` | Missing A1 with explicit fictional version/semester/key-bound university deferral; outstanding proof/deadline retained. |
| `insufficient-evidence.pdf` | `not_enough_data` | Partial inventory/pending mapping; no confirmed shortfall inferred. |

Every scenario also runs against actual Passau and must remain `not_enough_data` with no confirmed blocker. Fictional IDs, revisions and approvals cannot authorize Passau.

Ignored generated outputs: `artifacts/transcript-demo/<case>.pdf` (uploadable transcript), `<case>.json` (draft, reviewed fictional profile, source/applicant excerpts, per-rule synthetic result and actual unapproved Passau result).

## Browser validation

Browser smoke uses isolated localhost origin, not the user's saved-profile origin. Upload `eligible.pdf` as transcript; review degree/field/ECTS, certificates and eight course excerpts, select completion/level, add duration/grade/rank evidence, save. Reopening confirms local persistence. Open Passau, select semester, analyze: source review, equivalence and incomplete policy must remain unresolved.

This checks the real upload/extraction/review/storage/result UI against unapproved catalog. The six fully reviewed fictional outcomes are automated integration tests, not six automated browser click-throughs or a production test-policy feature. PDF line reconstruction uses real pdf.js items; OCR remains existing bounded local Tesseract. Authenticity, recognition and genuine university decisions are not established.

Additional regressions cover unknown alternatives, MOI versus English mentions, conditional/unconditional assessment-key isolation, version/semester binding, nested unsupported review rules, source uncertainty, stale review rejection, extraction invalidation and CP/ECTS ambiguity.

## Validation results (21 October 2026)

- `npm test`: 90 passing tests, including all six PDF scenarios and actual-Passau uncertainty assertions.
- `npm run lint` and `npm run typecheck`: pass. The existing lint script is TypeScript build checking, not ESLint.
- `npm run catalog -- validate`: five active records and bound evidence pass; no real approvals.
- `npm run build`: pass, no chunk-size warning. Main JS approximately412kB; asynchronously loaded catalog approximately390kB before gzip.
- Interactive browser: synthetic PDF uploaded, eight course drafts extracted, excerpts linked, profile/metrics saved locally and retained after reload; Passau summer2027 result remains unresolved (the selected year is not declared valid). Fresh production tab has no console errors and no horizontal page overflow at1888px desktop width. This is not a new mobile or OCR regression run.
- Browser proof: ignored `artifacts/transcript-demo/passau-result.png`; repository/README screenshots unchanged.
- Official-source fetch: 14 of15 Passau sources have a successful latest check; program HTML refresh returned HTTP502, preserving its previous snapshot as stale. Validation passing does not erase this failure or imply policy completeness.
