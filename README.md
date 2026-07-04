# Event Checklist — Communications Tracker

A single-page web app for tracking event publicity: which channels (social media, news,
webpage, poster, e-mail, uni event site, coverage, recap) each event needs, who on the
team is responsible for each, and whether the event is fully handled.

Data was imported from `Event Checklist BETA.xlsx` (sheets **2025** and **2026**, 47 events).

## Features

- **Timeline view** — events grouped by month, with date cards, event-type tags,
  status (Done / In progress / Planned), a "Next up" highlight, and per-channel
  assignment chips.
- **Matrix view** — the classic spreadsheet grid, one row per event, one column per channel.
- **Team view** — per-person workload: total tasks, breakdown by channel, upcoming tasks.
- **Add events** — the **+ Add event** button, the floating **+** button (bottom-right),
  or pressing **N** opens a dialog: enter a title (the event type is auto-detected but can
  be changed), pick start/end dates, and tick which of the nine channels the event needs
  (unticked channels are marked N/A). The new event slots into the right month and year.
- **Editing** — click any channel chip/cell to assign or unassign people (multi-select),
  mark a channel N/A, or add new team members. Toggle Done, delete events.
- **Filters** — search, status pills, person filter, year tabs.
- **Export CSV** — download the current year in the original column layout (opens in Excel).
- **Persistence** — edits are saved in the browser by default. **Reset** restores
  the original spreadsheet data.
- **Live team sync (optional)** — add Supabase credentials to `config.js` and the whole
  team edits one shared copy that updates in real time. A status pill in the top bar shows
  *Local only* / *Live sync on*. Setup: **[SUPABASE_SETUP.md](SUPABASE_SETUP.md)**.
- **Password (optional)** — require one shared password to open the app (client-side
  PBKDF2 + AES-GCM; also encrypts the Supabase key). Setup: **[PASSWORD_SETUP.md](PASSWORD_SETUP.md)**.
  For un-bypassable edge login, see **[LOGIN_SETUP.md](LOGIN_SETUP.md)**.

No build step and no bundler. Runs as plain static files; live sync (if enabled) loads the
Supabase client from a CDN at runtime.

## Run locally

Open `index.html` directly in a browser, or serve the folder:

```
python -m http.server 8000
```

## Deploy

Any static host works — upload the folder as-is:

- **GitHub Pages**: push to a repo, then **Settings → Pages → Source: `main` / root**.
  Site goes live at `https://<user>.github.io/<repo>/` (public).
- **Cloudflare Pages**: connect the repo; adds a free, un-bypassable **login** in front
  of the site. Recommended for private team use — see **[LOGIN_SETUP.md](LOGIN_SETUP.md)**.
- **Netlify** / **Vercel**: drag-and-drop or `npx vercel`.

For a team you'll usually want both:

- **[Live sync](SUPABASE_SETUP.md)** — everyone shares one dataset that updates in real time.
- **[Login](LOGIN_SETUP.md)** — restrict who can open the site (also keeps the Supabase key
  off the public web).

Without sync, each person's edits stay in their own browser (still fine as a shared
read-only view; use **Export CSV** to feed changes back into the master spreadsheet).

The asset links in `index.html` carry a `?v=` version tag (e.g. `app.js?v=3`) so browsers
don't serve a stale copy after you redeploy. If you change `app.js`, `styles.css`,
`config.js`, or `data.js`, bump that number (`?v=4`, …) so everyone gets the update.

## Files

| File | Purpose |
|---|---|
| `index.html` | page shell |
| `styles.css` | all styling |
| `app.js` | views, editing, filtering, export |
| `data.js` | seed data generated from the Excel file |
| `config.js` | Supabase credentials + password settings (all blank = open, single-browser) |
| `sync.js` | live shared-data layer (dormant unless `config.js` is filled in) |
| `auth.js` | optional shared-password gate (dormant unless a password is set) |
| `setup-password.html` | in-browser generator for the password config |
| `generate_data.py` | regenerates `data.js` from the spreadsheet (edit `SRC`/`OUT` paths, needs `openpyxl`) |
| `serve.py` | optional local dev server |
