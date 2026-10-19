# 02 · Research methodology, sources and claim register

## 1. Method

| Step | What was done | Date |
|---|---|---|
| 1 | Read in full: your original brief, the Phase 1 draft, the Phase 2 draft, and the Kokum repository (README, DECISIONS, AGENTS, AI-ENGINE, DATA-MODEL, INVENTORY, INTEGRATIONS, engine and data files) | 19 Oct 2026 |
| 2 | Listed every factual and numeric claim the plan needed | 19 Oct 2026 |
| 3 | Five parallel fact-checking passes against live primary sources: competitors and India prices; exercise and nutrition evidence; Indian law and app-store policy; technology and data sources; small residual claims | 19 Oct 2026 |
| 4 | Corrected the plan where a claim came back WRONG or PARTLY; marked UNVERIFIED claims as such and kept them out of rules | 19 Oct 2026 |
| 5 | Contradiction pass across all files | 19 Oct 2026 |

**Source hierarchy:** official government and regulator sites; peer-reviewed papers (PubMed or PMC full text); official vendor documentation and pricing pages; App Store India listings for India prices. No blogs or influencer content were used as sources; one news source is noted where no primary source was found (E-14).

**Status meanings:** **VERIFIED** confirmed on the named live page · **PARTLY** confirmed with a correction (the corrected version is what the plan uses) · **UNVERIFIED** could not be confirmed; not used as a basis for any rule · **WRONG** the original claim was false; the plan now says the opposite.

**Limits:** desk research only. No hands-on competitor audit, no user interviews, no legal opinion. Prices and versions change; re-check before acting. All web sources were accessed on 19 October 2026.

## 2. Claim register

### M · Market and competitors

| ID | Claim (as used in the plan) | Status | Source |
|---|---|---|---|
| M-01 | Nike Training Club offers trainer-led classes and multi-week programmes, free with a Nike membership; NTC TV is US-only | VERIFIED | apps.apple.com/in/app/nike-training-club-wellness/id301521403 ; nike.com/ntc-app |
| M-02 | Apple Fitness+ is available in India at ₹149/month or ₹999/year, launched December 2025, needs an iPhone | VERIFIED | apple.com/in/apple-fitness-plus/ |
| M-03 | MyFitnessPal Premium ₹619/month, ₹3,099/year in India; barcode scan and meal scan are Premium-only (barcode paywalled since October 2022) | VERIFIED | myfitnesspal.com/premium ; apps.apple.com/in/app/myfitnesspal-calorie-counter/id341232718 |
| M-04 | MacroFactor estimates expenditure from logged intake and weight trend with weekly check-ins; separate Workouts app launched January 2026 without shared coaching; AI photo and text logging; ₹6,300/year (nutrition), ₹9,900/year (both) | VERIFIED (Workouts India price UNVERIFIED) | macrofactor.com/macrofactors-algorithms-and-core-philosophy/ ; macrofactor.com/workouts/ ; macrofactor.com/ai-food-logging/ |
| M-05 | Strong Pro ₹389/month, ₹1,799 to ₹2,449/year; no auto-progression documented | VERIFIED | apps.apple.com/in/app/strong-workout-tracker-gym-log/id464254577 |
| M-06 | Fitbod generates workouts from goal, level, equipment, training history and logged sets; about ₹1,999/year | VERIFIED | fitbod.me/blog/fitbod-algorithm/ ; apps.apple.com/in/app/fitbod-gym-fitness-planner/id1041517543 |
| M-07 | Freeletics adapts to goals, schedule, location and equipment; separate Nutrition app; ₹689 to ₹2,799 by term | VERIFIED | freeletics.com/en/ ; apps.apple.com/in/app/freeletics-workouts-fitness/id654810212 |
| M-08 | Noom is on App Store India at ₹2,999 to ₹18,500 (tiers unlabelled) | VERIFIED | apps.apple.com/in/app/noom-weight-loss-health/id634598719 |
| M-09 | Healthify has AI coach Ria and human coach tiers; Healthify+ ₹2,500/year; Indian food database size stated as 10,000+ and 20,000+ in different places | PARTLY (coach-tier prices UNVERIFIED) | store.healthifyme.com/products/healthifyplus-plan ; apps.apple.com/in/app/healthify-ai-calorie-tracker/id943712366 |
| M-10 | cult.fit Transform Plus uses 3 human coaches and meal plans; cultpass LIVE ₹449/month, ₹1,999/year | VERIFIED (Transform price not found) | support.cult.fit/support/solutions/articles/25000028506 ; apps.apple.com/in/app/cult-fit-gym-workout-fitness/id1217794588 |
| M-11 | FITTR has 700+ human coaches; programmes ₹7,599 | VERIFIED | fittr.com ; apps.apple.com/in/app/fittr-health-fitness-app/id1332568703 |
| M-12 | Hevy Pro ₹249 to ₹349/month, ₹1,999/year | PARTLY (free-tier limits UNVERIFIED) | apps.apple.com/in/app/hevy-workout-tracker-gym-log/id1458862350 |
| M-15 | Further file 03 details from the same sources: Fitness+ has 12 workout types; MacroFactor ₹899 to ₹1,049/month and 900+ exercises in Workouts; Fitbod ₹360 to ₹399/month and 1,000+ exercises; Freeletics 700+ exercises, 30 plans, ₹1,049 to ₹3,649 with nutrition; cult.fit 1,200+ at-home workouts; MyFitnessPal lists an "AI Coach" for Premium in release notes | VERIFIED | Sources as M-02, M-04, M-06, M-07, M-10, M-03 |
| M-13 | Earlier draft: "no single competitor combines adaptive training, nutrition and coaching for Indian users" | **WRONG** | Healthify, cult.fit Transform and FITTR all combine them (sources M-09 to M-11) |
| M-14 | No product checked documents automatic adjustment of both training load and calorie targets from logged data | UNVERIFIED (plausible) | Absence of evidence on pages checked; to confirm in the hands-on teardown |

