# Admission Fit Scoring

Fit logic lives in `src/domain/fit/admissionFit.ts`.

The scoring is intentionally conservative. It is designed to show product architecture and honest uncertainty handling, not to guarantee admission outcomes.

## Program Requirement Model

Each program (`src/domain/types.ts`, seeded in `src/data/demoPrograms.ts`) carries structured requirements. A `ProgramRequirement` may include:

- `kind` — `academic`, `language`, `ects`, `gpa`, `document`, or `other`
- `label` — human-readable requirement text
- `degreeType` — required prior degree (e.g. bachelor)
- `field` — expected field of study
- `minEcts` — minimum ECTS credits
- `language` + `minLevel` — required language and CEFR level
- `minGpa` — reference only (not auto-compared)
- `sourceText` — the evidence snippet backing the requirement

## Decisive vs. Informational Checks

- **Decisive checks** (drive the verdict): degree, field, ECTS, and language.
- **Informational checks** (shown, but never lower the verdict): GPA and required documents.

Each check resolves to `met`, `not_met`, or `unknown`. A check is `unknown` when the profile lacks the data needed to judge it.

## Verdict Aggregation

Over decisive checks only:

- No decisive checks → **Not enough data**
- Most decisive checks unknown (profile too sparse) → **Not enough data**
- Two or more `not_met` → **Not recommended**
- No `not_met` and a strong majority `met` → **Strong fit**
- Otherwise → **Possible but risky**

Every result is a source-aware estimate and must be verified against the university's official page. GPA scales are not compared across countries, so GPA never changes the verdict on its own.
