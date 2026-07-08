# CLAUDE.md

This repository is a portfolio MVP named **Admission Fit Checker**.

It compares a user's academic profile against university program requirements and returns a conservative, source-aware fit verdict.

The app is intentionally local-first:

- IndexedDB via Dexie for the academic profile, uploaded document text, and user-added programs.
- localStorage for user-managed OpenAI-compatible (BYOK) API settings.
- No backend.
- No server database.

Core principles:

- **User review before save**: extracted profile fields are editable and are only persisted when the user saves.
- **Conservative fit scoring**: when a requirement cannot be judged from the available profile/program data, the verdict is `not_enough_data` rather than a guess. GPA is treated as informational (grading scales are not compared across countries).
- **AI is not the source of truth**: profile extraction and "Ask about this program" are grounded only in the user's own document text or a single program's own information; the model must not invent requirements, deadlines, or fees.
- This is a decision-support demo, **not official admission advice**.
