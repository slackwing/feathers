# hxh

Subdirectory of the source-controlled website, published to `andrewcheong.com/hxh`.

## Project summary

Website for a **Hunter x Hunter–themed Halloween party**. Guests visit the
site to register, claim the character they'll dress up as, and (eventually)
more fun stuff. Framed in-universe as an official Hunter Association summons:
"Hunter × Halloween".

## Current state (as of 2026-09-05)

- **index.html** — login-gated landing page. Logged out: a "restricted
  site" gate (login form + reach-out-to-hosts note). Logged in (shared
  auth `/admin/api/me`): exam-notice hero, character roster grid (16
  characters with Nen types), registration section stubbed as "opens
  soon". Party date/venue are placeholders (`TBD`) — ask Andrew. The
  gate is client-side UX only; static HTML remains fetchable.
- **invite.html** — HxH-skinned set-password page for invite links
  (`/hxh/invite.html?code=...`), generated from the `/admin/` console.
  Username comes from the code (readonly field); codes are one-time,
  7-day expiry.

## Auth: the SHARED system (as of 2026-09-05)

hxh logs in via the shared cross-website auth system — the `admin`
project in [`slackwing/hobby-server`](https://github.com/slackwing/hobby-server)
(`internal/shared/`), console at `/admin/`. One account per person,
SSO cookie `hobby_session` (Path=/), per-website roles
(`hxh` roles: `admin`, `guest`). Frontend calls `/admin/api/*`.
See `../admin/CLAUDE.md`.

The hxh-specific hobby-server project still exists but its auth floor
(`/hxh/api/*`, `hxh` DB `user`/`session` tables) is UNUSED — the `hxh`
database is reserved for future party data tables (`guest` prefs,
`character_claim`, ... changeset 002+ once open questions settle).
Role checks for those endpoints should go through the shared system.

## Open questions (ask Andrew before building)

- **Party date / time / venue** — placeholders in the hero right now.
- **Character exclusivity** — first-come-first-serve claims (no duplicate
  costumes) or can multiple guests pick the same character?
- **Registration friction** — name-only, or name + email? Any login at all,
  or one-tap claim with an edit token?
- **Fun-idea backlog** (Andrew said "other fun ideas"; candidates to pitch):
  - Nen water-divination quiz that assigns your Nen type on registration
  - Generated Hunter License ID card per guest (shareable image)
  - Costume contest voting page (night-of)
  - Greed Island–style "party quest" card checklist
  - Phantom Troupe counter ("13 spiders" — first 13 to register?)

## Design direction

- Dark "Hunter Exam summons" aesthetic: near-black ink, aged-paper cream,
  blood crimson, toxic Nen green; the `×` from the logo as a recurring motif.
- Fonts: Alfa Slab One (logotype), Special Elite (typewriter notice body).
- Characters rendered as typographic Greed Island–style cards color-coded by
  Nen type (no copyrighted art on the site).
- Must work well on phones — guests will register from their phones.

## Publishing

See `../CLAUDE.md` for the `ws_prod` deploy alias (must be run from the
`html/` directory, master branch only). Don't deploy without Andrew's say-so
while the page still has TBD placeholders.
