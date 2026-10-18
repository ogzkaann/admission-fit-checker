# Eligibility Decision Rules V2

The transparent, deterministic evaluator lives in `src/domain/fit/admissionFit.ts`. It evaluates modeled eligibility, not likelihood of selection or admission. The initial target is German master's admissions.

## Inputs and evidence

- Use structured degree level/completion, exact accepted fields, total ECTS, subject credits with explicit equivalence decisions, and language certificate variants/levels/scores.
- Profile facts need reviewed excerpts linked to available documents. User review is not document authentication. Missing documents or unsupported excerpts cannot confirm eligibility or failure.
- Requirement and program sources must be official, verified with a reviewer, checked within one year, not future-dated and valid for the explicitly selected semester. Missing, stale, conflicting or demo sources make the check uncertain.
- Legacy requirements remain readable and all populated constraints are evaluated together. Missing `mandatory` defaults to true, including unsupported GPA/manual conditions. Legacy records never gain verification through migration.

## Per-requirement outcomes

| Outcome | Meaning |
| --- | --- |
| `met` | The rule is supported by reviewed document evidence and verified source metadata. |
| `not_met` | Reviewed evidence confirms a shortfall against the verified rule. A mandatory shortfall is a hard blocker. |
| `unknown` | Profile evidence, rule semantics, equivalence or source information is insufficient. Provisional comparison is retained separately. |
| `conditional` | A sourced conditional admission route explicitly permits a supported alternative, with an outstanding obligation displayed. |

Conditional routes are never inferred from a small shortfall. If an explicit exception exists but cannot be resolved, exclusion cannot be confirmed. Unknown advisory requirements do not block; their source issues remain visible.

## Verdict precedence

1. Any confirmed mandatory blocker: `not_recommended` (UI: Mandatory blocker), regardless of other matches.
2. Any unresolved mandatory rule, unknown semester, incomplete inventory or source uncertainty: `not_enough_data`.
3. All mandatory rules resolved with an explicit conditional route: `possible_risky` (UI: Conditional route).
4. All mandatory rules met and the complete source inventory verified: `strong_fit` (UI: Modeled requirements met).

An empty or advisory-only rule set cannot establish eligibility. The deprecated numeric `score` is only confirmed mandatory-rule coverage for compatibility; no threshold is used and it is never displayed as an acceptance probability.

## Conservative comparison policy

- Exact normalized study-field equality only. A non-listed field is unknown unless the verified accepted list is explicitly exhaustive. Course titles and weak keywords never establish equivalence.
- ECTS accepts an exact nonnegative number, optionally followed by ECTS. Do not parse ranges, approximations or foreign credit units.
- Subject credits count only reviewed courses with sourced, program/version/semester-specific equivalence decisions. Duplicate course evidence and cross-subject reuse stay unresolved. Confirm a shortfall only with a complete reviewed course list and resolved equivalences.
- Test variants and score scales must match explicitly. Evaluate every certificate and accepted alternative. Missing certificates are unknown, not failures. Never infer CEFR from a test score or a test variant from its provider.
- Uploading a document alone does not prove certification, completeness or application suitability. Document and unsupported grade/recognition rules require manual review.
- Pasted admission text produces unverified drafts and a manual full-text review requirement. Automatic matching cannot establish a complete requirement set.

See `docs/ARCHITECTURE_V2.md` for the architecture audit, trust boundaries and verified-data ingestion plan.
