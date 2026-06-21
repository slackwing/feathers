# rv

Subdirectory of the source-controlled website, published to `andrewcheong.com/rv`.

---

## 🔒 PROVENANCE RULES — READ BEFORE EDITING `rv/assets/trip.json`

Every fact and structural field in `trip.json` carries provenance metadata
(`author`, `confidence`, `pinned`). These exist so Andrew can vet things over
time and so future Claude sessions don't blow away verified work.

### THE TWO HARD RULES

**🚫 NEVER MODIFY ANY FIELD OR FACT WHERE `pinned: true` WITHOUT EXPLICIT PERMISSION FROM ANDREW.**

**🚫 NEVER MODIFY ANY FIELD OR FACT WHERE `author: "andrew"` WITHOUT EXPLICIT PERMISSION FROM ANDREW.**

These rules apply even during sweeping rebuilds. They apply even if the data
looks "obviously wrong." Ask first. Always.

**Exception (the only one):** Fixing literal typos or pure-cosmetic reformatting
(whitespace, quote style, json formatting) is allowed without permission. If
the change has *any* semantic content — even adjusting a number by 1 or rewording
a sentence — it requires explicit permission.

### Never delete — soft-delete instead

When data becomes obsolete (e.g., user shifts the plan and old facts no longer
apply), **mark with `dropped_at` (ISO 8601) and `dropped_reason`** instead of
deleting. The item stays in `trip.json` for archaeology; scripts and renderers
filter dropped items at runtime. See `rv/assets/META.md` for the schema.

When in doubt, ask. The cost of asking is low; the cost of overwriting Andrew's
vetted work is high.

See `rv/assets/META.md` for the full schema and authoring rules. See the
`rv-itinerary-rebuild` skill for the rebuild pipeline.

---

## Project summary

Andrew and his partner Abi are planning an RV trip across the United States, driving from San Diego to New York City. This site serves a dual purpose:

1. **Organizational** — an itinerary they can refer to while driving. Tracks stops, driving distances, museum/national park open/close times, and tiered activity lists (must-do, want-to-do, maybe-do, backup options).
2. **Keepsake** — a nice website to remember the trip by, with photos and trip narrative.

## Design direction

- **Single-page feel** with smooth scroll transitions. Inspiration: a friend's site with a vertical timeline alongside the content — as you scroll, your position in the trip timeline updates, so the whole trip lives on one page but stays organized by stops and drives.
- **Cross-platform smoothness is critical.** The site must work well on iOS (Abi's iPhone + iPad), Android (Andrew's phone), and desktop (Andrew's laptop). Favor well-established, cross-compatible web technologies and design patterns over anything experimental or device-specific.
- **Helper pages** are okay alongside the main itinerary page — e.g., RV maintenance notes.

## Current state (as of 2026-06-21)

- **index.html** — main itinerary page. Renders day-by-day cards from
  `assets/trip.json` (via `assets/itinerary.js`), plus the V2 route map
  (via `assets/map-v2.js`, reading `assets/map.json`).
- **prep.html** — pre-trip checklist with dependency arrows + localStorage.
  Reads `assets/prep.json`, runs `assets/prep.js`. **Gated by login.**
- **assets/site-unit.js** — site-wide °C/°F toggle, fixed top-right of every
  page, cookie-backed.
- **assets/auth.js** — site-wide login button + modal. Talks to the
  rv-server backend (see below) at `/rv/api/{me,login,logout}`. Exposes
  `window.rvAuthUser`, `window.rvAuthResolved`, fires `rv:auth-resolved`
  and `rv:auth-change` events. Hides any `.prep-link-wrap` element when
  logged out.
- **scripts/compute_everything.py** — single pipeline that reads
  `assets/map-sources.json` + `assets/trip.json`, calls Google Directions
  + Open-Meteo (cached in gitignored `.cache/`), writes `assets/map.json`.
  Run when locations/routes change.
- **assets/META.md** — provenance schema for `trip.json`.
- **MAP_V2_MECHANICS.md** — data model for the V2 route map.

## Sibling backend repo

The auth backend is a separate repo:
**[`slackwing/rv-server`](https://github.com/slackwing/rv-server)** (locally:
`~/src/rv-server/`). It's a tiny Go service (3 endpoints) that lives on
the same VM as manuscript-studio and talks to a separate `rv_trip`
database on the same Cloud SQL instance. See `rv-server/CLAUDE.md` and
`rv-server/AGENTS.md` for backend conventions. **When changing the wire
format on either side, check both repos.**

## Publishing

See the parent directory's `CLAUDE.md` at `../CLAUDE.md` for the `ws_prod` deploy alias (must be run from the `html/` directory).