### E · Exercise and nutrition evidence

| ID | Claim (as used in the plan) | Status | Citation and source |
|---|---|---|---|
| E-01 | Adults: 150 to 300 min/week moderate or 75 to 150 min/week vigorous aerobic activity, plus muscle-strengthening on 2+ days | VERIFIED | Bull FC et al. WHO 2020 guidelines. Br J Sports Med 2020;54:1451. pmc.ncbi.nlm.nih.gov/articles/PMC7719906/ |
| E-02 | 1.4 to 2.0 g/kg/day protein is sufficient for most exercising people | VERIFIED | Jäger R et al. ISSN position stand. JISSN 2017;14:20. pmc.ncbi.nlm.nih.gov/articles/PMC5477153/ |
| E-03 | 2.3 to 3.1 g/kg of fat-free mass may help lean, resistance-trained people keep lean mass in a deficit (based on 6 studies) | VERIFIED | Helms ER et al. IJSNEM 2014;24:127. pubmed.ncbi.nlm.nih.gov/24092765/ |
| E-04 | Public-health safe weight-loss rate is 0.5 to 1 kg (1 to 2 lb) per week; the "per cent of body weight" framing comes from athlete research | PARTLY (corrected) | NHLBI Clinical Guidelines 1998, nhlbi.nih.gov/files/docs/guidelines/ob_gdlns.pdf ; NHS, nhs.uk/conditions/overweight-and-obesity/ |
| E-05 | ICMR-NIN Dietary Guidelines for Indians 2024 has 17 guidelines and forbids electronic reproduction for creating a product without NIN's written permission | VERIFIED | nin.res.in/dietaryguidelines/pdfjs/locale/DGI_2024.pdf |
| E-06 | ICMR-NIN 2020: protein EAR 0.66 and RDA 0.83 g/kg/day for healthy adults; DGI 2024 says intakes above about 1.6 g/kg add no further muscle gain | PARTLY (1.0 g/kg is the superseded 2010 figure) | nin.res.in/rdabook/brief_note.pdf ; DGI 2024 Guideline 8 |
| E-07 | IFCT 2017 covers 528 foods and 151 components; electronic reproduction for a product needs NIN's written permission | VERIFIED | Longvah T et al. IFCT 2017. nin.res.in/ebooks/IFCT2017_16122024.pdf |
| E-08 | Indian BMI cut-offs: 2009 consensus 23 (overweight) and 25 (obesity); WHO 2004 kept 25/30 with action points at 23 and 27.5; the 2025 Indian revision calls BMI above 23 obesity, with staging | PARTLY | Misra A et al. JAPI 2009;57:163; WHO Lancet 2004;363:157; Misra A et al. Diabetes Metab Syndr 2025;19:102989 |
| E-09 | PAR-Q+ 2025 must not be altered or built into electronic forms without the PAR-Q+ Collaboration's written consent | VERIFIED | eparmedx.com/?page_id=79 |
| E-10 | ACSM 2015 pre-participation screening uses current activity, known disease or symptoms, and desired intensity; risk-factor counting removed | PARTLY (third factor added) | Riebe D et al. MSSE 2015;47:2473. pubmed.ncbi.nlm.nih.gov/26473759/ |
| E-11 | The 2026 ACSM resistance-training position stand replaces the 2009 stand: 2+ sessions a week; strength from about 80 per cent of max for 2 to 3 sets; hypertrophy from at least 10 weekly sets; no consistent effect of periodisation model, training to failure or equipment type | VERIFIED (the original "2009 is current" claim was WRONG) | Currier BS et al. MSSE 2026;58(4):851. pubmed.ncbi.nlm.nih.gov/41843416/ |
| E-12 | SCOFF is a 5-item screen (pooled sensitivity 0.86, specificity 0.83), not a diagnosis; evidence linking calorie tracking to eating-disorder symptoms is cross-sectional and mixed (an RCT and a 2024 meta-analysis found no significant effect); risk sits mainly with vulnerable groups | PARTLY (one draft citation was wrong) | Morgan JF et al. BMJ 1999; Kutz AM et al. JGIM 2020; Simpson & Mazzeo, Eat Behav 2017; Levinson et al., Eat Behav 2017; Jospe et al., Obes Sci Pract 2018; Roth et al., Appetite 2024 |
| E-13 | Photo-based AI energy estimates show about 36 per cent mean absolute error for leading models and underestimate larger portions; no study of Indian mixed dishes found | VERIFIED | O'Hara C et al. Nutrients 2025;17:607; Fridolfsson J et al. Curr Dev Nutr 2025;9:107556 |
| E-14 | A fibre target for Indian adults | **UNVERIFIED** (only a 2020 news report found) | To obtain from NIN directly (Q-12) |
| E-15 | FSSAI Nutraceutical Regulations 2022 (replacing 2016) bar claims to treat, cure, mitigate or prevent disease without approval | PARTLY (final gazette status unverified) | fssai.gov.in/upload/uploadfiles/files/Direction_New_compressed.pdf |
| E-16 | Mifflin-St Jeor (1990): men 10W + 6.25H - 5A + 5; women 10W + 6.25H - 5A - 161 (kg, cm, years); derived from 498 US adults; the Academy of Nutrition and Dietetics rates it the most accurate predictive equation when resting energy cannot be measured, but notes it was not tested in non-Caucasian groups; a small Indian study (30 male weightlifters) found predictive equations underestimated resting energy | VERIFIED (Academy scope PARTLY: its recommendation targets overweight and obese adults) | Mifflin MD et al. Am J Clin Nutr 1990;51:241 (PMID 2305711); andeal.org/template.cfm?template=guide_summary&key=621 ; Joseph M et al. Indian J Endocrinol Metab 2017;21:515 |

