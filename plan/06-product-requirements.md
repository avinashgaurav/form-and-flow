# 06 · Product requirements (PRD)

Working name: **Form & Flow** (provisional; not trademark-checked). Version 0.3, 19 October 2026.

## 1. Vision

**[REC]** A coach in your pocket that knows your goal, your food, your time and your body's signals, plans the next step, and changes the plan for a reason you can see.

One-line positioning **[HYP]**: *The fitness coach that plans around Indian food and real weeks, and never makes up a number.*

Competitive note **[FACT, claims M-09 to M-11, M-13]:** Healthify, cult.fit Transform and FITTR already combine training, nutrition and coaching in India, using human coaches or an AI assistant with an unpublished method. Our wedge is narrower: automatic, rule-based adaptation of both training and nutrition from the user's own logs, with every change explained, at app-level prices.

## 2. Problem

**[HYP]** Adults in India who want to get fitter use two or three disconnected tools: a workout app, a calorie counter built on non-Indian food data, and generic advice from social media. None of them sees the whole week, so plans break on the first busy day, food logs are wrong or abandoned, and advice is either generic or unsafe.

## 3. Value proposition

| For | Who | The product | Unlike |
|---|---|---|---|
| Adults 18+ in India | want fat loss, muscle, strength, stamina or better habits | plans training and food together, adapts weekly from what actually happened, and explains every change | single-purpose trackers and chatbots that either do not adapt or adapt without evidence |

## 4. The one rule [REC]

Borrowed from Kokum (its AGENTS.md), and the most important architectural decision in this plan:

> **The coach never states a number, a target or a safety decision that code did not compute.**

Calorie and protein targets, nutrient totals, set and rep prescriptions, progression, deloads, eligibility and red-flag responses all come from deterministic, tested engines. The language model explains, converses, parses free text into structured drafts, and proposes actions that code validates. If the model and the engine disagree, the engine wins and the model's text is discarded.

## 5. Differentiation

| # | Principle | What it means in the product | Evidence it matters |
|---|---|---|---|
| D1 | One plan for training and food | One weekly plan object holds sessions, food guidance and habits | [HYP] H-01, H-06 |
| D2 | Changes for a reason | Every plan change shows rule, data and source | [HYP] H-06 |
| D3 | Indian food first | Indian dishes, Hinglish aliases, oil and ghee levels, cooked versus raw | [HYP] H-01, H-14 |
| D4 | Honest numbers | Ranges where uncertain; "not enough data" is an allowed answer | [HYP] H-03 |
| D5 | Safe by construction | Screening, red-flag stops, ED-aware mode, no supplement prescribing | [REC] file 14 |
| D6 | Bundle-ready (later) | Kokum, a separate product, may be bundled later; nothing in this app depends on it | File 24 |

## 6. Product principles

1. **Next action over dashboard.** Today shows one thing to do.
2. **Correctable everything.** Any recommendation can be edited, swapped or declined in two taps.
3. **No guilt mechanics.** No streak-loss alarms, no backlogs, no shame copy.
4. **Rest is a valid recommendation.**
5. **Optional by default.** Weight, measurements and photos are optional unless a chosen feature needs them.
6. **Works offline for logging.** Logging never waits for the network or the model.
7. **Explain, then cite.** Reasons first, source on tap.

## 7. Functional requirements

Priority: **P0** = personal pilot MVP; **P1** = controlled beta; **P2** = public launch or later. Acceptance criteria for every P0 item are in file 18.

### 7.1 Account and consent

| ID | Requirement | Priority |
|---|---|---|
| FR-AC-01 | Sign up and sign in with email OTP; Google and Apple sign-in | P0 (email), P1 (Google, Apple) |
| FR-AC-02 | Age gate: 18+ self-declaration with date of birth; block under 18 | P0 |
| FR-AC-03 | Consents exactly as listed in file 15 §4: required core processing; explicit AI processing naming the provider (app usable without it); optional analytics, crash reports, reminders, conversation-history personalisation, parse improvement, and (beta) human review of a conversation sample | P0 |
| FR-AC-04 | Consent history with versions; withdraw any optional consent in settings | P0 |
| FR-AC-05 | Session expiry and secure recovery | P0 |
| FR-AC-06 | In-app account deletion | P0 |

### 7.2 Onboarding and profile

