# Form & Flow (working name): Phase 1 research and plan

India-first AI fitness and nutrition coach · Android and iOS · adults 18+ · version 0.3 · 19 October 2026

> **Note (October 2026):** these planning docs were written before the build, for a solo founder, so "you" means the product owner. The build has since started; see the [root README](../README.md) for what exists today.

**Status (at the time of writing):** research and planning only. No code, infrastructure or accounts have been created. Phase 2 (building) starts only when you approve this plan (gate G-01).

## How to read this

Start with **01** (one page). Then **23** for the decisions waiting on you. Everything else is reference.

| # | File | What it answers |
|---|---|---|
| 01 | [Executive summary](01-executive-summary.md) | The plan on one page |
| 02 | [Research method and sources](02-research-methodology-and-sources.md) | How we checked, and every claim with its source and status |
| 03 | [Competitor matrix](03-competitor-matrix.md) | Who does what, at what India price, and where the gap is |
| 04 | [User research hypotheses](04-user-research-hypotheses.md) | What we believe and how we will test it |
| 05 | [Personas and journeys](05-personas-and-journeys.md) | Who it is for, who it is not for, key journeys |
| 06 | [Product requirements](06-product-requirements.md) | Vision, requirements, non-goals, pricing hypotheses |
| 07 | [Screen inventory](07-screen-inventory.md) | Every screen, state, validation and edge case |
| 08 | [Onboarding flow](08-onboarding-flow.md) | Step-by-step onboarding and readiness screening |
| 09 | [Design system and media](09-design-system-and-media.md) | Tokens, components, charts, imagery and video |
| 10 | [Feature prioritisation](10-feature-prioritization.md) | What first, scored |
| 11 | [Architecture and technology](11-architecture-and-technology.md) | Stack comparison and decisions |
| 12 | [Database and API](12-database-and-api.md) | Tables, permissions, endpoints, sync |
| 13 | [AI and evidence governance](13-ai-and-evidence-governance.md) | How the coach works, rules, evaluation, review |
| 14 | [Safety and regulatory risk register](14-safety-and-regulatory-risk-register.md) | Risks, escalation rules, legal landscape |
| 15 | [Privacy and security](15-privacy-and-security.md) | Data inventory, consent, rights, controls |
| 16 | [Testing and edge cases](16-testing-and-edge-cases.md) | Test layers, edge-case matrix, release gates |
| 17 | [Analytics and metrics](17-analytics-and-metrics.md) | North star, guardrails, events |
| 18 | [MVP scope](18-mvp-scope.md) | MVP features with acceptance criteria |
| 19 | [Implementation milestones](19-implementation-milestones.md) | Timeline and exit criteria |
| 20 | [Launch plan](20-launch-plan.md) | Pilot, beta, launch, expansion |
| 21 | [Effort and cost](21-effort-and-cost.md) | Cost ranges with assumptions |
| 22 | [Unresolved questions](22-unresolved-questions.md) | Open questions with owners |
| 23 | [Go/no-go and decisions](23-go-no-go-and-decisions.md) | Gates, and who decides what |
| 24 | [Kokum](24-kokum-extension.md) | Kokum: a later extension, not in the current build |

## Labels used throughout

| Label | Meaning |
|---|---|
| **[FACT]** | Confirmed against a named source; claim ID points to file 02 |
| **[HYP]** | A hypothesis we will test |
| **[REC]** | Our recommendation |
| **[OPEN]** | A decision not yet made; owner in file 22 |

Claim IDs: **M** market and competitors · **E** exercise and nutrition evidence · **R** regulatory, legal and store policy · **T** technology and data sources · **K** Kokum repository.

## What changed from the two earlier drafts

1. The claim that no Indian product combines training, nutrition and coaching was **wrong**: Healthify, cult.fit Transform and FITTR do, mostly through human coaches. The positioning is narrowed accordingly (file 03).
2. Training rules cite the **2026 ACSM resistance-training position stand**, which replaced the widely used 2009 one (file 13).
3. The "0.5 to 1 per cent of body weight per week" weight-loss rate comes from bodybuilding research; the public-health bound is **0.5 to 1 kg per week** (file 13, EN-02).
4. A fibre target could **not** be verified from a primary Indian source; no fibre target ships until it is (Q-12).
5. India's 2024 dietary guidelines and the 2017 food composition tables **cannot be embedded in an app without NIN's written permission**; this is now on the critical path (file 19).
6. PAR-Q+ cannot be built into an electronic form without written consent; the plan uses reviewed in-house wording instead (file 08).
7. Pricing hypotheses moved down to match verified India price anchors (file 06, file 21).
8. Legal timing verified: health data is "sensitive" under the 2011 SPDI Rules until DPDP obligations start on **13 May 2027**, during the beta; Apple requires explicit consent before data goes to a third-party AI, so AI processing is now a separate consent and the app still works without it (files 14, 15).
9. Decided 19 October 2026: Kokum is a later extension, not in the current build, and the app is free for now; pricing comes later (files 06, 24).
10. Added: one-rule architecture borrowed from Kokum, number-provenance checks, safety stop and crisis handling, sync conflict surface, deletion ledger, and a cost model with real vendor prices.
