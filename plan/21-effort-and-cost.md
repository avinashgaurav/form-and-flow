# 21 · Estimated effort and cost

Vendor prices are **[FACT]** with claim IDs (verified 19 October 2026). Professional fees, shoot costs, legal fees and hours are **[HYP] assumptions**, not quotes; get quotes in M0. Exchange rate **₹95 per US dollar** (RBI/FBIL reference rate 95.02 on 16 October 2026, claim T-25); it moves, so re-check. Arithmetic in this file was computed by script and re-checked.

## 1. Effort

| Milestone (file 19) | Part-time weeks | What you do | What you buy |
|---|---|---|---|
| M0 Approvals and unblockers | 3 | Requests, interviews with reviewers | Reviewer and counsel time |
| M1 Design and research | 3 | Interviews, prototype, tests | Research incentives; optional designer |
| M2 to M6 Build and hardening | 13 | Build with AI coding tools | Nothing beyond infrastructure |
| M7 Founder pilot | 4 | Daily use, fixes | |
| M8 Beta prep | 4 | Integrations, review loop | Exercise shoot; full content review; counsel |
| M9 Beta | 6 | Support, safety review, fixes | |
| **Total** | **33** | | |

## 2. Self-built path: one-time costs to the end of beta

| Item | Low | High | Basis |
|---|---|---|---|
| Dietitian review: rules, ~300 foods, serving units, templates (30 to 50 h at ₹1,500 to ₹3,000/h) | ₹45,000 | ₹1,50,000 | Assumed rate; directory listings show ₹300 to ₹2,500 per consultation (UNVERIFIED), and project review work is usually priced higher |
| S&C reviewer: exercises, templates, rules, contraindication map (20 to 35 h at ₹1,000 to ₹2,500/h) | ₹20,000 | ₹87,500 | Assumed rate |
| Mental-health professional: crisis and ED templates (4 to 8 h at ₹2,000 to ₹4,000/h) | ₹8,000 | ₹32,000 | Assumed rate |
| Counsel: privacy notice, terms, claims review, structure advice | ₹75,000 | ₹2,50,000 | Assumed |
| Trademark search and filing | ₹10,000 | ₹30,000 | Assumed |
| Pilot exercise illustrations: own drawings, up to 80 licensed at $25 each perpetual | ₹0 | ₹1,90,000 | WorkoutLabs per-illustration price (T-16) |
| Beta exercise shoot, 60 to 80 exercises | ₹1,50,000 | ₹4,00,000 | Assumed |
| Food data licence | ₹0 | ₹2,00,000 | Unknown until NIN, INDB or FatSecret reply (Q-18 to Q-20) |
| Research incentives and price survey | ₹7,500 | ₹50,000 | Assumed |
| Optional freelance designer | ₹0 | ₹1,50,000 | Assumed |
| Apple Developer Program (1 year) and Google Play registration ($99 + $25) | ₹11,780 | ₹11,780 | T-24 |
| **One-time total** | **₹3.27 lakh** | **₹15.51 lakh** | |

## 3. Recurring infrastructure

| Item | Pilot (per month) | Beta, 25 users (per month) | Basis |
|---|---|---|---|
| Supabase Pro (prod), plus small extra compute | $25 to $45 | $25 to $45 | T-04 |
| LLM | about $1 | about $15 ($0.60 per user) | T-06, T-23 |
| EAS builds and updates | $0 to $19 | $0 to $19 | T-01 |
| Email OTP provider | $0 to $20 | $0 to $20 | Assumed |
| PostHog, Sentry, Expo Push, FCM | $0 | $0 | Free tiers (T-17, T-20, T-21) |
| **Monthly** | **$26 to $85 (₹2,470 to ₹8,075)** | **$40 to $99 (₹3,800 to ₹9,405)** | |

Non-production: dev runs on a local Supabase stack; a staging project's smallest compute (about $10 a month, inferred from the Pro plan's $10 compute credit, T-04) sits inside the high end of the Supabase row.

Infrastructure to the end of beta (about 5 pilot-phase months and 3 beta-phase months): **₹23,750 to ₹68,590**.

At launch add point-in-time recovery (about $100 a month, T-04) and an external security test (₹75,000 to ₹2,50,000, assumed).

## 4. Totals to the end of beta

| Path | Low | High |
|---|---|---|
| **Self-built** (you build; paid reviewers, counsel, media) | **₹3.51 lakh** | **₹16.20 lakh** |
| **Staffed** (adds 2 developers for 5 months at ₹1 to ₹2 lakh a month each, a designer for 2 months at ₹0.8 to ₹1.5 lakh, and QA for 2 months at ₹0.6 to ₹1 lakh: ₹12.8 to ₹25 lakh, all assumed) | ₹16.31 lakh | ₹41.20 lakh |

The earlier draft's ₹7 to 22 lakh had no stated basis; these ranges show their inputs so each can be replaced with a quote.

**Biggest swing factors:** the video shoot, counsel scope, and whether NIN data permission is free.

## 5. Unit economics at launch [HYP]

Per paying user per month, assuming the price includes 18 per cent GST (claim R-18; the 5 per cent physical well-being rate may apply, to confirm), a 15 per cent store fee on subscriptions (Google Play in India, and Apple with the Small Business Program; Apple's standard rate is 30 per cent in a subscriber's first year; claims R-14, R-16), $0.60 of model cost and ₹10 of other infrastructure:

| Annual price | Monthly equivalent | After GST | After store fee | Model cost | Margin before support and marketing |
|---|---|---|---|---|---|
| ₹1,499 | ₹125 | ₹106 | ₹90 | ₹57 | ₹23 |
| ₹1,999 | ₹167 | ₹141 | ₹120 | ₹57 | ₹53 |
| ₹2,999 | ₹250 | ₹212 | ₹180 | ₹57 | ₹113 |

**What this means:**

1. Model cost is the largest variable cost. At ₹1,499 a year the margin is thin.
2. **Free users must run on the smaller model.** About 43 coach turns a month cost about $0.02 (₹2) on the Haiku tier versus about $0.47 on the Sonnet tier (T-06). Recommendation D-08.
3. Prompt caching and batch discounts could lower costs further; not modelled.
4. If the beta shows heavy coach use, cap Premium turns at a fair-use level rather than raise prices.
