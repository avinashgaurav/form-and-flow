# 17 · Analytics and success metrics

All targets below are **[HYP]**. Per the Phase 1 draft's own rule, numeric targets are set after the pilot gives a baseline; the numbers here are starting guesses to argue with, not commitments.

## 1. North-star metric

**Weekly followed-through users (WFU):** users who, in a calendar week, complete at least 60 per cent of their planned sessions **or** log food on at least 4 days, **and** open or act on their plan at least once.

Why this and not time-in-app: it counts people doing the thing the product exists for, and it cannot be gamed by chat volume or notifications. A rest week that the plan prescribed counts as followed through.

## 2. Metric tree

| Level | Metric | Definition | Starting target (beta) |
|---|---|---|---|
| Activation | Onboarding completion | Consent to accepted plan | 70 per cent |
| Activation | Time to first plan | Median minutes, consent to plan preview | 6 min or less |
| Activation | First action within 24 h | Session started or meal logged | 60 per cent |
| Habit | Weekly sessions done / planned | Per user, median | 70 per cent |
| Habit | Logging days per week | Median among numeric-mode users | 4 |
| Habit | Check-in completion | Share of active days | 60 per cent (H-11) |
| Trust | Plan change acceptance | Accepted / proposed in weekly review | 60 per cent (H-06) |
| Trust | Correction rate | Meals edited after parse / parsed meals | Falling week on week |
| Trust | "This is wrong" rate | Reports per 100 coach turns | Under 2 |
| Retention | Week-4 retention | Share of week-0 users with a WFU week in week 4 | 25 per cent |
| Outcome (self-reported) | Confidence | "I know what to do today" 1 to 5, monthly | 4 or above |
| Outcome (measured, only for opted-in users) | Strength trend | Share with a rising top set on a main lift over 8 weeks | Tracked, no target |

## 3. Guardrails (watched every week; a breach stops growth work)

| Guardrail | Definition | Threshold |
|---|---|---|
| Unsafe output | Validator-caught unsafe drafts per 1,000 turns, and any unsafe output shown | Any shown = SEV1 |
| Unsourced numbers shown | Number provenance failures that reached the user | Zero |
| Safety events reviewed late | Critical events not reviewed within 4 waking hours | Zero |
| Rest respected | Share of users given at least 1 rest day a week | 100 per cent |
| Pressure | Notifications per user per week | Median 5 or fewer |
| ED-signal rate | ED-pattern events per 1,000 users | Tracked; rising trend triggers review |
| Data rights | Export and deletion success | 100 per cent within stated time |
| Reliability | Crash-free sessions | 99.5 per cent or more |
| AI cost | Model cost per active user per month | Under $0.60 (file 11) |

## 4. Measurement rules

1. Separate numeric-mode and non-numeric-mode users in every nutrition metric.
2. Never use body weight as a success metric for the product, only as a user-chosen personal metric.
3. Outcomes over at least 4-week windows; never daily.
4. Engagement is not health. No claim of health improvement from app metrics.
5. No streaks, guilt or loss framing to move any metric.

## 5. Event dictionary (analytics tool)

Rule: events carry **no health values** (no weights, calories, symptoms, food names, pain locations, readiness answers). Food names are excluded because they can reveal religion or caste-linked diet. Safety events live only in the restricted `safety_events` table, never in analytics.

| Event | When | Properties (all non-sensitive) |
|---|---|---|
| `onboarding_step_completed` | Each step | `step`, `duration_s` |
| `onboarding_completed` | Plan accepted | `total_duration_s`, `limited_mode` (bool) |
| `plan_generated` | Plan built | `latency_ms`, `regeneration_count` |
| `plan_change_decided` | Weekly review decision | `decision`, `rule_family` (EN, PR, FB, FD, TR) |
| `session_started` / `session_completed` | Player | `planned` (bool), `duration_s`, `shortened` (bool), `swaps_count` |
| `set_logged` | Each set | `sync_state` |
| `meal_logged` | Save | `source` (search, text_parse, saved_meal, recipe), `items_count`, `edited_after_parse` (bool), `time_to_log_s` |
| `check_in_completed` | Check-in | `duration_s` |
| `coach_turn` | Each turn | `latency_ms`, `fallback_used` (bool), `actions_count` |
| `coach_action_decided` | Confirm or reject | `action_type`, `decision` |
| `coach_feedback` | Thumbs or report | `kind` |
| `notification_opened` | Open from push | `category` |
| `export_requested` / `deletion_requested` | Privacy | none |
| `sync_failed` | Sync error | `error_code` |

Analytics collection requires the optional analytics consent; without it only crash reports (also consent-based where counsel advises) are sent.

## 6. Founder-pilot scorecard (weekly, n = 1)

| Measure | Target |
|---|---|
| Days the app was used | 5 of 7 |
| Median time to log a meal | Under 30 s (H-02) |
| Meals needing edits after parse | Falling each week |
| Planned sessions done | 70 per cent or more |
| Bugs found, by severity | All Critical fixed within 48 h |
| Times another app was needed to fill a gap | Listed and reviewed each week |
| Unsourced numbers seen | Zero |
| Anything that felt unsafe, preachy or guilt-inducing | Listed; each one fixed or explained |
