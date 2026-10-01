# admin

Subdirectory of the source-controlled website, published to
`andrewcheong.com/admin`. Console for the **shared cross-website auth
system** (one account works on every site; per-website roles), plus
the shared machinery every site's invite / reset pages run on.

- **index.html** — mounts assets/console.js for every site (below). The
  console (light, small, informational — Andrew's spec 2026-09-18). Login → one table of users: avatar (click → change
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
- **assets/console.js** (2026-10-01) — THE users console, one
  implementation for `/admin/` (`Console.mount({ site: null })`, role
  admin/admin) and every site's `/<site>/_admin/` (`Console.mount({ site
  })`, the site's admins; API `/admin/api/site/{site}/…`, server-side
  scope: hobby-server `internal/shared/siteadmin.go`). Pages hold only
  `<main id="console">`, the stylesheet and the mount call. Layout: the
  people table; apart below it the add-user form (Name — "first name,
  capitalized", placeholder Judy — → username derived from it
  (`usernameFor`: "Kimmy T" → kimmyt), read-only → Email; all required);
  in /admin/ only, the bots' own table and the bot programs. The ONE
  branch: a site console's form creates → adds the site's default role
  → sends the invite (steps shown, a spinner on the running one);
  /admin/'s only creates. In a site console people reaching beyond the
  site come back `editable: false` and are drawn read-only (no email /
  reset takeover by a site admin); no deletes, bots, active site there.
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

## Bots (2026-09-19)

Users with `is_bot` (hobby-server admin changeset 007) are listed AFTER
real users under a "Bots" divider row, with a purple `bot` badge next to
the username; their passwords are provisioned by hobby-server's bot
service, not by invite. Below the Users table, a "Bots" section lists
the bot programs (`GET /admin/api/bots`) with an on/off switch
(`PUT /admin/api/bots/{name}`); it hides itself when the bot service is
off (404). Spec: `foundry/website/docs/HXH_BOTS.md`.
