# rv

Subdirectory of the source-controlled website, published to `andrewcheong.com/rv`.

## Project summary

Andrew and his partner Abi are planning an RV trip across the United States, driving from San Diego to New York City. This site serves a dual purpose:

1. **Organizational** — an itinerary they can refer to while driving. Tracks stops, driving distances, museum/national park open/close times, and tiered activity lists (must-do, want-to-do, maybe-do, backup options).
2. **Keepsake** — a nice website to remember the trip by, with photos and trip narrative.

## Design direction

- **Single-page feel** with smooth scroll transitions. Inspiration: a friend's site with a vertical timeline alongside the content — as you scroll, your position in the trip timeline updates, so the whole trip lives on one page but stays organized by stops and drives.
- **Cross-platform smoothness is critical.** The site must work well on iOS (Abi's iPhone + iPad), Android (Andrew's phone), and desktop (Andrew's laptop). Favor well-established, cross-compatible web technologies and design patterns over anything experimental or device-specific.
- **Helper pages** are okay alongside the main itinerary page — e.g., RV maintenance notes.

## In-progress planning

See `PLAN.md` in this directory for the evolving build plan.

## Publishing

See the parent directory's `CLAUDE.md` at `../CLAUDE.md` for the `ws_prod` deploy alias (must be run from the `html/` directory).