### T · Technology and data sources

| ID | Claim | Status | Source |
|---|---|---|---|
| T-01 | Expo SDK 58 (React Native 0.88); New Architecture mandatory from SDK 55; Expo Router deep links every screen, typed routes opt-in beta; expo-sqlite with SQLCipher (not in Expo Go); SecureStore uses Keychain and Keystore; EAS free tier 15 Android + 15 iOS builds a month and 1,000 update MAU; Starter $19/month | VERIFIED | docs.expo.dev/versions/latest/ ; docs.expo.dev/router/ ; docs.expo.dev/versions/latest/sdk/sqlite/ ; expo.dev/pricing |
| T-02 | Flutter stable 3.47 | VERIFIED (neutral trade-off source UNVERIFIED) | docs.flutter.dev/release/release-notes |
| T-03 | Supabase offers South Asia (Mumbai) `ap-south-1` | VERIFIED | supabase.com/docs/guides/platform/regions |
| T-04 | Supabase Pro from $25/month; daily backups kept 7 days; point-in-time recovery about $100/month for 7 days, needs Small compute | VERIFIED | supabase.com/pricing ; supabase.com/docs/guides/platform/backups |
| T-05 | Supabase: enable RLS on every table in an exposed schema; SOC 2 Type 2 (report on Team+); HIPAA add-on Team+; Edge Functions 2 s CPU per request, 400 s wall clock on paid plans | VERIFIED | supabase.com/docs/guides/database/postgres/row-level-security ; supabase.com/docs/guides/security/soc-2-compliance ; supabase.com/docs/guides/functions/limits |
| T-06 | Claude API prices per million tokens: Sonnet 5.5 $2 in / $10 out; Haiku 5.5 $0.10 / $0.50 (prompts up to 100k tokens); Opus 5.5 $4 / $20; batch 50 per cent off | VERIFIED | platform.claude.com/docs/en/about-claude/pricing |
| T-07 | Anthropic does not train on API customer content; retention up to 30 days by default (two official pages differ); zero-retention by agreement; structured outputs generally available | VERIFIED (sources conflict on default retention) | anthropic.com/legal/commercial-terms ; privacy.claude.com ; platform.claude.com/docs/en/manage-claude/api-and-data-retention |
| T-08 | On AWS Bedrock in Mumbai, the 5.5 Claude models run only via global cross-region inference and lack structured outputs there; an India geo profile covers older models | VERIFIED | docs.aws.amazon.com/bedrock (model cards); aws.amazon.com/blogs/machine-learning (29 Sep 2026) |
| T-09 | OpenAI keeps API abuse logs up to 30 days, no training by default; Gemini paid tier not used for training, logged 55 days; unpaid tier used to improve products | VERIFIED | developers.openai.com/api/docs/guides/your-data ; ai.google.dev/gemini-api/terms |
| T-10 | USDA FoodData Central is public domain (CC0) | VERIFIED | fdc.nal.usda.gov |
| T-11 | Open Food Facts: database ODbL, contents DbCL, images CC BY-SA | VERIFIED (India coverage UNVERIFIED) | world.openfoodfacts.org/terms-of-use |
| T-12 | IFCT 2017 licensing | See E-07 | |
| T-13 | Indian Nutrient Databank (INDB, 2024) by Anuvaad Solutions and University of Edinburgh: 1,095 raw foods and 1,014 recipes; article CC BY; dataset has no stated licence | PARTLY | pmc.ncbi.nlm.nih.gov/articles/PMC11277795 ; github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB- |
| T-14 | FatSecret Premier includes an India dataset, price on request; Edamam from $29/month; Passio from $99/month; Nutritionix pricing not confirmed | PARTLY | platform.fatsecret.com/api-editions ; developer.edamam.com ; passio.ai/pricing |
| T-15 | wger exercise data licensed per entry under Creative Commons; image licence not stated | PARTLY | github.com/wger-project/wger |
| T-16 | WorkoutLabs illustration licensing from $25 per illustration perpetual, or full library from $1,200/year; ExerciseDB licence terms unclear | PARTLY | workoutlabs.com/exercise-illustrations-licensing/ ; exercisedb.dev |
| T-17 | Expo Push is free (600 notifications/second per project); FCM is no-cost | VERIFIED | docs.expo.dev/push-notifications/faq/ ; firebase.google.com/pricing |
| T-18 | RevenueCat free up to $2,500 monthly tracked revenue, then 1 per cent | VERIFIED | revenuecat.com/pricing |
| T-19 | Razorpay standard fee 2 per cent per domestic transaction, plus GST on the fee | VERIFIED | razorpay.com/pricing |
| T-20 | PostHog free tier 1M events a month; cloud in US or EU; self-hosting officially unsupported | VERIFIED | posthog.com/pricing ; posthog.com/docs/privacy/data-storage |
| T-21 | Sentry free Developer plan; Team $26/month billed annually | VERIFIED | sentry.io/pricing |
| T-22 | Google Fit APIs are being deprecated in 2026 (sign-ups closed May 2024); Health Connect recommended; Apple 5.1.1(i) requires a privacy policy; 5.1.3 bars advertising use of health data and storing personal health information in iCloud | VERIFIED | developers.google.com/fit ; developer.apple.com/app-store/review/guidelines/ |
| T-23 | Model cost about $0.45 per user per month at 40 coach turns (3,000 in / 500 out tokens) and 30 parse calls (1,500 / 200) | Computed from T-06; arithmetic re-checked | File 11 §8 |
| T-24 | Apple Developer Program $99 a year (India rupee price shown only at enrolment); Google Play registration $25 one-time | VERIFIED (INR price UNVERIFIED) | developer.apple.com/programs/ ; support.google.com/googleplay/android-developer/answer/6112435 |
| T-25 | US dollar is about ₹95 (RBI/FBIL reference rate 95.0194 on 16 October 2026; ECB cross-check 94.96) | VERIFIED | rbi.org.in ; ecb.europa.eu reference rates |

