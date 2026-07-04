# Put a password on the app

A single shared password that everyone on the team types to get in. No accounts,
no external service, no card. Set it in three minutes.

## Set (or change) the password

1. Open **`setup-password.html`** — either double-click the file on your computer,
   or visit `https://event-checklist.pages.dev/setup-password.html`.
2. Type the password you want (twice). If you use live sync, also paste your
   Supabase **anon** key so it gets encrypted behind the password.
3. Click **Generate config** and **Copy** the output.
4. Paste it into **`config.js`**, replacing the `AUTH: { … }` block (and the
   `SUPABASE_ANON_KEY_ENC` line if you protected a key — then set
   `SUPABASE_ANON_KEY: ""`).
5. Bump the `?v=` numbers in `index.html` (e.g. `?v=4` → `?v=5`) so browsers pick
   up the change.
6. Commit and push. The site redeploys with the password on.

To **change** the password later, repeat with a new one. To **remove** it, set
`AUTH.salt` and `AUTH.check` back to `""`.

## What it does — and doesn't

- Everything runs in the browser using real encryption (PBKDF2 + AES-GCM). The
  password is **never** stored or sent anywhere; only encrypted values live in
  `config.js`.
- Once someone enters the password, they stay unlocked for that browser tab
  session (closing the tab re-locks).
- **Honest limit:** because the check runs in the browser, a determined technical
  person could read the page's source to get past the *screen* (the app's own
  events data is public seed data anyway). What's genuinely protected is the
  **Supabase key** — it's stored only in encrypted form, so the shared/live data
  can't be reached without the password.
- If you ever need un-bypassable, edge-enforced login (no technical bypass at
  all), that's the Cloudflare route in **[LOGIN_SETUP.md](LOGIN_SETUP.md)**.
