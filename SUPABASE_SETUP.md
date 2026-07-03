# Enable live team sync (Supabase)

By default the app stores edits in each person's own browser. Follow these steps
once to switch it to a **single shared copy that everyone edits live**. Free tier
is plenty for this.

Takes about 10 minutes. No coding.

---

## 1. Create a Supabase project

1. Go to <https://supabase.com>, sign in (GitHub login works), click **New project**.
2. Give it a name (e.g. `event-checklist`), set a database password (save it
   somewhere), pick a region near you, and create it.
3. Wait ~2 minutes for it to finish provisioning.

## 2. Create the shared table

1. In the project sidebar open **SQL Editor** → **New query**.
2. Paste the block below and click **Run**.

```sql
create table if not exists public.checklist (
  id         int primary key,
  data       jsonb not null default '{}'::jsonb,
  writer     text,
  updated_at timestamptz not null default now()
);

alter table public.checklist enable row level security;

-- Anyone who can open the site (i.e. has the anon key) may read and write.
-- That's the same trust model as a shareable editable link. Add auth later if needed.
create policy "read"   on public.checklist for select using (true);
create policy "insert" on public.checklist for insert with check (true);
create policy "update" on public.checklist for update using (true) with check (true);

-- Turn on realtime so edits show up live for everyone.
alter publication supabase_realtime add table public.checklist;
```

If the last line errors with "already member of publication", ignore it — realtime
is already on.

## 3. Copy your keys

1. Sidebar → **Project Settings** (gear) → **API**.
2. Copy two values:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **Project API keys → `anon` `public`** (a long token)

## 4. Paste them into the app

Open [`config.js`](config.js) and fill in the two blanks:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://abcdefgh.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi...your-anon-key...",
  TABLE: "checklist",
};
```

Save, commit, and push (GitHub Pages redeploys automatically in a minute).

## 5. Check it works

Open the site. The pill in the top bar should go **Connecting… → Live sync on**
(green). Open it in a second browser or on your phone, change something in one,
and watch it appear in the other within a second.

The first person to load after setup seeds the shared copy from the spreadsheet
data. From then on everyone shares one live dataset.

---

## Good to know

- **Public key, protected data.** The anon key is designed to ship in front-end
  code; what it can do is limited by the table's Row Level Security policy above.
  With the open policy, anyone who can reach the site can edit — fine for an
  internal tool on an unlisted URL. To restrict it, add Supabase Auth with an
  email allowlist (a bigger change — ask if you want it).
- **Conflicts.** The whole dataset is saved as one document (last-write-wins).
  Realtime keeps everyone current, so clashes are rare; two edits in the very
  same second could overwrite each other.
- **Reset.** With sync on, the **Reset** button restores the shared data to the
  original spreadsheet **for the whole team** — it warns you first.
- **Turning sync off.** Blank out the two values in `config.js` and redeploy; the
  app falls back to per-browser storage. Your Supabase data stays untouched.
