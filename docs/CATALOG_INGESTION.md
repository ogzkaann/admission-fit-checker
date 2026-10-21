# Official Catalog Pilot

## Scope and trust boundary

This phase builds on `docs/ARCHITECTURE_V2.md`; the browser UI, local document extraction, IndexedDB, BYOK and pure V2 engine remain in place. The new ingestion tool runs locally in Node, not in the browser or on a server. It does not receive applicant documents, use an LLM, authenticate to university sites, or scrape third-party aggregators.

The shipped pilot contains five real master's programs with official-source excerpts. **None is editorially verified and none has a complete verified rule inventory.** Four are unverified; TUHH is flagged `stale`/source-check-needed because one required source could not be retrieved. These entries intentionally cannot establish eligibility. An official domain is source provenance, not an approval of our interpretation.

The review gate is a named local editorial assertion. It is not authenticated reviewer identity, university endorsement, credential authentication or legal advice. Repository write access is the current trust boundary.

## Run the pipeline

Use Node 22.12+ (tested with Node 24) and `npm ci`. HTML parsing uses Cheerio, robots policies use robots-parser, and PDF parsing reuses the app's existing pdfjs-dist. No AI calls or new runtime frontend dependencies are needed.

```sh
npm run catalog -- status
npm run catalog -- fetch
npm run catalog -- fetch passau-program
npm run catalog -- extract
npm run catalog -- validate
npm test
npm run typecheck
npm run build
```

- `fetch [source-id]`: sequentially capture all configured sources or one named source, parse, version and publish. A source failure preserves the last successful snapshot, marks the affected program stale, and exits with code 2 after publishing the failure state. A programming/validation error exits with code 1.
- A comma-separated list of configured source IDs can refresh a selected batch without refetching other sources.
- `extract`: re-run recipes over stored snapshots and regenerate DTOs/review queue **without network access**. Useful after changing anchors or notes. Observation timestamps are not advanced.
- `reparse`: re-parse the ignored raw cache after parser improvements, then extract. Requires `catalog/cache/`; a fresh clone only has parsed snapshots. This does not pretend to be a new source retrieval.
- `validate`: validate schemas, immutable draft hashes, evidence quotes/locators/snapshot bindings, current pointers and reproducible published output. It does not contact universities or approve requirements.
- `status`: summarize the last published review queue. Run `extract` to refresh age-based queue status offline; the frontend also checks source age when reading catalog records.
- `report`: generate source-bound human-readable evidence checklists in `catalog/reports/`, without changing decisions. `review-template all` creates pending revision-specific files for every program.

The manifest `catalog/seeds.json` is human-curated. Each university/program has a stable ID, exact allowed official hostnames, explicit source URLs, and source-specific extraction anchors. Link discovery records bounded candidate admission/regulation/application links in `catalog/current.json`. A maintainer selects relevant links, adds them to the manifest and fetches them by source ID. There is no unbounded crawler or automatic following of portals/login links.

Every source needs HTTPS, no credentials/custom port, and an exact allowed hostname on every redirect. The fetcher consults robots.txt, fails closed on inaccessible or malformed policies, honors crawl delay, waits at least 1.2 seconds per origin, serializes concurrent callers, stops an origin on access/rate-limit responses, caps redirects/bytes/pages, and performs no immediate retries. A run is capped at 30 explicitly configured sources. Robots 404/410 means no published robots rules, not a license to ignore a site's terms. Human maintainers must assess terms, permitted reuse and appropriate frequency before expanding capture. No scheduled monitoring is enabled in this phase.

## Extraction behavior

HTML paragraphs/list items/table cells and PDF pages retain locators. Nested list headings are preserved so a certificate list does not lose its language context. Scanned-only PDFs fail explicitly; the existing applicant OCR is unchanged and is not silently run against university regulations.

Recipes select exact source clauses, including contextual/exception clauses. If any configured anchor is missing, the fact is `null` and the requirement becomes manual/unknown. Numeric subject-ECTS and unambiguous CEFR extraction are supported; the production pilot deliberately keeps complex alternatives, foreign-credit conversions, recognition, GPA, exemptions, certificate expiry and applicant-category clauses manual. Curriculum credits are not admission prerequisites. There is no keyword-based course equivalence or generic "AI understands all university rules" claim.

`facts` capture academic, credit, language, deadline, tuition, application and semester information using excerpts, explicit unknowns, notes and source evidence. Each requirement separately uses the existing V2 rule model and evidence. Every extracted inventory includes a manual completeness-review condition. Retrieval dates never imply semester validity. Recurring day/month deadlines are retained as source text, not guessed calendar-year deadlines. All pilot `validFor` arrays remain empty until a reviewer establishes applicability.

## Persistence and updates

