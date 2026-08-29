# Faviour cloud setup (one-time)

The app works fully offline with none of this. These steps light up accounts,
cross-device sync, and profile sharing.

## 1. Supabase project

1. Create an account at supabase.com and a new project (free tier, nearest
   region). Any strong database password — you won't need it day-to-day.
2. Project Settings → API: copy the **Project URL** and the **anon public**
   key into a `.env` file next to this README (see `.env.example`).
   The anon key is designed to be public (it ships inside the app); row-level
   security is what protects data. The **service_role** key is never used
   anywhere in this project — don't put it in any file.

## 2. Apply the schema

Either paste `supabase/migrations/0001_init.sql` into the SQL Editor
(Dashboard → SQL Editor → New query → Run), or generate an access token
(Account → Access Tokens) and let the tooling run
`npx supabase link` + `npx supabase db push`.

## 3. Auth dashboard config

- Authentication → Email Templates → **Magic Link**: add a line
  `Your code: {{ .Token }}` so sign-in emails carry the 6-digit code the app
  asks for.
- Authentication → URL Configuration → Redirect URLs: add
  `faviour://auth-callback` (used by Google sign-in).

## 4. Google sign-in (can be done later; email codes work without it)

1. console.cloud.google.com → create a project (any name).
2. OAuth consent screen: External; add the Gmail addresses that will sign in
   as test users while the app is unverified.
3. Credentials → Create credentials → OAuth client ID → type
   **Web application** → Authorized redirect URI:
   `https://<project-ref>.supabase.co/auth/v1/callback`
   (project-ref is in your Supabase project URL).
4. Copy the Client ID and Client Secret into Supabase → Authentication →
   Providers → Google, and enable it.

## 5. Sharing (once the feature ships)

On the sharing phone: Settings → Share my list → read out the 8-character
code. On the receiving phone: Settings → Enter share code. Codes are
single-use and expire after 48 hours; revoke any time from Settings.
