# Prompts

The app uses strict prompts only when BYOK AI is enabled. Without an API key, it falls back to local heuristics.

## Profile Extraction Prompt

The model extracts structured academic JSON from user-provided document text: `name`, `degree`, `field`, `university`, `gpa`, `ects`, `courses`, `workExperience`, and `languageCertificates`. It must not infer unsupported values; unknown fields are omitted. Extracted fields are shown for user review and are only saved when the user confirms.

## Ask-About-Program Prompt

The model answers questions about a single program using only that program's own information (description, requirements, deadline, fee). It must:

- answer only from the provided program text,
- cite the matched snippets by number,
- say `Not found in this program's information.` when evidence is missing,
- never invent admission requirements, deadlines, or fees.

If AI is unavailable, the app shows the matching program text as a fallback instead of a generated answer.
