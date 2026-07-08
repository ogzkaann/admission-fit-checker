# Admission Fit Checker

Admission Fit Checker is a local-first portfolio MVP that compares your **academic profile** against **university program requirements** and returns a source-aware fit verdict.

It is not admissions advice. It is a decision-support demo that keeps your profile, program data, and AI explanations separated and transparent — if a requirement can't be judged from the available data, it says so instead of guessing.

## What you can do

1. **Build an academic profile** — upload a transcript, diploma, CV, or language certificate (PDF), auto-extract fields, review, and save locally.
2. **Browse a program library** — pre-researched demo programs with filters for language, degree type, and country.
3. **Open a program** — see requirements, deadlines, fees, and required documents in a detail modal.
4. **Add your own program** — paste admission text, add a link, or import a PDF.
5. **Run a fit check** — compare your profile against a program's requirements.
6. **Ask about a program** — a focused Q&A grounded only in that program's own information.

## Fit verdicts

Each check returns one of four conservative verdicts:

- **Strong fit** — your profile matches the stated requirements well.
- **Possible but risky** — you may qualify, but some requirements are weak or unclear.
- **Not recommended** — one or more core requirements do not appear to be met.
- **Not enough data** — there isn't enough profile or program data to judge fit yet.

GPA is treated as informational only (grading scales differ across countries and are not auto-compared).

## Local-first & BYOK

The app has no backend, login, or server database. Your profile, uploaded document text, added programs, and API settings are stored in the browser (IndexedDB + localStorage).

BYOK (bring your own key) settings support OpenAI-compatible providers, including OpenAI and Gemini's OpenAI-compatible endpoint. AI is optional:

- **Profile extraction** falls back to a local heuristic parser when no key is set.
- **Ask about this program** falls back to showing the matching program text.

## Demo data

The program library ships with 5–6 **illustrative demo programs** (marked "Demo"). Deadlines, fees, and requirements are approximations for showcase purposes and must always be verified against each university's official admissions page.

## Run locally

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

## Privacy

Your profile, document text, and BYOK settings stay in the browser. If AI is enabled, document/profile text and program text may be sent to your selected provider only when you run extraction or ask a question. Avoid sensitive documents on shared devices.

## Future improvements

- OCR for scanned PDFs and screenshots
- Smarter requirement parsing from pasted admission text
- Country-aware grade/GPA normalization
- Exportable fit reports
- A larger, curated program catalog
