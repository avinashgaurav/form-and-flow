# 19 · Implementation milestones

Assumes you build with AI coding tools, part-time alongside a job, with paid professional reviewers for specific tasks. Durations are **[HYP]**; the earlier drafts gave similar ranges without a stated basis. Nothing in M1 or later starts until you approve this plan (go/no-go G-01).

## 1. Timeline

```mermaid
gantt
  dateFormat YYYY-MM-DD
  title Indicative plan from approval (start date illustrative)
  section Ready
  M0 Approvals, reviewers, licences      :m0, 2026-10-26, 3w
  section Design
  M1 Prototype, research, design system  :m1, after m0, 3w
  section Build
  M2 Foundations: auth, data, sync, engines :m2, after m1, 3w
  M3 Training loop                        :m3, after m2, 2w
  M4 Nutrition loop                       :m4, after m3, 3w
  M5 Coach, weekly review, safety         :m5, after m4, 3w
  section Pilot
  M6 Hardening and pilot gate             :m6, after m5, 2w
  M7 Founder pilot                        :m7, after m6, 4w
  section Beta
  M8 Beta prep and professional review    :m8, after m7, 4w
  M9 Controlled beta                      :m9, after m8, 6w
```

Sum of the bars: about 19 weeks from approval to the start of the founder pilot (around 8 March 2027 if M0 starts 26 October 2026), 23 weeks to the end of the pilot, and 33 weeks to the end of beta (around mid-June 2027), part-time. A full-time build would roughly halve M2 to M6.

## 2. Milestones and exit criteria

| ID | Milestone | Main outputs | Exit criteria |
|---|---|---|---|
| M0 | Approvals and unblockers | Plan approved; reviewers engaged (dietitian, S&C professional, counsel); licence requests sent to NIN (IFCT, DGI) and the INDB authors; PAR-Q+ decision; name shortlist | Written replies or a fallback chosen for each licence; reviewers contracted |
| M1 | Design and research | Discovery interviews (12 to 20); competitor teardown; clickable prototype of onboarding, Today, player, quick log, weekly review; design tokens | H-01, H-02, H-04, H-07 have verdicts; prototype passes 2 rounds of 5 to 8 participants |
| M2 | Foundations | Repo, CI, Supabase projects (dev, staging, prod in Mumbai); schema and RLS with tests; auth; consent; sync queue; engines package skeleton with golden tests | F-01 to F-04 pass; RLS suite green; sync passes EC-01 to EC-03 |
| M3 | Training loop | Exercise library (60 to 80), templates, plan generation and preview, Today and check-in, player, set logging, swap, shorten, progression, pain flow, safety stop | F-05 to F-11 pass |
| M4 | Nutrition loop | Food catalogue (about 300), search with aliases, quick log parse, portions and oil, saved meals, targets and non-numeric mode | F-12 to F-15 pass; parse eval at least 90 per cent |
| M5 | Coach and review | Coach pipeline with validators, evidence cards, memory viewer, weekly review, progress views, ED-aware mode, notifications | F-16 to F-20, F-24 pass; pilot eval suite (180 cases) green |
| M6 | Hardening | Export and deletion, report flow, conflict surface, accessibility pass, device tests, backups, monitoring | Pilot release gate (file 16 §4) |
| M7 | Founder pilot | 4+ weeks of daily use; weekly scorecard (file 17 §6) | Pilot exit review: go, fix, or stop |
| M8 | Beta prep | Video shoot or licence; Google and Apple sign-in; admin queues; observance calendar; beta eval suite (500); professional review of all content and rules; privacy notice and terms reviewed; store test tracks | Beta release gate |
| M9 | Controlled beta | 12 to 25 consenting adults across personas; weekly safety and quality reviews | Launch go/no-go inputs (file 23) |

## 3. Critical path and risks

| Risk | Effect | Mitigation |
|---|---|---|
| Food data licence refused or slow | M4 slips | Fallback: compute Indian dishes from public-domain ingredient data (USDA FoodData Central, T-10) plus our own reviewed recipes; label values "computed from recipe" |
| Reviewer availability | M8 slips; pilot templates unreviewed | Engage in M0; pay for a fixed review package |
| DPDP obligations start on 13 May 2027, during beta prep or beta (R-03) | Rework if privacy is bolted on late | Build notice, consent, rights, breach and log retention to the DPDP standard in M2 to M6 |
| Edge Function limits | Coach latency or failures | Measure in M2 week 1; fall back to a small Node service in Mumbai |
| Scope creep from Kokum | MVP slips | Kokum is a separate product (file 24) |
| Part-time capacity | Everything slips | Cut P0 coach chat to action cards first (file 10 §3); F-16 re-scoped for gate G-07 |
