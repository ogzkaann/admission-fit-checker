# Passau Computer Science: human decision packet

Prepared 21 October 2026. **NOT approved; not ready for full human approval.**
Program: `de-passau-msc-computer-science`. Scope: regular first admission, not a double degree or a historical/returning-student route. No applicant or university decision has been approved by this work.

The [generated evidence report](../catalog/reports/de-passau-msc-computer-science.md) contains every source URL, first retrieval, latest successful check, failed attempt, snapshot hash, locator, full captured quotation and candidate rule. `catalog/current.json` is the current revision pointer. Use the newly generated revision-specific pending template, not older templates retained for audit history.

## Controlling sources and intake decision

Consolidated PDFs explicitly say that only the official gazette publication is binding. This proposed authority order requires your review:

| Source ID | Captured material | Personal decision still required |
| --- | --- | --- |
| `passau-general-original` | AStuPO 27 April 2016, gazette p.24 onward; qualification section 4, historical five-week proof deadline | Compare original with every amendment, not an old English translation alone. |
| `passau-general-2019` | Amendment 12 September 2019, gazette pp.198-206; PDF pp.1-2 introduce scientific-work evidence and change five to ten weeks; p.8 gives 1 October 2019 effect/grandfathering | Confirm chain and exclude grandfathered already-enrolled applicants. The annual index failed HTTP 502; the exact official PDF was discovered separately and captured normally. |
| `passau-general-2025` | Amendment 4 August 2025, effective 1 October 2025; p.7 transitions | Separate post-enrolment progression/thesis rules from admission prerequisites. The 70 ECTS thesis-registration threshold is NOT an admission threshold. |
| `passau-general-2026` | Amendment 24 February 2026; p.1 narrows scientific-work clause to Informatik/AIE; effective 1 March 2026; explicit first-application sentence names Mathematics winter 2026/27 | Resolve scope for the chosen CS intake. Do not assign CS validity using a sentence about Mathematics. |
| `passau-subject-original`, `passau-subject-2025` | FStuPO 27 April 2016, gazette p.41 onward, section 3 requires 110 CS ECTS; amendment 1 September 2025 effective that day | Confirm regular route and amendment completeness. New Prague double-degree selection rules must not leak into ordinary admission. |
| `passau-general`, `passau-regulations` | Current consolidated regulations; general section 1(3) states priority over inconsistent subject provisions | Check consolidation against publications. These are reading copies, not substitutes for gazette authority. |
| `passau-enrolment`, `passau-enrolment-2025` | ImmSa consolidated through 4 June 2025 and that official amendment; section 3(1) no.7 German proof/exception wording | Check earlier ImmSa amendments and later changes before approving the German route. |
| `passau-program`, `passau-faq`, `passau-german`, `passau-application`, `passau-leaflet` | Operational/application/language guidance; leaflet explicitly winter 2025-26 | Reconcile with regulations. Program page returned HTTP 502 on refresh; earlier 21 October snapshot remains available but is stale, not silently refreshed. |

- [ ] Select a specific first-entry intake, for example **2027-summer**, only after checking effective/transition clauses and current application availability. This example is not assigned as validity.
- [ ] Record exact clauses in `applicability.evidence` and explain why they apply to CS and that intake/applicant category.
- [ ] Confirm no later amendments, special suspensions or category restrictions. Capture missing sources through the restricted fetcher; never bypass robots/access failures.

Actual `validFor` arrays remain empty. A retrieval date does not establish admission-semester validity.

## Requirement-by-requirement decisions

