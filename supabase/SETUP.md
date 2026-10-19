# Server setup (Supabase)

The app works without a server. These steps turn on backup, the AI coach wording and server-side export and deletion. You run them yourself: they need your Supabase and Anthropic accounts.

## 1. Project

1. Create a Supabase project in the Mumbai region (`ap-south-1`), per plan/11.
2. Install the Supabase CLI and link: `supabase link --project-ref YOUR-PROJECT-REF`.
3. Apply the schema: `supabase db push` (runs `migrations/0001_foundations.sql` and `0002_nutrition_coach_privacy.sql`).

## 2. Sign-in by email code

Authentication > Providers > Email: enable it. Authentication > Email Templates > Magic Link: include `{{ .Token }}` so the email carries the 6-digit code the app asks for. Sign-up is open by design, so also turn on CAPTCHA (Authentication > Attack Protection) and keep the default auth rate limits: the coach's per-user limits (30 model calls an hour, 200,000 tokens a day) do not stop someone creating many accounts.

## 3. Secrets and functions

```
supabase secrets set ANTHROPIC_API_KEY=...
supabase functions deploy coach
supabase functions deploy privacy
```

Each user picks the coach model in Settings: Fast (`claude-haiku-5-5`), Balanced (`claude-sonnet-5-5`) or Most capable (`claude-opus-5-5`). `COACH_MODEL` is optional and only sets the default for users who have not picked; without it the default is `claude-opus-5-5`. The plan's cost model (plan/06) assumed `claude-sonnet-5-5`. `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided to functions automatically.

## 4. Retention job

Enable the `pg_cron` extension, then run once in the SQL editor:

```sql
select cron.schedule('purge-expired', '15 3 * * *', 'select purge_expired()');
```

## 5. App

Copy `app/.env.example` to `app/.env` and fill in the project URL and anon (publishable) key. Restart Expo.

## What runs where

| Piece | Where | Notes |
|---|---|---|
| Plan, safety screening, progression, nutrition maths, coach rules and validators | Phone (`@ff/engines`) | Works offline |
| Backup of profile, consents, safety answers and limits, workouts, sets, check-ins, reports | Postgres, RLS on every table | Phone is the source of truth; backup mirrors it |
| Coach chat history | Phone only, 90 days | Not sent to the backup |
| Coach wording | `functions/coach` calls Claude | Needs backup sign-in and AI consent; server builds its own prompt; 30 turns an hour |
| Export and deletion | `functions/privacy` | Deletion needs a sign-in in the last 15 minutes |
| Security log | `security_log`, hashed user ID, no content | Kept 1 year after deletion (DPDP R-05, counsel to confirm) |
