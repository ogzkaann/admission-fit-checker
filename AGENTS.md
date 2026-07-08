# Agent Notes

Admission Fit Checker is a local-first Vite + React + TypeScript app. Keep the product focused on conservative, source-aware admission fit checking.

## Guardrails

- Do not add a backend, login, payments, or server database.
- Do not ship API keys.
- Keep the fit-scoring logic transparent in `src/domain/fit/admissionFit.ts`.
- Keep demo program data in `src/data/demoPrograms.ts` and clearly marked as demo/placeholder.
- AI may extract profile fields and answer questions from a single program's own text, but it must not invent admission requirements, deadlines, or fees.
- Extracted profile fields must be user-reviewed before saving.
- When a requirement cannot be judged, prefer `not_enough_data` over an optimistic verdict.
- This is not official admission advice.

## Preferred Workflow

1. Update types and schemas first (`src/domain`).
2. Update storage and fit logic.
3. Update screens and components.
4. Run `npm run build`.

Avoid broad refactors unless they directly support the MVP.
