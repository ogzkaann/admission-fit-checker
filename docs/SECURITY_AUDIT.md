# Dependency and Bundle Audit: 21 October 2026

The full `npm audit` initially reported **13 affected packages: 10 high and 3 moderate**, compared with the 12 recorded in the previous phase. The additional finding was Vite's launch-editor advisory set. `npm audit fix` without `--force` applied compatible updates within existing declared ranges. No framework, Tailwind, OCR, PDF, React or TypeScript major upgrade was performed and no transitive major override was introduced.

## Compatible Fixes

| Package | Before | After | Addressed finding |
| --- | --- | --- | --- |
| vite | 6.4.3 | 6.4.5 | Windows launch-editor escaping/existence-check/argument issues: [GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv), [GHSA-r825-w8mm-5pxw](https://github.com/advisories/GHSA-r825-w8mm-5pxw), [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm) |
| postcss | 8.5.16 | 8.5.31 | Source-map path disclosure: [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849), [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) |
| nanoid | 3.3.15 | 3.3.20 | Generator loops for invalid sizes: [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv), [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) |
| browserslist | 4.28.5 | 4.29.4 | Cache growth and custom-stat handling: [GHSA-c83g-rgw3-j3cx](https://github.com/advisories/GHSA-c83g-rgw3-j3cx), [GHSA-73wf-gq98-2v4g](https://github.com/advisories/GHSA-73wf-gq98-2v4g) |
| baseline-browser-mapping | 2.10.42 | 2.11.30 | Invalid-input process termination: [GHSA-w5vr-8v7q-w6rv](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv) |
| source-map-js | 1.2.1 | 1.2.2 | Indexed-map offset denial of service: [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) |

The compatible refresh also updates Browserslist data helpers and moves postcss-selector-parser from 6.1.4 to 6.1.5. That parser patch is **not** the security fix; its remaining advisory requires 7.1.6 or later.

## Remaining Findings

After the compatible fixes, full `npm audit` reports **7 affected packages: 5 high and 2 moderate**. `npm audit --omit=dev` reports **zero findings**. These seven counts include dependent packages affected by two underlying advisory families; they are not seven independent remotely reachable flaws in the deployed browser application.

| Package/version | npm severity | Dependency exposure | Recommended action |
| --- | --- | --- | --- |
| braces 3.0.3 | High | Recursive glob AST processing; used by the build/watch dependency tree | No patched release reported by the advisory/registry. Restrict builds to trusted repository content/configuration and plan a tested replacement of the affected dependency tree. |
| chokidar 3.6.0 | High | Depends on affected braces | Keep watchers local to trusted project paths; update with the build-tool migration. |
| micromatch 4.0.8 | High | Depends on affected braces | Do not accept remote glob patterns for build configuration; update with its parent tools. |
| fast-glob 3.3.3 | High | Depends on affected micromatch | Same trusted-glob restriction; update with parent tools. |
| tailwindcss 3.4.19 | High | Parent of affected watcher/glob/parser dependencies | Separate, tested Tailwind migration with visual regression checks. `npm audit fix --force` proposes Tailwind 4.3.3, which is outside this compatible cleanup. |
| postcss-selector-parser 6.1.5 | Moderate | Quadratic selector parsing, consumed by the build CSS tree | Patched in 7.1.6; do not force a transitive major override without testing parent compatibility. Do not process attacker-supplied CSS/selectors in a service. |
| postcss-nested 6.2.0 | Moderate | Depends on affected selector parser | Upgrade with a tested parent/Tailwind migration. |

Root advisories: [braces stack exhaustion, no patched version listed](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) and [selector-parser CPU exhaustion, patched in 7.1.6](https://github.com/advisories/GHSA-rj75-hqrm-r3gf). The parser advisory explicitly distinguishes untrusted synchronous selector parsing from ordinary builds over trusted source. University source content is captured as data; it is not accepted as build configuration, remote CSS or glob patterns. These mitigations reduce exposure and do not eliminate the reported dependency vulnerabilities.

Keep dev servers bound to localhost, avoid building untrusted branches outside an isolated environment, and review dependency advisories again before release. A zero production-only audit is not a complete security assessment. No API keys, backend, authentication or database credentials were added.

## Bundle Changes

PDF parsing and OCR are imported only when the user selects the relevant document type. Profile Builder and New Program Check load on navigation, while the read-only catalog is a separate async data chunk. Framer Motion is grouped into a stable vendor chunk for caching. These changes preserve existing screens, document extraction, profile review and BYOK behavior. The PDF worker remains large but is an on-demand document asset.

The baseline build at `d262e21` had a 1,080 kB main JavaScript chunk (about 302 kB gzip) and a 2,210 kB PDF worker. The final build has a 407.12 kB main chunk (123.42 kB gzip), 131.04 kB Motion chunk, 242.48 kB catalog chunk, 359.43 kB deferred PDF chunk and 17.20 kB deferred OCR chunk. The worker remains 2,209.73 kB. The catalog is requested at startup; PDF/OCR load on document use. The build completes without a chunk-size warning, and no warning threshold is raised. Source snapshots and review history remain outside the browser bundle. Deferred files still need downloading when their workflows are opened; splitting does not make their total bytes disappear.

Validation: 71 automated tests, lint, typecheck, catalog validation and production build pass. Production preview smoke tests processed both a synthetic selectable-text PDF and an image through OCR, mounted the deferred Profile Builder/New Program Check, opened BYOK settings without a provider call, and displayed the scoped FAU fee clause with no dialog-content horizontal overflow. The profile's heuristic suggestions still require user correction/review; this phase does not claim authenticated documents or complete automatic profile interpretation. Optional smoke fixtures can be regenerated with `node tests/browser-fixtures.mjs` using the canvas dependency already supplied by pdfjs-dist; output remains ignored under `artifacts/smoke/`.

## Review Gate Hardening

Removing a draft requirement now requires a named `removedRequirements` disposition with a reason and source-bound evidence. This prevents an accidentally deleted row from silently becoming a complete approved inventory. Existing retained requirements still require explicit source/requirement decisions. Review templates now include their draft revision in the filename; attempting to reuse an explicitly named stale file fails rather than reporting that it created a current template. Generated reports and all five new templates remain pending and create no human approvals.