### K · Kokum repository

| ID | Claim | Status | Source |
|---|---|---|---|
| K-01 | Kokum is an Expo, TypeScript and Supabase pantry-aware cooking app; dish state is computed in code, never by the model; 48 engine tests pass; 14 verified recipes and 37 ingredients; not tested on a physical device; Supabase migration never applied live; uses AsyncStorage, not SQLite; observances are hard constraints; ingredient nutrient values carry no source | VERIFIED (read from the repository; test status as stated in its README, not re-run) | ~/Desktop/Personal/Kokum: README.md (tagline, depletion model, known gaps), DECISIONS.md (D-001 to D-012), AGENTS.md, INVENTORY.md, DATA-MODEL.md, AI-ENGINE.md, INTEGRATIONS.md (deep-link vendors, bill-back), app/src/engine/insights.ts, app/src/data/ingredients.ts |

### R · Regulatory, legal, store policy and platform guidance

| ID | Claim | Status | Source |
|---|---|---|---|
| R-01 | DPDP Act penalty caps differ by breach type: up to ₹250 crore for failing to take security safeguards; ₹200 crore for breach-notice failures and children's obligations; ₹150 crore for Significant Data Fiduciary duties; ₹50 crore otherwise. Not "per instance" | PARTLY (corrected) | DPDP Act 2023 s.33 and Schedule; egazette.gov.in/WriteReadData/2023/248045.pdf |
| R-02 | Under-18s are children under DPDP; verifiable parental consent; ban on tracking, behavioural monitoring and targeted ads aimed at children | VERIFIED | DPDP Act s.2(f), s.9; DPDP Rules r.10 |
| R-03 | DPDP Rules notified 13 November 2025 (G.S.R. 846(E); e-gazette ID dated 14 November). Rules 1, 2, 17 to 21 immediate; Rule 4 from 13 November 2026; Rules 3, 5 to 16, 22, 23 and most Act sections (including penalties and s.44(2)) from 13 May 2027 | VERIFIED | egazette.gov.in/WriteReadData/2025/267650.pdf ; egazette.gov.in/WriteReadData/2025/267647.pdf (G.S.R. 843(E)) |
| R-04 | Breach: inform users without delay; inform the Board without delay, detailed report within 72 hours | VERIFIED | DPDP Rules r.7 |
| R-05 | Logs and processing data kept at least one year for security purposes, including after account deletion; 3-year inactivity erasure applies only to large e-commerce, gaming and social platforms | VERIFIED (inactivity rule scope PARTLY) | DPDP Rules r.6(1)(e), r.8, Third Schedule |
| R-06 | DPDP has no sensitive category; SPDI Rules 2011 classify health conditions and medical history as sensitive and apply until IT Act s.43A is removed on 13 May 2027 | VERIFIED | DPDP Act text; SPDI Rules r.3 (wipo.int/wipolex/en/text/494931); G.S.R. 843(E) |
| R-07 | Correct title: CCPA "Guidelines for Prevention of Misleading Advertisements and Endorsements for Misleading Advertisements, 2022" (9 June 2022); substantiation, research citation and endorsement rules | PARTLY (title corrected) | egazette.gov.in/WriteReadData/2022/236451.pdf |
| R-08 | ASCI: care with ads aimed at people with obesity; health influencers must state qualifications (2025 addendum); no AI-fabricated testimonials or AI before-and-after weight-loss images; synthetic influencers labelled | VERIFIED | ascionline.in ASCI Codes and Guidelines Book (October 2026) |
| R-09 | Obesity is S.No. 38 in the Drugs and Magic Remedies Act Schedule; ads for any "drug" (article other than food) claiming to treat or prevent it are banned | VERIFIED | DMR Act 1954 s.2(b), s.3(d), Schedule (thc.nic.in copy) |
| R-10 | CDSCO software guidance (CDSCO/MD/GD/MDSW/01/2026) excludes software merely intended for general wellness; disease references remove the exclusion | VERIFIED | cdsco.gov.in Guidance on Medical Device Software under MDR 2017 |
| R-11 | Telemedicine Practice Guidelines 2020 cover registered medical practitioners only | PARTLY (main PDF blocked; Board FAQ used) | aiims.edu/images/pdf/notice/FAQ_Telemedicine.pdf |
| R-12 | Google Play Health apps declaration mandatory for every app with a published track since 31 August 2024; non-medical apps must say they are not a medical device; consult-a-professional reminders; privacy policy in-app and on listing | VERIFIED | support.google.com/googleplay/android-developer/answer/14738291 ; answer/16679511 |
| R-13 | Health Connect: approved use cases, per-permission justification, no ads or sale, encryption required | VERIFIED | support.google.com/googleplay/android-developer/answer/12991134 |
| R-14 | Google Play fee 15 per cent on auto-renewing subscriptions in India; user-choice billing reduces it by 4 points | VERIFIED | support.google.com/googleplay/android-developer/answer/112622 ; answer/13306652 |
| R-15 | Apple 1.4.1 (health accuracy scrutiny, methodology disclosure, consult-a-doctor reminders); 5.1.2(i) explicit permission before sharing personal data with third parties including third-party AI; 5.1.3 health data never for ads or data mining, no personal health information in iCloud (guidelines updated 16 October 2026) | VERIFIED | developer.apple.com/app-store/review/guidelines/ |
| R-16 | Apple subscriptions: 30 per cent commission in year one, 15 per cent after; Small Business Program 15 per cent | VERIFIED | developer.apple.com/app-store/subscriptions/ |
| R-17 | Apple 5.1.1(v): apps with account creation must offer in-app account deletion | VERIFIED | developer.apple.com/app-store/review/guidelines/ |
| R-18 | GST 18 per cent on online information services (9984); physical well-being services (99972) at 5 per cent from 22 September 2025; app classification unclear | PARTLY | CBIC Notification 11/2017-CT(R); gstcouncil.gov.in (56th meeting release) |
| R-19 | RPwD rules (G.S.R. 359(E), 2023) point apps to IS 17802; Supreme Court found the rule not truly mandatory (2024, secondary sources); draft 2026 amendment pending | PARTLY | egazette.gov.in/WriteReadData/2023/245819.pdf |
| R-20 | ICMR "Ethical Guidelines for Application of Artificial Intelligence in Biomedical Research and Healthcare", 2023 | VERIFIED | icmr.gov.in (Ethical_Guidelines_AI_Healthcare_2023.pdf) |
| R-21 | Personal Google Play developer accounts created after 13 November 2023 must run a closed test with at least 12 opted-in testers for 14 continuous days before applying for production access | VERIFIED (page silent on organisation accounts) | support.google.com/googleplay/android-developer/answer/14151465 |
| R-22 | 112 is India's single emergency number (live in 36 states and UTs); 108 is the medical-emergency ambulance line; Tele-MANAS is 14416 or 1-800-891-4416, free, 24x7, about 20 languages; no national eating-disorder helpline found | VERIFIED (ED helpline: none found in one directory) | static.pib.gov.in (ERSS backgrounder, Nov 2025); pib.gov.in PRID 2269699, 2118790; findahelpline.com/countries/in/topics/eating-body-image |
| R-23 | Touch targets: Apple HIG 44 x 44 pt default (28 pt stated as an absolute minimum); Android at least 48 x 48 dp with 8 dp spacing | PARTLY (Apple) / VERIFIED (Android) | developer.apple.com/design/human-interface-guidelines/buttons ; support.google.com/accessibility/android/answer/7101858 |
| R-24 | WCAG 2.2 AA: text contrast 4.5:1 (large text 3:1); non-text contrast 3:1 | VERIFIED | w3.org/TR/WCAG22/ |
| R-25 | DPDP Act s.16 permits cross-border transfers except to countries the government restricts by notification; s.16 commences 18 months after 13 November 2025 (about 13 May 2027); no restriction list found | PARTLY (no-list status UNVERIFIED) | meity.gov.in (DPDP Act text); egazette.gov.in G.S.R. 843(E) |
| R-26 | TestFlight allows up to 10,000 external testers; the first build needs TestFlight App Review | VERIFIED | developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers |

