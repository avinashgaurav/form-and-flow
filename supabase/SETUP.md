# Server setup (Supabase)

The app works without a server. These steps turn on backup, the AI coach wording and server-side export and deletion. You run them yourself: they need your Supabase and Anthropic accounts.

## 1. Project

1. Create a Supabase project in the Mumbai region (`ap-south-1`), per plan/11.
2. Install the Supabase CLI and link: `supabase link --project-ref YOUR-PROJECT-REF`.
3. Apply the schema: `supabase db push`. It runs every file in `migrations/` in order (0001 foundations, 0002 nutrition, coach and privacy, 0003 hardening, 0004 photo meals, 0005 weigh-in edits, 0006 safety screen). The coach needs 0006 and the `safety-screen` function before an app version with the AI safety screen is released: without them every message from a user with AI consent gets the fixed safe reply. Apply new migrations before releasing an app version that needs them: for example a photo meal fails to back up until 0004 is in.

## 2. Sign-in by email code

Authentication > Providers > Email: enable it. Authentication > Email Templates > Magic Link: include `{{ .Token }}` so the email carries the 6-digit code the app asks for. Sign-up is open by design, so also turn on CAPTCHA (Authentication > Attack Protection) and keep the default auth rate limits: the coach's per-user limits (30 model calls an hour, 200,000 tokens a day) do not stop someone creating many accounts.

## 3. Secrets and functions

```
supabase secrets set ANTHROPIC_API_KEY=...
supabase functions deploy coach
supabase functions deploy safety-screen
supabase functions deploy meal-photo
supabase functions deploy privacy
```

Each user picks the coach model in Settings: Fast (`claude-haiku-5-5`), Balanced (`claude-sonnet-5-5`) or Most capable (`claude-opus-5-5`). `COACH_MODEL` is optional and only sets the default for users who have not picked; without it the default is `claude-opus-5-5`. The plan's cost model (plan/06) assumed `claude-sonnet-5-5`. The safety screen always uses `claude-haiku-5-5`; the user's choice does not change it. `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided to functions automatically.

## 4. Check the AI before you rely on it

From the repo root, with your API key exported in your own terminal:

```
npm run ai:smoke -- --photo ~/Pictures/thali.jpg
```

It sends the same requests the functions send and runs the replies through the phone's checks: coach replies must use only the app's numbers, and photo foods are matched and counted by the app. Expect a few cents per run.

## 5. Retention job

Enable the `pg_cron` extension, then run once in the SQL editor:

```sql
select cron.schedule('purge-expired', '15 3 * * *', 'select purge_expired()');
```

## 6. App

Copy `app/.env.example` to `app/.env` and fill in the project URL and anon (publishable) key. Restart Expo.

## What runs where

| Piece | Where | Notes |
|---|---|---|
| Plan, safety screening, progression, nutrition maths, coach rules and validators | Phone (`@ff/engines`) | Works offline |
| Backup of profile, consents, safety answers and limits, workouts, sets, check-ins, reports | Postgres, RLS on every table | Phone is the source of truth; backup mirrors it |
| Coach chat history | Phone only, 90 days | Not sent to the backup |
| AI safety screen | `functions/safety-screen` calls Claude Haiku | Needs backup sign-in and AI consent. Gets only the message text of messages the phone's word list did not catch; returns one category; the message is not stored. Any error means the phone shows the fixed safe reply |
| Coach wording | `functions/coach` calls Claude | Needs backup sign-in and AI consent; server builds its own prompt; only after the safety screen answered "none" |
| Meal photos | `functions/meal-photo` calls Claude vision | Returns only a bounded food list; the photo is never stored; the phone's engine counts calories |
| Limits | `functions/_shared/run.ts` | Coach and photos share 30 model calls an hour and 200,000 tokens a day per user. The safety screen has its own 60 calls an hour and 200,000 tokens a day, so it never uses up the coach's |
| Export and deletion | `functions/privacy` | Deletion needs a sign-in in the last 15 minutes |
| Security log | `security_log`, hashed user ID, no content | Kept 1 year after deletion (DPDP R-05, counsel to confirm) |

## Phone builds (EAS)

The app builds with Expo's build service from the `app` folder. You sign in yourself; nobody else should hold these logins.

- **Try it now, both phones:** install Expo Go, keep the phone on the same Wi-Fi as the Mac, run `npx expo start` in `app`, and scan the QR code (Android: Expo Go's scanner; iPhone: the Camera app).
- **Android install file:** `npx eas-cli@latest login` (free Expo account), then `npx eas-cli@latest build -p android --profile preview` in `app`. The build page gives a link and QR code to install the APK.
- **iPhone (TestFlight):** needs an Apple Developer account. Run `npx eas-cli@latest build -p ios --profile production`, then `npx eas-cli@latest submit -p ios`; both ask for your Apple sign-in.
- **Installable website:** open https://form-and-flow.vercel.app and use Add to Home Screen. It works offline after the first visit.
