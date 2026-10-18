# Admission Fit Checker

A local-first, AI-assisted tool that extracts an academic profile and compares it with university program requirements using **conservative, source-aware fit analysis**.

Instead of guessing, it tells you *why* you fit — and when there isn't enough data to decide, it says so.

**[▶ Live Demo](https://admission-fit-checker.vercel.app/)** · [Tech Stack](#tech-stack) · [What I Designed](#what-i-designed)

<p>
  <img alt="Vite" src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/local--first-no%20backend-16A34A">
</p>

---

## Overview

Eligibility V2 prioritizes German master's admissions while retaining the existing local-first UI. Mandatory blockers take precedence over other matches; missing evidence and uncertain sources remain unresolved. Program data now supports requirement-level provenance, verification status, catalog versions and admission-semester validity. Existing demos remain illustrative, never verified university requirements.

See [decision rules](DECISION_RULES.md) and the [architecture audit and verified-data ingestion plan](docs/ARCHITECTURE_V2.md). User-reviewed document excerpts establish recorded facts, not credential authenticity or an admission guarantee.

Applicants comparing international programs face scattered requirements and vague "am I qualified?" answers. Admission Fit Checker turns an uploaded transcript or CV into a structured academic profile, models each program's requirements as data, and runs a transparent fit check that returns one of four honest verdicts — with the evidence behind each decision.

The applicant experience runs in the browser. No backend, no login, no server database. A separate local Node command ingests official university sources into a versioned, human-reviewable catalog.

## Official Catalog Pilot

Five real German master's programs (Passau, Saarland, FAU, Stuttgart and TUHH) now appear in the existing library alongside local programs and separately filtered illustrative demos. **All pilot admission data remains unverified**; TUHH additionally needs a source check because a linked PDF is robots-denied. Retrieval is not editorial approval, and no current-semester eligibility is inferred.

See the [ingestion and review guide, pilot source report and PostgreSQL next steps](docs/CATALOG_INGESTION.md).

```sh
npm run catalog -- status
npm run catalog -- validate
# Explicit network refresh; respects robots and rate limits:
npm run catalog -- fetch
```

## Screenshots

> 📸 **TODO:** capture and add the images below to `docs/assets/`. The section is wired up and ready.

| Dashboard | Program Library | Fit Result |
| :---: | :---: | :---: |
| ![Dashboard](docs/assets/dashboard.png) | ![Program Library](docs/assets/program-library.png) | ![Fit Result](docs/assets/fit-result.png) |

## Fit verdicts

| Verdict | Meaning |
| --- | --- |
| **Modeled requirements met** | All mandatory rules have supporting reviewed evidence and verified source metadata. No admission guarantee. |
| **Conditional route** | An explicitly sourced conditional route applies; obligations remain. |
| **Mandatory blocker** | At least one mandatory rule is confirmed unmet. Other matches cannot offset it. |
| ⚪ **Not enough data** | Not enough profile or program data to judge fit yet. |

## What I Designed

- **Academic profile extraction workflow** — upload a transcript, diploma, CV, or language certificate (PDF), parse it client-side, and auto-fill structured fields.
- **Program requirement modeling** — each program's admission rules are stored as typed, structured requirements (degree, field, ECTS, language level, documents), each backed by source text.
- **Explainable eligibility rules** — degree, exact accepted fields, total/subject ECTS, certificate types and scores are evaluated with explicit evidence. Unsupported mandatory GPA, recognition and document requirements remain unresolved.
- **Human review before profile save** — extracted fields are always editable and are only persisted when the user confirms.
- **Separation between user documents and program requirements** — personal document text and program data are modeled and stored independently.
- **BYOK AI flow** — users bring their own OpenAI-compatible key; the app degrades gracefully to local heuristics when none is set.
- **Local-first privacy model** — profile, documents, and settings live in the browser (IndexedDB + localStorage).
- **"Not enough data" behavior** — the app refuses to fabricate a decision when evidence is missing.

## Tech Stack

| Area | Choice |
| --- | --- |
| Build tool | **Vite** |
| UI | **React** + **TypeScript** |
| Styling | **Tailwind CSS** |
| Local storage | **IndexedDB** via **Dexie** |
| PDF parsing | **pdfjs-dist** (client-side) |
| Validation | **Zod** |
| AI | **BYOK** OpenAI-compatible providers (OpenAI, Gemini OpenAI-compatible endpoint) |
| Hosting | **Vercel** |

## AI Safety / Hallucination Control

The AI layer is deliberately constrained so the product stays trustworthy:

- **No admission guarantees.** The tool never claims you will be accepted — it estimates fit against *stated* requirements.
- **AI extracts and summarizes only.** It reads document text into structured fields and answers questions strictly from a single program's own information. It does not invent requirements, deadlines, or fees.
- **The fit verdict is conservative.** Scoring favors caution: unclear or unmet decisive requirements pull the verdict down rather than up.
- **Uncertain requirements become risks or `not_enough_data`.** Missing evidence is surfaced explicitly instead of being filled with assumptions.
- **The user reviews the profile before analysis.** User review confirms transcription; it does not authenticate documents or establish university recognition.

## Run Locally

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

Validation (Node 22.12+ for catalog tooling; tested with Node 24):

```bash
npm test
npm run typecheck
```

Tests use synthetic fixtures and Node's built-in test runner; no test framework dependency is required.

## Privacy

Your profile, document text, and BYOK settings stay in the browser. If AI is enabled, document/profile text and program text may be sent to your selected provider **only** when you run extraction or ask a question. Avoid sensitive documents on shared devices.

## Future Improvements

- German OCR and page-level extraction coverage
- Smarter requirement parsing from pasted admission text
- Country-aware grade/GPA normalization
- Exportable fit reports
- A larger, curated program catalog

---

<sub>Demo programs are illustrative placeholders. Always verify requirements against each university's official admissions page. This project is a decision-support demo, not official admission advice.</sub>
