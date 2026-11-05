# Server setup (Supabase)

The app works without a server. These steps turn on backup, the AI coach wording and server-side export and deletion. You run them yourself: they need your Supabase account and a Google AI (Gemini API) key, or an Anthropic key if you choose that provider.

## 1. Project

1. Create a Supabase project in the Mumbai region (`ap-south-1`), per plan/11.
2. Install the Supabase CLI and link: `supabase link --project-ref YOUR-PROJECT-REF`.
3. Apply the schema: `supabase db push`. It runs every file in `migrations/` in order (0001 foundations, 0002 nutrition, coach and privacy, 0003 hardening, 0004 photo meals, 0005 weigh-in edits, 0006 safety screen). The AI safety screen needs 0006 and the `safety-screen` function; it stays off in the app until you turn it on (section 7). Apply new migrations before releasing an app version that needs them: for example a photo meal fails to back up until 0004 is in.

## 2. Sign-in by email code

Authentication > Providers > Email: enable it. Authentication > Email Templates > Magic Link: include `{{ .Token }}` so the email carries the 6-digit code the app asks for. Sign-up is open by design, so also turn on CAPTCHA (Authentication > Attack Protection) and keep the default auth rate limits: the coach's per-user limits (30 model calls an hour, 200,000 tokens a day) do not stop someone creating many accounts.

## 3. Secrets and functions

```
supabase secrets set AI_PROVIDER=gemini
supabase secrets set GEMINI_API_KEY=...
supabase functions deploy coach
supabase functions deploy safety-screen
supabase functions deploy meal-photo
supabase functions deploy privacy
```

**Which AI.** `AI_PROVIDER` picks the company the functions send messages to: `gemini` (Google Gemini) or `anthropic` (Claude, with `ANTHROPIC_API_KEY` instead of `GEMINI_API_KEY`). It must be set explicitly: unset or any other value makes the AI functions refuse every call, so a missing setting or a typo never sends messages to a provider the privacy notice does not name. Set the app's `EXPO_PUBLIC_AI_PROVIDER` to the same value (section 6), because the in-app notice names the provider.

**Two checks keep the provider and the notice in step.** Before every AI call the server checks that the user's latest AI consent was given under a notice naming the active provider (`notice_version` in `consent_records`; the Gemini versions are listed in `functions/_shared/provider.ts`), and refuses with 403 otherwise. Every AI reply also names its provider, and the phone ignores a reply from a provider its notice does not name (the screen then gives the fixed safe reply, the coach answers from rules).

**Use a paid Gemini project for real users. No real user's data may go through a free-tier key.** (The test runs in EVALS.md used a free-tier key, but every case there is made up.) Google's pricing page (read 2026-11-04) says free-tier prompts and answers are used to improve Google's products and paid-tier ones are not. The free tier is also far too small for real use: on 2026-11-04 our free-tier key was limited to 15 requests a minute per model and to 20 requests a day for `gemini-3.6-flash`, the default coach model. When a limit is hit, the coach answers from its rules and the safety screen gives the fixed safe reply, so it fails safe, but the AI is effectively off. Turn on billing for the Google Cloud project that owns the key before real messages go through it.

**Models.** Each user picks the coach model in Settings: Fast, Balanced or Most capable (the app sends the ids `claude-haiku-5-5`, `claude-sonnet-5-5`, `claude-opus-5-5` for these choices, whatever the provider). With Gemini the server maps them to:

| Choice | Gemini model | Anthropic model |
|---|---|---|
| Fast | `gemini-3.5-flash-lite` | `claude-haiku-5-5` |
| Balanced | `gemini-3.6-flash` | `claude-sonnet-5-5` |
| Most capable (default) | `gemini-3.6-flash` | `claude-opus-5-5` |
| Safety screen (fixed) | `gemini-3.5-flash-lite` | `claude-haiku-5-5` |

Balanced and Most capable share a model because, on 2026-11-04, the Pro models answered "no quota" for our key and `gemini-3.8-flash` was overloaded on every test call. The mapping is in `functions/_shared/gemini.ts`. `COACH_MODEL` is optional and only sets the default choice for users who have not picked. `model_runs` records the provider and the model that actually answered. `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided to functions automatically.

## 4. Check the AI before you rely on it

From the repo root, with your API key exported in your own terminal (`GEMINI_API_KEY`, or `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY`):

```
npm run ai:smoke -- --photo ~/Pictures/thali.jpg
```

It sends the same requests the functions send, to the same provider and models and runs the replies through the phone's checks: coach replies must use only the app's numbers, and photo foods are matched and counted by the app. Expect a few cents per run.

## 4a. Switching an existing project from Anthropic to Gemini

App first, server second. Users must see and agree to the notice naming Google before any message goes to Google; the server's notice check is the backstop if the order slips.

1. Smoke test with a key from a billing-enabled project: `npm run ai:smoke` with `GEMINI_API_KEY` in your terminal. Every "Safety screen" line must say PASS, and the screen latency gate below must pass.
2. Release an app build with `EXPO_PUBLIC_AI_PROVIDER=gemini`, so the notice names Google and users agree again. Until the server switches, users who agreed to the Google notice get no AI (the server, still on Anthropic, refuses their consent and the phone fails safe); users on the old build carry on with Anthropic.
3. `supabase secrets set GEMINI_API_KEY=...` and `supabase secrets set AI_PROVIDER=gemini`.
4. Redeploy the three AI functions: `supabase functions deploy coach`, `supabase functions deploy safety-screen`, `supabase functions deploy meal-photo`. From now on, consents given under the Anthropic notice are refused until the user agrees again.
5. To go back, release a build with `EXPO_PUBLIC_AI_PROVIDER=anthropic` first, then set `AI_PROVIDER=anthropic` and redeploy. `ANTHROPIC_API_KEY` can stay set; it is only read on the Anthropic path.

**Release gate for the safety screen on Gemini.** Do not turn on `EXPO_PUBLIC_SAFETY_SCREEN` with Gemini until a smoke test on a billing-enabled key shows the screen's p95 time (95 of 100 calls) under the server's model limit, `SCREEN_MODEL_TIMEOUT_MS` (4 s). On the free tier, 74 of 316 test calls took longer than 4 s (up to 10.4 s), and each would show the fixed safe reply instead of an answer. If it is still too slow on a paid key, the options are: raise `SCREEN_MODEL_TIMEOUT_MS` to about 6 s and the phone's `SCREEN_TIMEOUT_MS` to about 8 s (both copies of `screen-prompt.ts`), or keep the screen on Anthropic Haiku. The defaults are unchanged until that is measured.

## 5. Retention job

Enable the `pg_cron` extension, then run once in the SQL editor:

```sql
select cron.schedule('purge-expired', '15 3 * * *', 'select purge_expired()');
```

## 6. App

Copy `app/.env.example` to `app/.env` and fill in the project URL and anon (publishable) key. Set `EXPO_PUBLIC_AI_PROVIDER` to the same provider as the server's `AI_PROVIDER` (default `gemini`). Restart Expo.

When the provider changes, the notice changes version. Users who agreed to the old notice get no AI calls (the word list and the rules still run) until they turn AI on again in Settings.

## 7. Turn on the AI safety screen

The app always runs the safety word list. The AI safety screen (a second check before every rules answer or coach reply, for users who allowed AI) is behind a build flag and is off by default. It fails closed: once it is on, any problem reaching it means a fixed safe reply instead of an answer. So turn it on only in this order:

1. Apply migration 0006: `supabase db push`.
2. Deploy the function: `supabase functions deploy safety-screen`.
3. Run the live smoke test from the repo root with your own key in your own terminal: `npm run ai:smoke`. Every line under "Safety screen" must say PASS. A FAIL there means do not turn the flag on yet.
4. Set `EXPO_PUBLIC_SAFETY_SCREEN=1` in `app/.env` (and in the web build's environment), then rebuild and release the app.

To turn it off again, set the flag back to `0` and rebuild. There is no automatic fallback to the word list alone when the screen fails: with the flag on, a failure always gets the fixed safe reply.

## What runs where

| Piece | Where | Notes |
|---|---|---|
| Plan, safety screening, progression, nutrition maths, coach rules and validators | Phone (`@ff/engines`) | Works offline |
| Backup of profile, consents, safety answers and limits, workouts, sets, check-ins, reports | Postgres, RLS on every table | Phone is the source of truth; backup mirrors it |
| Coach chat history | Phone only, 90 days | Not sent to the backup |
| AI safety screen | `functions/safety-screen` calls Gemini 3.5 Flash-Lite (or Claude Haiku with `AI_PROVIDER=anthropic`) | Needs backup sign-in and AI consent. Gets only the message text of messages the phone's word list did not catch; returns one category; the message is not stored. Any error, and any Gemini content-filter block, means the phone shows the fixed safe reply |
| Coach wording | `functions/coach` calls Gemini (or Claude) | Needs backup sign-in and AI consent; server builds its own prompt; only after the safety screen answered "none" |
| Meal photos | `functions/meal-photo` calls Gemini (or Claude) with the photo | Returns only a bounded food list; the photo is never stored; the phone's engine counts calories |
| Limits | `functions/_shared/run.ts` | Coach and photos share 30 model calls an hour and 200,000 tokens a day per user. The safety screen has its own 60 calls an hour and 400 calls a day, so it never uses up the coach's |
| Export and deletion | `functions/privacy` | Deletion needs a sign-in in the last 15 minutes |
| Security log | `security_log`, hashed user ID, no content | Kept 1 year after deletion (DPDP R-05, counsel to confirm) |

## Phone builds (EAS)

The app builds with Expo's build service from the `app` folder. You sign in yourself; nobody else should hold these logins.

- **Try it now, both phones:** install Expo Go, keep the phone on the same Wi-Fi as the Mac, run `npx expo start` in `app`, and scan the QR code (Android: Expo Go's scanner; iPhone: the Camera app).
- **Android install file:** `npx eas-cli@latest login` (free Expo account), then `npx eas-cli@latest build -p android --profile preview` in `app`. The build page gives a link and QR code to install the APK.
- **iPhone (TestFlight):** needs an Apple Developer account. Run `npx eas-cli@latest build -p ios --profile production`, then `npx eas-cli@latest submit -p ios`; both ask for your Apple sign-in.
- **Installable website:** open https://form-and-flow.vercel.app and use Add to Home Screen. It works offline after the first visit.
