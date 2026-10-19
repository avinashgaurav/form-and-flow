# 18 · MVP scope and acceptance criteria

The MVP is the **personal-pilot build**: everything you need to run your own training and eating through the app for 4+ weeks, built with the safeguards a public product needs. All items **[REC]**; criteria are testable and map to file 16.

## 1. Content scope for the MVP

| Content | Amount | Source |
|---|---|---|
| Exercises | 60 to 80, home and gym, with text cues and still images or illustrations | Written by you; cues and contraindication tags reviewed by an S&C professional before the pilot; media reviewed before beta |
| Session templates | 12 (2-, 3- and 4-day; home and gym; beginner and intermediate) | TR-01 |
| Foods and dishes | About 300: common Indian ingredients plus dishes computed from standard recipes | Ingredient nutrients from a licensable source (USDA FoodData Central is public domain, claim T-10); Indian dish recipes written and reviewed; IFCT or INDB only with permission (claims E-07, T-13) |
| Household serving units | katori (bowl), piece (roti, idli and similar), tbsp, tsp, cup, glass, g, ml | Assumed gram weights, reviewed |
| Evidence cards | About 50 | File 13 §7 |
| Habits | 10 | Curated |
| Safety templates | Red flag, crisis, pain, ED-aware, pregnancy and medication restrictions, out-of-scope | Before the pilot: reviewed by at least one qualified professional, with crisis and ED templates reviewed by a mental-health professional |

## 2. Features and acceptance criteria

| ID | Feature | Acceptance criteria (all must pass) |
|---|---|---|
| F-01 | Email OTP sign-in | Code arrives within 60 s in 95 per cent of tries; wrong code shows the same message whether or not the email exists; 6th attempt on a code is refused; session survives app restart; sign-out with unsynced data warns first |
| F-02 | Age gate and consent | Under-18 date of birth blocks with no profile created; required consent cannot be pre-ticked; no data reaches the AI provider before AI-processing consent (verified in `model_runs`); with AI consent declined, onboarding, plan, workouts, logging and safety all work; each optional consent can be withdrawn in settings and the change is recorded with a version and timestamp |
| F-03 | Onboarding | Completes in 11 steps; resumes at the last incomplete step after a kill; validation per file 08 rejects out-of-range inputs with a message; median completion under 6 minutes in 5 timed runs |
| F-04 | Readiness and restrictions | Each of R1 to R10 "yes" applies exactly the restriction set in file 08 §4 (unit-tested per question); "not sure" equals "yes"; restrictions visible to the user on S06b |
| F-05 | Plan generation | Plan returned within 15 s P95; never schedules equipment the user lacks (property test over 1,000 random profiles); every plan item has a reason and rule ID; failure falls back to a starter template |
| F-06 | Today and check-in | Shows exactly one primary next action; check-in takes 3 taps and under 15 s; "time today = 15 min" produces a shortened session; rest days show as rest |
| F-07 | Exercise library | Every live exercise has reviewed cues, at least one image or illustration, equipment tags and a pattern; search tolerates one-letter typos |
| F-08 | Workout player | Set saved locally under 200 ms P95 on the low-end test phone; survives call, background and force-quit (EC-10, EC-11); double tap stores one set; rest timer fires a local notification when allowed |
| F-09 | Swap and shorten | Swap shows only approved substitutes respecting equipment and pain flags; if none, offers skip; shortening keeps the main lift and never raises target intensity |
| F-10 | Progression and deload | Golden tests for TR-03, TR-04, TR-08 pass; load never increases after a "too hard" session; deload triggers on the defined signal in simulation |
| F-11 | Pain report and safety stop | All red-flag phrases in the eval list (English and Hinglish) reach S36 in 100 per cent of cases; pain 7 or above ends the session; flagged pattern excluded for 7 days |
| F-12 | Food search | 20 test dishes typed in English and Hinglish (for example "bhindi", "dhaniya", "chole") return the right item in the top 3 for at least 18 of 20; missing nutrients show as "not available" |
| F-13 | Text meal logging | Parser gets at least 90 per cent of items right on the 30-case pilot eval set before edits; nothing is saved without the user tapping Save; totals after edits match the engine to the gram; oil level changes totals |
| F-14 | Saved meals and recipes | Re-logging a saved meal takes 2 taps; editing a recipe leaves past logs unchanged (EC-33) |
| F-15 | Nutrition targets and modes | Energy shown as a range; protein per PR rules; non-numeric mode hides every calorie number app-wide (UI snapshot test across all screens); restriction `no_deficit` yields maintenance only |
| F-16 | Coach | Zero unsourced numbers in the 30-case provenance suite; all actions pass the whitelist and engine re-check; provider timeout degrades within 30 s; thumbs and report on every message |
| F-17 | What my coach knows | Every memory item used in prompts is listed; deleting an item removes it from the next prompt (verified in `model_runs` context hash) |
| F-18 | Weekly review | Proposes at most 2 changes, each with reason and rule ID; with insufficient data proposes none and says so; decisions recorded in `plan_changes` |
| F-19 | Progress | Weight trend hidden when not tracked; gaps of 7+ days break the line; strength chart uses only logged sets; no future projections |
| F-20 | Notifications | Off by default until opted in; none inside quiet hours (unit-tested across timezones); no reminder for a completed action |
| F-21 | Export and deletion | Export contains every user-owned table in JSON and CSV, delivered within 24 h; deletion removes rows from all user tables, storage, analytics person and push tokens, and writes the deletion ledger (verified by a script that checks each store) |
| F-22 | Report a problem | Report submitted offline is queued and delivered; includes app version and trace ID; no health data attached without explicit choice |
| F-23 | Sync and conflicts | EC-01 to EC-07 pass; failed items visible with retry; conflicts shown on S44, never silently dropped |
| F-24 | ED-aware mode | All ED eval cases route to the reviewed template; turning the mode on removes calorie numbers, weigh-in prompts and deficit language |

## 3. Not in the MVP

| Item | When | Why not now |
|---|---|---|
| Google and Apple sign-in | Beta | Email is enough for one user |
| Exercise video | Beta | Needs the shoot or licence (file 09) |
| Fasting observance calendar | Beta | Test H-09 first |
| Barcode scan | Beta | Needs a packaged-food data source |
| Grocery list | Beta | After meal planning exists |
| Health Connect and HealthKit | Beta | Store declarations and permissions work |
| Admin web app | Beta | Supabase Studio is enough for one user |
| Photo meal logging | Later | Accuracy and uncertainty work needed (claim E-13) |
| Subscriptions | Launch | No paying users yet |
| Regional-language UI | Later | English first; aliases cover food names |
| Wearable-driven adjustment, human coaches, social | Later | Out of scope for proving the loop |
| Kokum features | Not in this app | Separate product (file 24) |

## 4. Definition of done for the MVP

1. Every F-xx criterion above passes and is linked to a test.
2. Pilot release gate in file 16 §4 passes.
3. You have used it for 7 consecutive days on your own phone before calling the pilot "started".