| Path | Purpose |
| --- | --- |
| `catalog/seeds.json` | Stable identities, official sources, extraction recipes and known caveats |
| `catalog/snapshots/<sha256>.json` | Immutable normalized source text, blocks, links, raw-content hash, text hash, parser version, first retrieval time and HTTP metadata |
| `catalog/cache/<content-hash>.html/pdf` | Ignored local raw capture, for offline reparsing; never included in the browser bundle |
| `catalog/versions/<program-id>/<revision>.json` | Immutable schema-validated draft, parent revision, recipe hash, extraction time and requirement/fact/source diffs |
| `catalog/current.json` | Active draft pointers, latest attempts, last successful checks, source changes/errors and discovered links |
| `catalog/review-queue.json` | Pending requirements, unknown facts, source failures, version changes and last checks |
| `catalog/review-drafts/` | Editable pending templates; not approvals |
| `catalog/review-events/<hash>.json` | Append-only explicit editorial decisions |
| `catalog/reviews/<program-id>/<draft-revision>.json` | Active review for an exact draft revision |
| `src/data/catalogPrograms.json` | Reproducible published DTOs consumed by the browser repository |

Source snapshots are content-addressed by URL, raw content hash and parser version. A repeated identical capture retains the original snapshot and advances a separate successful-check observation. Semantic draft hashes exclude volatile retrieval/check timestamps. Source-content changes, extracted rule changes and source failures create a new draft and invalidate its previous review. HTML-only changes can therefore trigger conservative re-review even when extracted prose is unchanged; `textChanged` distinguishes text changes from raw-only changes. Diff records retain before/after values, not just a changed flag.

Editorial changes generate a new engine-facing `catalogVersion` derived from the draft plus review event. `catalogDraftVersion` links back to the immutable extraction. Thus corrected rules invalidate old program/version-bound course equivalences. Old snapshots and drafts remain available. This pilot uses a single-writer lock and atomic JSON replacements (with bounded Windows file-lock retries), not a multi-file transaction system. `validate` detects a partially published state; rerun `extract` to rebuild. Do not run parallel catalog processes or manually edit published DTOs.

## Human review

Generate a pending file:

```sh
npm run catalog -- review-template de-passau-msc-computer-science
```

The file is created at `catalog/review-drafts/<program-id>-<revision-prefix>.json`; existing matching files are not overwritten, and an explicitly selected file for a different revision is rejected. Review the captured evidence and official regulations, not just extracted values. A reviewer must:

1. Supply their name, ISO review timestamp and a meaningful review rationale.
2. Establish explicit admission semesters under `applicability.semesters`, with an explanation and exact source evidence under `applicability.evidence`. The evidence must reference a source captured in this draft, using its URL, hash, snapshot ID, quote and locator. A capture date or unscoped recurring deadline is not sufficient substantive evidence of applicability.
3. Set source, fact and requirement decisions to `approve`, `reject` or `pending`. Unknown facts cannot be approved. Source approval is a prerequisite for fact/requirement approval. Pending or rejected content cannot become verified by simply setting a status string.
4. Correct or split requirement objects using existing V2 rules and quoted evidence. Preserve all alternatives, conjunctions, exemptions and applicant scopes. A reviewer may replace the completeness placeholder only after auditing the whole regulation. Keep unsupported mandatory clauses as manual. `requirementsComplete: true` is rejected while rules are pending, unsourced or unsupported.
   Every removed draft requirement, including a replaced completeness placeholder, needs an entry in `removedRequirements` with its original ID, rationale and source evidence. Silent omissions are rejected.
5. Run the command below; inspect the changed DTO and queue, then commit the review event and published data together.

```sh
npm run catalog -- review <program-id> <revision-specific-review-file>
npm run catalog -- validate
npm test
```

The tool verifies structure, current revision binding, actual quote/locator existence, review time, source approval and explicit applicability. It cannot determine whether a human's legal/academic interpretation is correct. Semantic review, conflict resolution and authority checks remain the reviewer's responsibility. Do not set approvals on the pilot solely to obtain a positive fit verdict. Synthetic tests demonstrate approval and confirmed-blocker behavior without approving any real university policy.

## Pilot collection: 18 October 2026

Eight sources were successfully captured (six HTML pages, two PDFs). A ninth discovered source was denied by robots.txt and was not fetched. Full URLs, excerpts, timestamps and hashes are retained in the catalog artifacts.

