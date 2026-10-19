# 15 · Privacy and security plan

Legal statements are fact-finding with claim IDs (R-xx), **not legal advice**. Indian counsel must review before beta and again before launch (go/no-go G-16, G-24). Controls are **[REC]**.

## 1. Principles

1. Collect only what the chosen feature needs; weight, measurements and history use are optional where possible.
2. Health and fitness data never feeds advertising, data brokers or unrelated profiling.
3. The same safeguards apply to the founder pilot as to the public product: real data is real data.
4. Users can see, correct, export and delete what we hold, including what the coach "knows".

## 2. Data inventory

| Data | Examples | Required? | Purpose | Stored | Sent to | Retention [REC, counsel to confirm] |
|---|---|---|---|---|---|---|
| Account | Email, auth identifiers | Yes | Sign-in, recovery | Supabase Auth (Mumbai) | Email delivery provider | Account life |
| Eligibility | Birth year (date of birth used once for the check) | Yes | Age gate | `profiles` | None | Account life |
| Profile settings | Timezone, units, tone, nutrition mode | Yes | Service | `profiles` | None | Account life |
| Body data | Height; weight; measurements | Height yes; others optional | Energy estimates, trends | `profiles`, `progress_entries` | LLM only as derived ranges, not raw history | Account life |
| Readiness answers and restrictions | R1 to R10, derived restrictions | Yes | Safety | Restricted tables | Never to analytics; LLM gets restriction codes only | Account life |
| Training logs | Sets, sessions, feel | Optional (feature use) | Coaching | `workout_sessions`, `exercise_sets` | LLM as aggregates | Account life |
| Food logs | Meals, portions | Optional | Coaching | `meal_logs`, `meal_log_items` | LLM as aggregates; parse text for parsing only | Account life |
| Check-ins | Energy, time, pain yes/no | Optional | Daily adjustment, safety | `check_ins` | LLM for that day | Account life |
| Coach conversations | Messages | Optional | Coaching | `coach_messages` | LLM | 90 days default; user may choose longer or shorter |
| Parse audit text | Raw meal text, parsed versus confirmed | Optional | Accuracy improvement | `parse_audits` | LLM at parse time | 90 days |
| Safety events | Red flags, pain, ED signals | Created by the system | Safety review | `safety_events` (restricted) | Never | 2 years, then aggregate |
| Consent records | Purpose, version, time | Yes | Proof of consent | `consent_records` | None | Account life plus the legal minimum after deletion |
| Device tokens | Push tokens | Optional | Reminders | `device_tokens` | Expo Push, FCM, APNs | Pruned after 60 days unseen |
| Product analytics | Events with no health values | Optional consent | Product improvement | PostHog (US or EU) | PostHog | 12 months |
| Crash reports | Stack traces, device model | Optional consent (`crash_reports`) | Stability | Sentry | Sentry | 90 days |
| Exports | Generated files | On request | User rights | Storage | User | Link 24 h; file deleted after 7 days |
| Support reports | Description, app version, trace ID | On request | Support | `reports` | None | 1 year |
| Security logs | Authentication, access and processing logs (no content) | System | Security, legal obligation | Restricted log store | None | At least 1 year, including after deletion (R-05); then erased |

**Not collected:** precise location, contacts, photos (MVP), microphone audio (dictation stays in the phone keyboard, as in Kokum D-010), government IDs, payment card data (stores handle billing), caste or religion (fasting observances are stored as dietary rules, with a clear note on why).

## 3. Processors and transfers

| Processor | Role | Location | Notes |
|---|---|---|---|
| Supabase | Database, auth, storage, functions | Mumbai region (T-03) | SOC 2 Type 2 report on Team plan and above (T-05) |
| Anthropic (Claude API) | Coach and parsing | Outside India | No training on API customer content; retention up to 30 days by default; zero-retention by agreement (T-07) |
| PostHog | Product analytics | US or EU (T-20) | No health values in events |
| Sentry | Crash reporting | US or EU | PII scrubbing on |
| Expo Push, FCM, APNs | Notification delivery | Outside India | Token plus notification text only; text never contains health values |
| Email provider | OTP and status emails | To choose | No health data in emails |
| RevenueCat (launch) | Entitlements | Outside India | Purchase metadata only |

## 3a. Legal timeline and what applies when (claims R-01 to R-06, R-25)

| Period | Regime | What we must do |
|---|---|---|
| Now to 12 May 2027 (pilot, beta prep) | IT Act s.43A and **SPDI Rules 2011**: health data is sensitive personal data | Written (electronic) consent for sensitive data; published privacy policy; reasonable security practices; transfer conditions for the LLM provider |
| From 13 May 2027 (beta and launch) | **DPDP Act and Rules** in force for notice, consent, security, breach, rights, cross-border and penalties | Itemised notice; consent records; withdrawal as easy as giving; rights handling; breach notice to users and the Board without delay, with the detailed report to the Board within 72 hours; one-year log retention; reasonable security safeguards (the highest penalty band) |