| ID | Requirement | Priority |
|---|---|---|
| FR-ON-01 | Primary goal plus up to two secondary goals from the goal taxonomy | P0 |
| FR-ON-02 | Baseline: height, weight (optional for non-weight goals), activity level, training experience | P0 |
| FR-ON-03 | Readiness screening with reviewed wording; branch to safety pathway | P0 |
| FR-ON-04 | Food profile: pattern (veg, egg, non-veg, Jain, vegan), allergies (hard), dislikes (soft), cuisines, budget band, cooking access | P0 |
| FR-ON-05 | Fasting observances as hard constraints (Kokum D-012) | P1 |
| FR-ON-06 | Training profile: location, equipment, days, session length | P0 |
| FR-ON-07 | Coaching style and check-in time | P0 |
| FR-ON-08 | Numeric or non-numeric nutrition mode | P0 |
| FR-ON-09 | Save and resume onboarding | P0 |

### 7.3 Plan

| ID | Requirement | Priority |
|---|---|---|
| FR-PL-01 | Generate a weekly plan (sessions, food guidance, up to 3 habits) from engines | P0 |
| FR-PL-02 | Plan preview with assumptions and reasons before acceptance | P0 |
| FR-PL-03 | Edit constraints and regenerate (max 5 regenerations a day) | P0 |
| FR-PL-04 | Versioned plans; every change logged with reason and rule ID | P0 |
| FR-PL-05 | Weekly review proposes at most 2 changes; user accepts each | P0 |
| FR-PL-06 | Move, skip or shorten a session without increasing weekly load | P0 |

### 7.4 Training

| ID | Requirement | Priority |
|---|---|---|
| FR-TR-01 | Curated exercise library (60 to 80 exercises at pilot) with reviewed text cues | P0 |
| FR-TR-02 | Demonstration media per exercise, with text fallback | P0 (text + images), P1 (video) |
| FR-TR-03 | Workout player: warm-up, sets, reps or time, rest timer, skip, swap | P0 |
| FR-TR-04 | Set logging saved locally on tap and synced | P0 |
| FR-TR-05 | Substitutions by movement pattern, equipment and pain flags | P0 |
| FR-TR-06 | Progression: double progression with effort rating; scheduled and triggered deloads | P0 |
| FR-TR-07 | "I only have X minutes" shortened session that keeps the session's purpose | P0 |
| FR-TR-08 | Cardio and steps guidance (talk-test intensity) | P1 |
| FR-TR-09 | Mobility sessions | P1 |

### 7.5 Nutrition

| ID | Requirement | Priority |
|---|---|---|
| FR-NU-01 | Food catalogue with Indian dishes, aliases, serving units, cooked/raw state, source and licence | P0 |
| FR-NU-02 | Search with Hinglish and spelling tolerance | P0 |
| FR-NU-03 | Text logging ("2 roti, dal, bhindi") parsed into editable items | P0 |
| FR-NU-04 | Portion selection with household units (katori (bowl), piece (roti, idli and similar), tbsp, tsp, cup, glass, g, ml) | P0 |
| FR-NU-05 | Oil/ghee level selector for cooked dishes (light, normal, rich) with stated assumptions | P0 |
| FR-NU-06 | Saved meals and recipes; editing a recipe never rewrites past logs | P0 |
| FR-NU-07 | Targets: energy range and protein range (fibre shown as information only, no target, until FB-01 is resolved); or non-numeric plate guidance | P0 |
| FR-NU-08 | Daily summary shows logged versus estimated and missing data | P0 |
| FR-NU-09 | Substitution suggestions within diet and allergy constraints | P1 |
| FR-NU-10 | Grocery list from planned meals | P1 |
| FR-NU-11 | Barcode scan for packaged food | P1 |
| FR-NU-12 | Photo-assisted logging with ranges and mandatory confirmation | P2 |
| FR-NU-13 | Budget-aware protein suggestions | P1 |

### 7.6 Coach

| ID | Requirement | Priority |
|---|---|---|
| FR-CO-01 | Chat with the coach about the plan, logs and general fitness | P0 |
| FR-CO-02 | Coach proposes structured actions (swap, shorten, reschedule, log draft, preference update); user confirms consequential ones | P0 |
| FR-CO-03 | Evidence cards with sources shown on tap | P0 |
| FR-CO-04 | "What my coach knows" viewer with edit and delete | P0 |
| FR-CO-05 | Safety classification on every turn; red-flag responses from reviewed templates | P0 |
| FR-CO-06 | Daily 3-tap check-in (energy, time, pain) | P0 |
| FR-CO-07 | Thumbs up/down and "this is wrong" report on every coach message | P0 |
| FR-CO-08 | Graceful degradation when the model is down: logging and plan still work | P0 |

### 7.7 Progress

