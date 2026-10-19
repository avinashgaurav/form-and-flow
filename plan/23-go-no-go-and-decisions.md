# 23 · Go/no-go checklist and who decides what

## 1. Go/no-go checklists

Every box must be ticked by a named person. A "no" on any line means no-go for that stage.

### Gate 1 · Start building (end of M0)

| # | Check | Owner |
|---|---|---|
| G-01 | You have approved this plan in writing (a reply is enough) | You |
| G-02 | Budget envelope and spend cap agreed (Q-06) | You |
| G-03 | Dietitian and S&C reviewer engaged, with scope and fees agreed | You |
| G-04 | Food data route chosen: permission received, or the computed-from-recipe fallback accepted (Q-18 to Q-20) | You + team |
| G-05 | Counsel engaged for the DPDP, claims and terms review before beta | You |
| G-06 | Name kept provisional; no public use until a trademark search is done | You |

### Gate 2 · Founder pilot (end of M6)

| # | Check | Owner |
|---|---|---|
| G-07 | All P0 acceptance criteria pass (file 18) | Team |
| G-08 | Pilot eval suite (180 cases) passes with zero critical failures | Team |
| G-09 | Pre-pilot review done: all safety templates (red flag, crisis, pain, ED-aware, pregnancy and medication restrictions, out-of-scope) reviewed by at least one qualified professional, with crisis and ED templates reviewed by a mental-health professional; exercise cues reviewed by the S&C professional | Reviewers |
| G-10 | RLS tests pass for every table; no secrets in the bundle | Team |
| G-11 | Backups on; export and deletion tested end to end | Team |
| G-12 | You have completed the readiness screen yourself and accept the pilot is a usability test, not a health intervention | You |
| G-12a | SPDI-level basics in place for real health data: published privacy policy, written consent, reasonable security practices (Q-34); Play Health apps declaration filed before the first Play test track (R-12) | You + counsel |

### Gate 3 · Controlled beta (end of M8)

| # | Check | Owner |
|---|---|---|
| G-13 | Pilot exit review done; all Critical defects fixed | You + team |
| G-14 | All rules, templates, ~300 foods, exercises and evidence cards reviewed and signed off | Reviewers |
| G-15 | Beta eval suite (500 cases) passes; all Critical and High edge cases pass on the 4-device matrix | Team |
| G-16 | Privacy notice, terms and participation sheet reviewed by counsel, written to the DPDP standard because DPDP obligations begin on 13 May 2027, during the beta (R-03) | Counsel |
| G-17 | Incident process staffed: who reviews safety events, and within what time | You |
| G-18 | Store test tracks configured (Play closed testing, TestFlight external) | Team |

### Gate 4 · Public launch (end of beta)

| # | Check | Owner |
|---|---|---|
| G-19 | Guardrails held through beta: zero SEV1, zero unsourced numbers shown, safety reviews on time | You |
| G-20 | Week-4 retention and price survey support a viable business (file 17, file 21) | You |
| G-21 | External security test done; findings fixed | Team |
| G-22 | Restore drill done; point-in-time recovery on | Team |
| G-23 | Store listings, Data safety, health declaration and privacy details reviewed; no medical or outcome claims | Counsel + you |
| G-24 | DPDP obligations for the launch date mapped and implemented (Q-22) | Counsel |
| G-25 | Medical-device position confirmed for the stated intended use (Q-24) | Counsel |
| G-26 | Trademark search clear for the final name | Counsel |

## 2. Decisions that need **your** input

| # | Decision | My recommendation |
|---|---|---|
| D-01 | Approve the plan and start M0 | Approve |
| D-02 | Budget envelope: self-built or staffed | Self-built with paid reviewers (file 21) |
| D-03 | Skin | **Decided 19 Oct 2026:** 09 Block Party |
| D-04 | Kokum | **Decided 19 Oct 2026:** later extension, not in the current build |
| D-05 | Publish as individual or company | Take counsel and accountant advice before beta |
| D-06 | Working name | Keep "Form & Flow" provisional; trademark search before beta |
| D-07 | Pricing | **Decided 19 Oct 2026:** free for now; decide later |
| D-08 | Free-tier model split | Deferred while the app is free |
| D-09 | Conversation retention default and opt-in history | 90 days; history personalisation opt-in |
| D-10 | Launch language | English; Hindi later based on search data |
| D-11 | Food data route if permissions stall | Computed from public-domain ingredient data plus reviewed recipes |
| D-12 | Exercise media for pilot and beta | Licensed illustrations for pilot; commissioned shoot for beta |
| D-13 | Spend on zero-data-retention or a provider with India processing before launch | Decide after counsel's view on Q-23 |

## 3. Decisions the product team can make

- Exact stack versions, libraries and tooling within the ADRs (file 11).
- Database field names, indexes, migrations and API shapes within file 12.
- UI layout, component details and copy within the design and copy rules (files 09, 14 §7).
- Event names and dashboards within the event rules (file 17 §5).
- Test tools, CI setup, device matrix details (file 16).
- Sprint order within milestones (file 19).
- Prompt wording and model choice within the evaluation gates (file 13).

## 4. Decisions that belong to qualified professionals (not you, not the team)

- Every rule parameter marked [OPEN] for reviewer in file 13.
- Readiness questionnaire wording and dispositions.
- Safety, crisis and ED templates.
- Food values, serving units and recipes.
- Exercise selection, cues and contraindication mapping.
- Every legal obligation and its interpretation.
