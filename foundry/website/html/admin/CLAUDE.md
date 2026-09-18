# admin

Subdirectory of the source-controlled website, published to
`andrewcheong.com/admin`. Console for the **shared cross-website auth
system** (one account works on every site; per-website roles), plus
the shared machinery every site's invite / reset pages run on.

- **index.html** — the console (light, small, informational — Andrew's
  spec 2026-09-18). Login → one table of users: avatar (click → change
  initial, max 2 chars, and colour), username, display name and email
  (click to edit in place), active site (dropdown; the site invites,
  resets and emails act on), roles as chips labelled `site` / `role`
  with an add control, and an invite · reset matrix — each row has a
  mail icon (asks: Send / Preview / Cancel; Preview opens
  `/<site>/_email/?template=…&user=…`) and a link icon (copies the
  link to the clipboard). Delete asks for confirmation. New users are
  created from the table's last row (default active site hxh, random
  colour, initials from the name). Access requires role `admin` on
  website `admin`.
- **assets/setpw.js** — the set-password machinery behind every site's
  `_invite/` and `_reset/` page (reads `?code=`, `token-info`,
  `set-password`, state switching via `data-pw` hooks). Sites skin it;
  the machinery is never copied.
- **_invite/**, **_reset/** — the default (unskinned) invite and
  password-reset pages, used for any site without its own, and for the
  console's own resets. Both need a code; without one the form is
  disabled.
- **assets/style.css** — the ADMINISTRATIVE BASE: one light, plain
  stylesheet shared on purpose by the console, the default `_invite/` /
  `_reset/` pages, and every site's `_email/` previewer, so everything
  an admin operates looks like one tool and a site's theme only ever
  appears inside a preview frame. New admin-facing pages link it; site
  pages never do.

Backend: the `admin` project in
[`slackwing/hobby-server`](https://github.com/slackwing/hobby-server)
(`internal/shared/`, tables `hobby_server_*` in the shared DB). Public
API at `/admin/api/*` → backend `/api/admin/*`. SSO cookie
`hobby_session`, `Path=/` — one login spans all sites on the domain.
When changing the wire format on either side, check both repos. Full
guide: `~/src/hobby-server/docs/SHARED_AUTH.md`.

The gate this powers on sites (e.g. hxh) is client-side UX only —
static HTML remains fetchable by URL; the protection is for API data.