| Requirement / evidence location | Current candidate behavior | What you must personally verify |
| --- | --- | --- |
| Qualifying degree: general section 4(1) no.1, PDF p.3; report E1 | Completed Bachelor OR keyed university equivalence decision. Magister/Diplom/Staatsexamen/equivalent cannot be inferred from catch-all `other`. | Accepted credential, recognition and related subject background. There is no closed list of accepted field titles; do not use keywords or reject related degrees solely for a different title. |
| At least three-year study / equivalent: E1 | Reviewed standard-duration metric >=3 OR university duration-equivalence decision | Standard duration, not elapsed years. Confirm equivalent-qualification route. No universal 180-total-ECTS admission minimum is invented. |
| Grade <=2.7 German OR best 70% of graduating cohort: E1 | `any` rule with separately documented metrics. Missing rank prevents a poor grade alone becoming a confirmed failure. | Native German grade or university-approved conversion; no foreign-grade conversion by engine. Rank must refer to graduating cohort. Every applicable alternative must fail for a blocker. |
| CS component >=110 ECTS: subject section 3; program E3/E4; official original PDF p.3 | CS subject-credit route OR university acceptance of four-year non-ECTS route in guidance | Course-by-course syllabus equivalence, ECTS units, accepted/rejected/pending decisions. Approximately-two-thirds CS in four-year non-ECTS degree is not automatic conversion. Establish applicability/non-applicability of alternatives before confirming a shortage. |
| Scientific work >=10 ECTS: general section 4(1) no.4, p.4, E7; 2019 amendment pp.1-2 | Subject-credit definition includes independent scientific methods, deadline and written findings | Thesis OR other scientific work. A thesis title alone proves nothing. FAQ scopes verification wording to degrees outside Germany; do not exempt German degrees from broader regulation automatically. |
| Research/CS credit overlap | Engine refuses cross-requirement reuse by default | Confirm whether the same thesis credits may count toward both thresholds. Do NOT infer a new 120-ECTS prerequisite by adding them, or count twice silently. Allocation/sharing remains unimplemented. |
| Research artifact: program E6; FAQ paragraphs143-144 | Mandatory manual review | English/German abstract/summary, full-paper link wording, alternative publication/work, completeness and scope. An uploaded PDF alone does not establish acceptability. |
| Recognition: Anabin H+ paragraph E5; general section 4(2), p.4 | Mandatory manual review | Institution/degree recognition, Anabin and board/ZAB judgment. Applicant claim or university-name similarity cannot approve recognition. Additional exams are discretionary, not universal bridging. |
| Provisional degree: general section 4(3), p.4, E2 | Keyed `provisional-degree` conditional route requiring university decision | All assessments completed by lecture start; preliminary German transcript average 2.7 or better; board authorization; final proof by end of lecture week10; consequences/non-fault extension. Do not substitute normal top70% alternative for preliminary-grade rule without authority. |
| Planned modules: FAQ p-block130; additional transcripts p-block134 | Captured facts, not automatic credits | Board may consider documented final-semester plans and additional Master's transcripts. Not guaranteed permission to repair shortages after enrolment. Reconcile with lecture-start completion; multiple degrees/planned credits are not automatically combined. |
| Language route: general section 4(1) nos.2-3, pp.3-4; E8-E11 | Mandatory manual until full route policy is modeled | Record chosen teaching route. English B2 is mandatory on English route; recommended on German route. Do not require both B2 languages unconditionally. |
| English certificates: E14-E17, FAQ English-proof section | Evidence only; no automatic acceptance list yet | Guidance lists TOEFL PBT567 / CBT220 / iBT87 / ITP543 silver, IELTS5.5, CAE/CPE or equivalent. Confirm variants/scales/expiry. IELTS Academic vs General is unspecified in excerpt. Never compare legacy TOEFL minimums with 2026 1-6 scale. |
| English exemptions: general clause, FAQ p-blocks150/152, E8 | Engine supports entire-qualifying-degree MOI for a future reviewed policy; actual language policy stays manual | 100% English MOI documented by transcript/degree/university letter. Reconcile secondary education and native-language wording with regulation. Course titles/nationality do not prove exemption. |
| German route: language table row40; ImmSa section 3(1) no.7 | Full evidence, manual policy | Distinguish **B1 at application** from **B2/DSH-1 at enrolment**: different stages, not inherently conflicting. Check DSH-1, DSDII, GoetheB2, TestDaF3 in every skill, German-school and equivalent routes. |
| German proof restrictions: language intro/four-skills paragraph | Outstanding review; no false certificate equivalence | Guidance: issued within two years; B2 proof all four skills; private-language-school certificates generally excluded. Expiry, issuer acceptance and stage-specific validation need modeling. |
| German A1 / deferral: general section 4(1) no.2 and 4(4), p.4; E11; language table | Exact deferral captured; actual language policy stays manual | Prior German education exception; A1 within one year on English route, conditional enrolment, non-fault extension/consequences. Missing A1 is neither permanent automatic rejection nor unconditional exemption. |
| Full inventory | Manual `inventory-review`; `requirementsComplete=false` | Check all clauses/documents/exceptions/categories/stages. Unsupported rules stay pending; CLI rejects approving manual rules even in partial reviews. |

## Operational checklist

- [ ] Recheck named-intake dates/route. Captured guidance: winter direct15April-31May, uni-assist1April-31May; summer1November-15December. Recurring dates do not authorize a year. FAQ puts English proof/other artifacts at application; final degree and A1 have distinct deferrals.
- [ ] Review application guide for degree-country/EU-EEA exceptions and DAAD/other routes. Do not choose uni-assist solely by nationality.
- [ ] Recheck tuition, semester contribution, processing costs and exemptions. Old program snapshot says no tuition, not no other costs. No universal fee amount asserted.
- [ ] Never approve an unknown fact to obtain a complete display.

## Editorial procedure

1. Read this packet, full excerpts and official PDFs. Record disagreements; obtain university clarification where necessary.
2. Run `npm run catalog -- review-template de-passau-msc-computer-science`. Filename binds current revision; old pending files are historical.
3. Edit only that template. Supply your actual name/time/rationale only after personal review. Unresolved decisions stay pending. Source approval does not automatically approve a rule/fact.
4. Correct/split candidates, including language alternatives, exemptions, intake and scope. Every removed/replaced original requirement needs `removedRequirements` rationale and captured evidence. Keep completeness placeholder until inventory is actually complete.
5. Only after resolution, run `npm run catalog -- review <id> <review-file>`, catalog validation, tests and build. A partial review cannot label the program verified; source failure still marks it stale.

Tool checks evidence existence, hashes, revision, reviewer/time and structural completeness, not legal truth or reviewer authority. Engine binds applicant decisions to separate assessment keys, program/revision/requirement/semester. Repository access is the trust boundary; no authenticated editor/private decision service introduced.

## Readiness

**Not ready for full approval.** Blockers: failed current program-page check, intake/transition decision, incomplete ImmSa history and language/expiry/exemption modeling, recognition/research-artifact judgments, subject/research equivalence and overlap policy. None were fabricated.

Conservative document-to-rule matching is demonstrable; definitive real-applicant Passau eligibility is not yet established. See [synthetic demonstration](TRANSCRIPT_DEMO.md). Resolve Passau before scaling.