The beta straddles 13 May 2027, so build to the DPDP standard from the start.

### Retention conflict to resolve (Q-33)

The DPDP Rules require keeping certain logs and processing data for at least one year for security purposes, including after account deletion (R-05). Our design promises fast deletion and 90-day chat retention. **Proposed reconciliation [REC, counsel to confirm]:** deletion removes everything from active systems within 7 days; a separate, access-restricted **security log store** keeps only what the Rules require (authentication, access and processing logs, without message content or logs of meals and workouts) for one year, then erases it. The notice says so plainly.


## 4. Consent and notices

| Item | Design |
|---|---|
| Notice | Plain-language summary on S03 with a link to the full notice; itemised list of data and purposes; how to withdraw; how to complain |
| Required consent | Core processing of profile, logs and readiness answers to provide the plan and logging (all computed by our own code) |
| AI-processing consent (separate, explicit, default off until chosen) | Sending pseudonymous context to the named third-party AI provider for coach replies and text parsing. Apple requires explicit permission before sharing personal data with third-party AI (R-15). **If declined, the plan, workouts, logging and safety still work**, because the engines decide; only coach chat and text parsing are switched off |
| Other optional consents (default off) | `analytics` product analytics; `crash_reports`; `reminders`; `history_personalisation` (use of conversation history); `parse_improvement` (anonymous use of corrections to improve parsing); `human_review_sample` (beta only: a reviewer may read a random sample of your coach conversations for safety and quality) |
| Withdrawal | Any optional consent can be withdrawn in S32 as easily as it was given; effect within one request |
| Versioning | New notice version re-prompts on next open; history kept in `consent_records` |
| Language | English at launch; counsel to advise on notice language obligations |

## 5. User rights workflows

| Right | Flow | Target |
|---|---|---|
| Access | S32 shows categories; export gives the full copy | Export within 24 h |
| Correction | Every profile field, log and memory item editable in-app | Immediate |
| Erasure | S33 deletion (re-auth); deletion executor clears every store in §2 and processors where possible; deletion ledger | Within 7 days [REC]; legal deadline per counsel |
| Withdraw consent | S32 toggles | Immediate |
| Grievance | In-app report plus a published contact; acknowledgement and response targets per counsel | Per counsel |
| Nomination (if applicable under the law) | Counsel to advise | |

## 6. Security controls (mapped to OWASP MASVS groups)

| MASVS group | Controls |
|---|---|
| STORAGE | Tokens in SecureStore; logs in SQLite encrypted with SQLCipher in development builds; no health data in app logs; backups of the app sandbox excluded where the platform allows |
| CRYPTO | Platform crypto only; no home-made crypto; TLS 1.2+ everywhere |
| AUTH | Email OTP with rate limits and lockout; short-lived access tokens with refresh; re-auth for export and deletion; explicit confirmation for allergy removal |
| NETWORK | HTTPS only; certificate validation default; no cleartext exceptions |
| PLATFORM | Minimal permissions (notifications only in MVP); deep links validated; no exported Android components beyond what Expo needs |
| CODE | Dependency audit in CI; secrets scan; no service keys in the bundle; Edge Functions validate every input |
| RESILIENCE | Not a priority for a non-financial app; basic tamper checks only |
| PRIVACY | Data minimisation; consent-gated analytics; no ad SDKs; pseudonymous IDs to processors |

Server side: RLS on every table with CI tests; security-definer functions for restricted tables; admin access with MFA and audit events; separate projects per environment; least-privilege service roles; secrets in the platform secret store.

## 7. Threat model (summary)

| Threat | Example | Control |
|---|---|---|
| Spoofing | Stolen session token | Short token lifetime; refresh rotation; re-auth for sensitive actions |
| Tampering | Client sends a fake plan or target | Server recomputes with the engines; client values never trusted |
| Repudiation | "I never consented" | Versioned consent records |
| Information disclosure | Cross-user reads; logs with health data | RLS tests; log scrubbing; restricted tables |
| Denial of service | Coach spam drives cost | Rate limits; daily token caps |
| Elevation of privilege | Prompt injection asks the coach to change another user's data | No tools with data access; context scoped server-side |

## 8. Breach and incident response

1. **Detect:** alerts (file 11 §6), user reports, vendor notices.
2. **Triage within 4 hours:** is personal data involved? which users? which data?
3. **Contain:** revoke keys, disable features by flag, rotate secrets.
4. **Assess and notify:** tell affected users without delay; inform the Data Protection Board without delay and send the detailed report within 72 hours (claim R-04); keep a written record.
5. **Fix and review:** root cause within 72 hours of containment; publish a plain summary to affected users.

## 9. Backups

See file 11 §7: daily backups kept 7 days on Pro; point-in-time recovery at launch; quarterly restore drill; deletion ledger re-applied after any restore.
