# Put the app behind a real login (Cloudflare, free)

This gives you a genuine login screen in front of the whole site — enforced at
Cloudflare's edge, so it can't be bypassed by reading the page source. Free for
up to 50 users, and **no custom domain required**.

The trick: host on **Cloudflare Pages** (instead of GitHub Pages) so Cloudflare
serves the site and can gate it. Your code and GitHub repo stay exactly the same —
Cloudflare just deploys from the repo and adds the login.

Two parts: **A) deploy to Cloudflare Pages**, then **B) turn on the login**.
About 15 minutes total.

> Exact menu labels in Cloudflare shift occasionally; the section names below are
> the stable landmarks.

---

## A. Deploy to Cloudflare Pages

1. Push this repo to GitHub if you haven't (see README → Deploy).
2. Sign up free at <https://dash.cloudflare.com>.
3. **Workers & Pages → Create → Pages → Connect to Git.** Authorise GitHub and
   pick the `event-checklist` repo.
4. Build settings — this is a plain static site, so there's no build step:
   - **Framework preset:** None
   - **Build command:** *(leave empty)*
   - **Build output directory:** `/`  (the repo root, where `index.html` lives)
5. **Save and Deploy.** After a minute you get a URL like
   `https://event-checklist-ab1.pages.dev`. Every future `git push` redeploys
   automatically.

At this point the site is live but public. Now lock it.

## B. Turn on the login (Cloudflare Access)

1. In the dashboard open **Zero Trust**. First time, it asks you to pick a team
   name (e.g. `bcdss`) and a plan — choose the **Free** plan (up to 50 users).
2. **Access → Applications → Add an application → Self-hosted.**
3. Settings:
   - **Application name:** Event Checklist
   - **Session duration:** e.g. 1 week (how long before people re-login)
   - **Application domain:** enter your Pages hostname, e.g.
     `event-checklist-ab1.pages.dev`. (Add a second entry for any custom domain
     or `*.pages.dev` preview URLs if you want those covered too.)
4. **Add a policy:**
   - **Action:** Allow, **Policy name:** Team
   - **Include:** either **Emails** → list each teammate's email, or
     **Emails ending in** → `@your-institution.de` to allow anyone at your org.
5. **Identity / login method:** Cloudflare's built-in **One-time PIN** is on by
   default — teammates type their email, get a 6-digit code, and they're in. No
   extra identity provider or per-user accounts needed.
6. Save.

Now anyone visiting the site hits Cloudflare's login page first. Only allowed
emails get through; everyone else is blocked before the app ever loads.

---

## Notes

- **Works with live sync.** Access only gates the *page*. The browser still talks
  to Supabase directly (a different domain), so real-time sync keeps working. And
  because only logged-in teammates can load the page, the Supabase key is no longer
  publicly exposed — the simple open policy in `SUPABASE_SETUP.md` is fine to keep.
- **Adding / removing people:** edit the Access policy's email list. Instant, no
  redeploy.
- **Prefer to stay on GitHub Pages?** Then you need a custom domain whose DNS is on
  Cloudflare (point the domain at `you.github.io`, proxy it, and protect that
  hostname with Access). The Cloudflare Pages route above avoids needing a domain.
- **Costs:** Cloudflare Pages and Access are free at this scale. A domain is
  optional.
