# Product Spec

## Product

Admission Fit Checker helps prospective students compare their academic profile against university program requirements and get a conservative, source-aware fit verdict.

## Audience

- Prospective bachelor's, master's, and PhD applicants.
- Students comparing multiple international programs.
- Anyone who wants a quick, evidence-based read on how their profile lines up with a program's stated requirements.

## MVP Screens

1. Dashboard
2. Academic Profile Builder (upload + extract + review + save)
3. Program Library (browse demo + user programs, with filters)
4. Program Detail (requirements, deadlines, fees, "Check my fit", "Ask about this program")
5. Check a Program (add by pasted text, link, or PDF, then analyze fit)

## Core Flows

- **Academic profile extraction**: upload a transcript, diploma, CV, or language certificate (PDF), auto-extract fields, review, and save locally.
- **Program requirement modeling**: each program carries structured requirements (degree, field, ECTS, language level, documents) backed by source text.
- **Conservative admission fit scoring**: the profile is compared against a program's requirements to produce one of four verdicts.

## Fit Verdicts

- Strong fit
- Possible but risky
- Not recommended
- Not enough data

## Non-Goals

- No official admission advice or acceptance guarantee.
- No backend, login, or payments.
- No automated application submission.
- No cross-country GPA normalization (GPA is informational only).

## Success Criteria

- User can build, review, and save a local academic profile.
- User can upload a PDF and review extracted structured fields before saving.
- User can browse and filter the program library.
- User can open a program and run a fit check with per-requirement results.
- User can add their own program and analyze fit from pasted text or a PDF.
- User can ask questions grounded only in a single program's information.