| ID | Requirement | Priority |
|---|---|---|
| FR-PR-01 | Consistency view (sessions and logging days per week) | P0 |
| FR-PR-02 | Trend weight (smoothed) if weight is tracked; raw points visible | P0 |
| FR-PR-03 | Strength history per exercise; verified personal bests only | P0 |
| FR-PR-04 | Energy, sleep quality (self-rated) and measurements (optional) | P1 |
| FR-PR-05 | Milestones that are not weight-based | P1 |

### 7.8 Safety, privacy, support, notifications, admin

| ID | Requirement | Priority |
|---|---|---|
| FR-SA-01 | Red-flag symptom stop with emergency guidance | P0 |
| FR-SA-02 | Pain report flow and movement-pattern flags | P0 |
| FR-SA-03 | Eligibility restrictions for higher-risk groups (file 14) | P0 |
| FR-SA-04 | ED-aware mode | P0 |
| FR-PV-01 | Data export (JSON + CSV) | P0 |
| FR-PV-02 | Privacy centre: consents, data use, connected services | P0 |
| FR-SU-01 | Report incorrect food data, unsafe advice, bugs | P0 |
| FR-NO-01 | Opt-in reminders by category, quiet hours, pause all | P0 |
| FR-AD-01 | Admin: content review queue (exercises, foods, evidence cards) | P1 |
| FR-AD-02 | Admin: safety incident queue with audit trail | P1 |
| FR-BI-01 | Subscriptions and entitlements | P2 |
| FR-IN-01 | Health Connect and HealthKit (steps, workouts, weight) | P1 |

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | Local logging interactions P95 under 200 ms on a mid-range Android phone; standard reads P95 under 500 ms; first coach token under 3 s P50 (targets, not measurements) |
| Offline | Workout player, set logging, meal logging and today's plan usable offline; sync queue with idempotency |
| Reliability | Crash-free sessions at least 99.5 per cent in beta; zero known data-loss defects at each release gate |
| Accessibility | WCAG 2.2 AA intent for contrast and text; platform screen readers; text scaling to 200 per cent; reduced motion |
| Localisation | English UI at launch; all strings externalised; metric default, imperial supported; IST default, device timezone respected |
| Security | OWASP MASVS-aligned (file 15); no secrets in the app bundle |
| Privacy | Data minimisation; no health data in analytics or ads; deletion within the stated window |
| Devices | Android 10+ and iOS 17+ as working targets; confirm against Expo SDK 58's supported minimums at build start |

## 9. Roadmap summary

| Phase | Goal | Contents |
|---|---|---|
| MVP (personal pilot) | Prove the daily loop on one life | All P0 above |
| Beta (12 to 25 adults) | Prove usability and safety across personas | P1 items, admin queues, Google and Apple sign-in, video, observances |
| Public India launch | Prove retention and willingness to pay | Subscriptions, store presence, professional sign-off |
| Possible Kokum bundle (separate product) | Your call, later | File 24 |
| Later | Wearables, photo logging, human coaches, regional languages | File 10 |

## 10. Pricing hypotheses

**Decision (you, 19 October 2026): the app is free for now.** No subscriptions in the pilot or beta; the tiers below stay hypotheses for a later decision.

See file 21 for unit costs and file 03 for verified competitor prices.

| Tier | Contents | Price hypothesis **[HYP]** |
|---|---|---|
| Free | Onboarding, starter plan, full manual logging, exercise library, limited coach messages (for example 10 a week) answered by the smaller, cheaper model tier, export and deletion | ₹0 |
| Premium | Adaptive weekly plan, unlimited coach within fair use, weekly review, deeper progress, meal planning | ₹199 to ₹349 a month, or ₹1,499 to ₹2,999 a year (to validate with H-10). Anchors verified in file 03: Fitness+ ₹999/yr, Fitbod about ₹1,999/yr, Healthify+ ₹2,500/yr, MyFitnessPal ₹3,099/yr, MacroFactor ₹6,300/yr |
| Later: human add-on | Reviewed check-ins with a qualified coach or dietitian | Priced per session or monthly; separate service terms |

Rules: logging, export and deletion are never paywalled; safety features are never paywalled; no supplement affiliate revenue.

## 11. Explicit non-goals

- Diagnosing, treating or managing any medical condition.
- Rehabilitation programmes for injuries.
- Supplement, medication or hormone recommendations.
- Users under 18.
- Before-and-after body photo marketing or transformation guarantees.
- Social feeds, leaderboards or public challenges in MVP and beta.
- Selling or sharing health data for advertising.
- Wearable-driven auto-adjustment in MVP.
- Replacing a dietitian, physiotherapist or doctor.