| Program and official source | Captured information and review limitations |
| --- | --- |
| [University of Passau: Computer Science M.Sc.](https://www.uni-passau.de/en/msc-computer-science/) | Relevant degree, CS-credit route and non-ECTS alternative, grade/cohort alternative, preliminary-degree process, institution recognition, language routes/certificates/exemptions, recurring deadlines, application method, tuition statement. The linked [information PDF](https://www.uni-passau.de/fileadmin/dokumente/studium/infoschriften/Informatik_MSc_EN.pdf) explicitly names winter 2025-26; it must not establish a later intake's validity. |
| [Saarland University: Computer Science M.Sc.](https://www.uni-saarland.de/en/study/programmes/master/informatics.html) | Prior degree/equivalence, C1 language level, MOI exclusion, academic merit/references, early/late application cycles, online portal and tuition statement. Accepted certificate list and numeric subject ECTS remain unresolved. Recurring dates do not establish a year. |
| [FAU Erlangen-Nuremberg: Data Science M.Sc.](https://www.fau.eu/degree-program/data-science-m-sc/) | Accepted degree/competence profiles, grade/interview alternatives, B2 and exemption wording, domestic-scoped dates and campo application. Language sections require reconciliation. International dates, tuition and numeric prerequisite ECTS remain unknown; curriculum module ECTS are explicitly not reused as prerequisites. |
| [University of Stuttgart: INFOTECH M.Sc.](https://www.infotech.uni-stuttgart.de/application/requirements/) | Region-dependent degrees/subjects, exact language certificate clauses, old/new TOEFL scales, certificate validity, exemptions and application process; separate [application periods](https://www.infotech.uni-stuttgart.de/application/) and [bilingual 2024 regulation](https://www.infotech.uni-stuttgart.de/pdf/INFOTECH_ZulO_2024_BiLingual.pdf). The English translation is unofficial; reconcile German text, amendments and newer website changes. Tuition/ECTS/semester applicability remain unresolved. |
| [TUHH: Mechatronics M.Sc.](https://www.tuhh.de/tuhh/studium/vor-dem-studium/studienangebot/international-study-programs/mechatronics) | Degree/fields, language scores and ITP exclusion, subject-preparation text, annual winter application window, online procedure and approximate fee statement. CP is not automatically converted to ECTS. The discovered subject-requirements PDF is robots-denied; source-check-needed is intentional. Approximate fees are not presented as verified current amounts. |

The snapshots are official-host source material, not necessarily the final controlling/current regulation. University summary pages, older leaflets, translated regulations and applicant-specific policies can differ. The catalog preserves those distinctions in notes and review issues. No deadline, fee, source applicability or admission probability has been invented.

## Application integration

`src/storage/repository.ts` reads schema-validated catalog DTOs before local user programs and illustrative demos. IndexedDB tables and personal records are unchanged. The library defaults to catalog plus user programs, with a separate source filter for demos. Cards expose verification state; the existing detail modal adds collapsible source facts, source links, capture/check dates, known caveats, semester uncertainty and revision IDs. The V2 engine itself is unchanged. Program Q&A now retains per-document source citations and an explicit catalog uncertainty warning.

Source-check-needed covers expired/future-dated checks and retrieval failures. The current one-year freshness ceiling is inherited product policy, not a university rule. Real unverified entries remain non-decisive even if an applicant happens to match their draft rules.

## Validation and remaining work

`npm test` covers the existing V2 cases plus synthetic HTML/PDF parsing, robots/redirect/rate/size restrictions, structured extraction and unknowns, source quote integrity, immutable revisions/diffs, review gating, source failure/expiry, reviewed fixture-to-engine integration, per-document Q&A citations and the actual five-record catalog's provenance. No real program is used as a verified synthetic test policy.

The existing frontend bundle-size warning and repository dependency-audit findings are separate follow-up work. Ingestion adds only dev-time Cheerio and robots-parser; the broader Vite/Tailwind/PostCSS dependency stack was not upgraded. Screenshots, authentication, backend/database services and personal-document extraction were not changed.

Validation result: 58 automated tests pass, including all 31 existing V2 tests. Type checking, lint (the repository's TypeScript check), catalog validation and production build pass. Browser checks exercised the real catalog, separate demo filter, source warnings and an uncertain fit result at measured CSS widths of 388 and 1433 pixels; no document or dialog-content horizontal overflow remained. The build still warns about a JavaScript chunk over 500 kB. `npm audit` reports 12 findings (3 moderate, 9 high) in the pre-existing dependency stack; the affected installed versions were unchanged by this phase.

Next priority: obtain reviewable current regulations and semester applicability for these five programs, resolve the recorded conflicts and model supported exceptions. Do not scale collection before this editorial process is proven. Add parse coverage monitoring, explicit source document roles/languages/publication dates, schedule/backoff and conditional HTTP requests, robots-policy audit snapshots, source conflict resolution and validated applicant-specific deadline/fee models next. Scanned regulations need an explicit OCR/manual workflow with page coverage tracking.

For PostgreSQL, map the existing IDs to `universities`, `programs`, `program_versions`, `source_snapshots`, `source_observations`, `requirements`, `requirement_sources`, `catalog_facts`, `review_events` and `publications`. Keep rules as versioned schema-validated JSON, source/evidence links as foreign keys, and published DTOs identical to the current repository boundary. Introduce authenticated reviewer roles and a transactional publication gate before trusting centralized approvals. A later read-only catalog API can replace the static JSON provider without moving private applicant documents to the server or changing the pure fit engine.

## Hardening Audit: 21 October 2026

See [the five-program verification report](PILOT_VERIFICATION.md) and [dependency/security findings](SECURITY_AUDIT.md) for the current state; the eight-source/58-test figures above describe the initial pilot. The refresh captures 20 of 21 sources, preserves complete fee-table rows and exact bounded PDF clauses, and keeps all five programs unapproved. It adds Passau's research-credit clause, Saarland certificate/exemption detail, FAU named-intake dates and fee scope, and Stuttgart grade/APS/tuition detail. No missing source was bypassed and no full inventory was declared verified. The suite now has 71 tests, including 40 realistic applicant/program comparisons, plus the existing controlled-policy blocker regressions.
