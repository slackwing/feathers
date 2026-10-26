# SXIVA Dashboard

andrewcheong.com/status charts Andrew's daily minutes from his `.sxiva` files.

- **Page**: `foundry/website/html/status/` in this repo (static; deployed
  with `ws_prod`).
- **API + database**: the `sxiva` project of
  [hobby-server](https://github.com/slackwing/hobby-server)
  (`internal/sxiva/`, Cloud SQL database `sxiva`), public at
  `/status/api/*`.
- **Uploader**: `../tools/sxiva/sync.py` — `sxiva` syncs before opening a
  file; `sxiva upload` syncs on demand. Token: `$SXIVA_API_TOKEN` or
  `~/.sxiva/token` (never commit it).

Until 2026-10-26 the API was a Flask app with a TimescaleDB container in
this directory (`server/`, `docker/`, `deploy/`); see git history.
