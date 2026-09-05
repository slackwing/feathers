# hxh

Subdirectory of the source-controlled website, published to `andrewcheong.com/hxh`.

## Project summary

Website for a **Hunter x Hunter–themed Halloween party**. Guests visit the
site to register, claim the character they'll dress up as, and (eventually)
more fun stuff. Framed in-universe as an official Hunter Association summons:
"Hunter × Halloween".

## Current state (as of 2026-09-03)

- **index.html** — landing page. Exam-notice hero, character roster grid
  (16 iconic characters with Nen types), registration section stubbed as
  "registration opens soon". Self-contained (inline CSS/JS), no backend
  calls yet. Party date/venue are placeholders (`TBD`) — ask Andrew.

## Sibling backend repo (LIVE as of 2026-09-03)

The `hxh` project is registered in
[`slackwing/hobby-server`](https://github.com/slackwing/hobby-server)
(locally `~/src/hobby-server/`), deployed and serving:

- Endpoints: `/hxh/api/{me,login,logout}` (Apache proxies public
  `/hxh/api/*` → backend `127.0.0.1:5002/api/hxh/*`; block in
  `/etc/apache2/conf-available/andrewcheong.conf` on the VM)
- Cookie: `hxh_session`, `Path=/hxh/`
- Database: `hxh` — its OWN database on the shared Cloud SQL instance
  (NOT the shared `hobby_server` DB rv uses; auth table names collide
  per-project). Tables so far: `user`, `session`.
- Schema: `liquibase/hxh/changelog/` in the hobby-server repo
- No users created yet — registration model still undecided
- Party tables (`guest`, `character_claim`, ...) go in changeset 002+
  once the open questions below are settled

See `hobby-server/CLAUDE.md` and `AGENTS.md` for backend conventions.
When changing the wire format on either side, check both repos.

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
