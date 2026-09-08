# admin

Subdirectory of the source-controlled website, published to
`andrewcheong.com/admin`. Console for the **shared cross-website auth
system** (one account works on every site; per-website roles).

- **index.html** — the console. Login → users table (create/edit/delete users,
  grant/revoke per-website roles, generate invite + reset links).
  Access requires role `admin` on website `admin`.
- **reset.html** — set-password page reached from reset links
  (`/admin/reset.html?code=...`). Invite links use the same flow with a
  per-website skin (`/<website>/invite.html?code=...` — see
  `../hxh/invite.html`). Username comes from the code and is readonly;
  codes are one-time and expire (invite 7d, reset 1h).
- **assets/style.css** — shared styles for both pages.

Backend: the `admin` project in
[`slackwing/hobby-server`](https://github.com/slackwing/hobby-server)
(`internal/shared/`, tables `hobby_server_*` in the shared DB). Public
API at `/admin/api/*` → backend `/api/admin/*`. SSO cookie
`hobby_session`, `Path=/` — one login spans all sites on the domain.
When changing the wire format on either side, check both repos.

The gate this powers on sites (e.g. hxh) is client-side UX only —
static HTML remains fetchable by URL; the protection is for API data.
