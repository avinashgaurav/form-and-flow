# 04 · User research hypotheses

Every row here is **[HYP]** until tested. Each one names the test, the pass line, and the decision it changes. If a hypothesis fails, the decision column says what moves.

## 1. Hypotheses

| ID | Hypothesis | Why we think so | Test | Pass line | Decision it informs |
|---|---|---|---|---|---|
| H-01 | Adults who quit fitness apps cite "food logging takes too long or my food is missing" as a top-2 reason | Indian home food is mixed dishes with variable oil; global databases are thin on them | 15 discovery interviews | 8 of 15 name food logging friction or missing foods unprompted | Investment in Indian food catalogue and text logging |
| H-02 | Users will log meals by typing a sentence ("2 roti, dal, bhindi") faster than by search-and-pick | One parse beats 3 searches | Timed prototype task, 8 participants | Median under 30 seconds per meal; 7 of 8 prefer it | Text parser is P0, not P1 |
| H-03 | A visible uncertainty band ("about 450 to 600 kcal") increases trust rather than reducing it | Users distrust false precision once they notice it | A/B prototype, 8 participants (one usability round, both variants) | 6 of 8 rate the banded version as more trustworthy | Whether to show ranges by default |
| H-04 | Beginners want one clear next action, not a dashboard | Choice overload on Today screens | 5-user usability test, two Today variants | 4 of 5 complete "start today's session" faster on the single-action variant | Today screen layout |
| H-05 | "I only have X minutes" is used weekly by time-poor users | Plans break on busy days | Concierge pilot (founder coaches 5 people over WhatsApp for 2 weeks using the plan rules) | 3 of 5 ask for a shortened session at least once a week | Time-flex feature priority |
| H-06 | Users accept an engine-proposed weekly change more often when the reason and source are shown | Explanation builds trust | Concierge pilot plus weekly review prototype | Acceptance at least 60 per cent with reasons shown | Weekly review design |
| H-07 | A meaningful share of target users do not want calorie numbers at all | Diet-culture fatigue; ED risk | Interviews plus onboarding prototype choice | At least 25 per cent choose non-numeric mode | Non-numeric mode is P0 |
| H-08 | Vegetarian gym users struggle to reach protein targets within budget | Protein sources are costlier per gram for vegetarians | Interviews with 6 vegetarian lifters; 3-day food diary | 4 of 6 report it as a top-3 problem | Protein gap suggestions and budget filter |
| H-09 | Fasting observances (Navratri, Ekadashi) matter enough to be hard constraints | Kokum decision D-012 made the same call for cooking | Interviews with 6 users who observe fasts | 4 of 6 say a plan that ignores fasting days would make them stop using it | Observance calendar in MVP or P1 |
| H-10 | Users will pay for adaptive coaching but not for logging alone | Logging is commoditised and often free | Van Westendorp price survey (50 to 100 respondents) plus fake-door paywall in beta | Acceptable price range overlaps a viable unit cost (file 21) | Pricing and free-tier line |
| H-11 | A daily 3-tap check-in will be completed on most days if it takes under 15 seconds | Low cost, visible effect on today's plan | Founder pilot, then beta | Completed on at least 60 per cent of active days | Check-in frequency and design |
| H-12 | Users trust a coach more when they can see and edit "what my coach knows about me" | Hidden memory feels invasive | Prototype test, 8 participants | 6 of 8 rate it as increasing trust; none find it creepy | Memory viewer is P0 |
| H-13 | Pantry-aware meal suggestions (Kokum) increase meal-plan acceptance for household cooks | Plans fail when ingredients are missing | Moved to Kokum's own research (separate product, file 24) | Plan acceptance up at least 20 points versus non-pantry suggestions | Kokum extension timing (file 24) |
| H-14 | Hinglish and regional food names in search matter even with an English UI | "dhaniya", "bhindi", "chole" are how people type | Search log analysis in pilot and beta | At least 20 per cent of food searches use non-English names | Alias table depth |

## 2. Research plan

| Method | Who | Size | When | Output |
|---|---|---|---|---|
| Discovery interviews | Mix of U1 to U4, at least 6 vegetarian lifters, at least 6 who observe fasts, at least 4 who quit a fitness app (one person can count in several groups) | 12 to 20 adults | Before design sign-off | Coded interview notes; H-01, H-07, H-08, H-09 verdicts |
| Competitor teardown | Founder | 6 apps installed and used for 3 days each | Same window | Onboarding screenshots, paywall map, India food search test (20 common dishes) |
| Prototype usability | U1 and U3 heavy | 5 to 8 per round, 2 rounds | Design phase | Task success, time, errors; H-02, H-03, H-04, H-12 |
| Concierge coaching | Friends or colleagues who consent | 5 people, 2 weeks | Design phase | Real adjustments made by hand using the rules; H-05, H-06 |
| Price survey | Online panel or community | 50 to 100 | Before beta | Van Westendorp ranges; H-10 |
| Founder pilot | You | 1, 4 weeks minimum | After MVP build | Daily diary, defects, H-11 |

**Important limit:** 12 to 20 interviews is a discovery sample. It finds problems and language; it does not size a market or prove a percentage.

## 3. Interview guide (abridged)

1. Walk me through the last time you tried to get fitter. What happened?
2. What did you use? What made you stop?
3. Show me how you would log what you ate yesterday. (Observe, do not help.)
4. When a day goes badly, what do you do next?
5. Who decides what gets cooked at home? How does your goal fit into that?
6. Have you ever been told to do something by an app that felt wrong for you? What?
7. What would you pay for, and what should obviously be free?

Do not ask about medical history in discovery interviews. Do not collect health data from interviewees beyond what they volunteer, and do not record it against their name.
