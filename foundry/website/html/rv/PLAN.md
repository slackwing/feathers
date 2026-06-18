# RV Trip Website — Plan

Living document. We'll grow this as we figure things out.

## Goals

- **Itinerary that works in the car.** Glanceable on phones, readable in sunlight, fast on spotty cell service.
- **Memorable keepsake.** Looks nice, holds photos, tells the story of the trip after it's done.
- **Cross-platform.** iOS (Safari on iPhone + iPad), Android (Chrome), desktop. No device-specific tricks.
- **Give Abi's Figma a second life.** Carry over its vibe so it feels like an evolution of her work, not a do-over.

## Vibe (carried over from Abi's Figma)

- **Soft pastel mint/cream background** — relaxed, warm, not a "tech" feel.
- **Photo-led:** every stop opens with a rounded-corner photo card of the place.
- **🐸 frog icon** = Abi's "definitely want to do" picks (pronounced "frojee").
- **🦔 hedgehog icon** = Andrew's picks (to be added — Andrew hasn't filled these in yet).
- **🚐 little RV icon** = lodging / overnight spot for that leg.
- **Driving days** get their own breakpoint sections (e.g., "Denver > Lincoln (7.5 hr)").
- Section structure per stop: place name, photo, list of activities with sub-notes (time, cost, link).

## Travelers & vehicle

- **Andrew** (hedgehog 🦔 — grumpy & spiky in joke-form) + **Abi** (frog 🐸 — silly & laidback).
- **RV:** 2018 Mercedes Benz Sprinter 2500 Extended. **24 ft long, 7.7 ft wide** (without mirrors).
  - ⚠️ Some stops cap RVs at <22 ft (e.g., **Black Canyon of the Gunnison South Rim Drive**). Surface this constraint per-stop.

## Route (from Abi's Figma — first draft)

San Diego → NYC. Stops identified so far:

1. **San Diego** (start) — beach, breweries, Tacos Al Gordo, 🐸 Sunset Cliffs Natural Park, La Jolla tide pools
2. **Tucson** — 🐸 Arizona-Sonora Desert Museum, Signal Hill Petroglyphs, Gates Pass overlook, star gazing
3. **White Sands National Park** — 🐸 Dunes Drive loop, 🐸 Sledding at White Sands Trading Company, Oliver Lee Memorial State Park
4. **Albuquerque** — breakfast burritos, 🐸 Breaking Bad self-guided tour (extensive location list)
5. **Santa Fe** — Meow Wolf Immersive Art Experience
6. **Colorado** — 🐸 Mesa Verde National Park (need to book tour), Morefield Campground, 🐸 Telluride (free gondola, breweries, Million Dollar Hwy), Soak in a Hot Spring, 🐸 Black Canyon of the Gunnison ⚠️ <22 ft RV limit, 🐸 Crested Butte (Teddy's Trail loop wildflowers)
7. **Denver** — Meow Wolf Denver, dinner with Andrew's friends
8. **Driving day:** Denver → Lincoln (7.5 hr), thrifting in Lincoln
9. **Lincoln AM** — thrifting, Sheldon Museum of Art
10. **Omaha PM** — Joslyn Art Museum (free, closes 4pm), Riverfront walking, Council Bluffs KOA
11. **Driving day:** Omaha → ...
12. *(continues — TBD past Omaha through to NYC)*

## Information architecture

- **`/rv` — main itinerary page (single-page scroll)**
  - Hero / intro
  - Vertical timeline along one side; scroll position highlights current stop
  - Each stop section: photo card, activities (🐸 must-do / 🦔 Andrew's picks / maybe / backup), food, hours/cost, links
  - Each driving day section: from → to, distance, est. drive time, route notes
- **Helper pages**
  - `/rv/maintenance` — RV maintenance notes, service history, checklists
  - `/rv/overnight-parking` — the 5-category system from Andrew's research (BLM/forests, rest areas, private lots, reserved campgrounds, city streets), parking-vs-camping rule, state-by-state time limits
  - (more as we identify them)

## Activity tiers (per stop)

Carrying over Abi's 🐸 system and extending it:

- **🐸 Frog (Abi's definitely-do)** — already marked in her Figma
- **🦔 Hedgehog (Andrew's definitely-do)** — to be added; Andrew needs to go through and pick
- **Want-to-do** — both interested but flexible
- **Maybe** — depends on time/energy
- **Backup** — Plan B if something falls through (especially important for reserved campgrounds — see overnight parking research)

## Tech direction (proposed, not committed)

- **Static HTML/CSS/JS**, no build step or framework. Matches the rest of the site, deploys via the existing `ws_prod` rsync, no runtime to break in the car.
- **Vanilla JS + IntersectionObserver** for scroll-driven timeline highlight. Well-supported across iOS Safari, Android Chrome, desktop.
- **CSS scroll-snap (optional)** for section-by-section feel without hijacking scroll.
- **Responsive images** with `<picture>` / `srcset` so phones don't download desktop-sized photos.
- **Custom 🐸/🦔/🚐 icons** — start with emoji to honor the Figma; can upgrade to custom SVGs if we want a more polished look.
- **Offline-friendly:** lightweight enough that it loads once and stays usable. Service worker possible later if we want true offline.

## Open questions

- **Dates?** Abi's Figma shows a tide chart for July 4 in San Diego — is early July the rough start? When do we need to be in NYC?
- **Map view?** Abi's Figma has a "Google Maps with pins (link to map)" checkbox. Embedded Google Map is the safest cross-platform choice. An interactive route map drawn ourselves is a perf/compat risk worth discussing.
- **Stops past Omaha?** Need the rest of the route to scaffold the page end-to-end.
- **Photo sourcing strategy?** In-repo (simple, syncs with `ws_prod`, works offline) is the safer default. External (Google Photos embeds) risks failing in the car.
- **Dynamic "today's stop"?** Auto-highlight the current section by date, or just let us manually scroll?

## How Andrew can help right now

1. ✅ **Abi's Figma** — received as PDF, parsed, copied into `reference-materials/`.
2. ✅ **Parking research email** — saved to `reference-materials/email-to-abi-parking-research.md`.
3. **Photos of Andrew + Abi** — when ready, drop them in `reference-materials/photos/` (I'll create the folder). Useful for hero mockup.
4. **RV photo / reference** — Andrew mentioned no photo of the RV yet but a model link is coming. A stock photo of the 2018 Sprinter 2500 Extended works as a placeholder.
5. **Andrew's 🦔 picks** — go through Abi's list and mark which ones Andrew is also excited about, and add any new ones (museums, parks, food, weird roadside stuff).
6. **Rest of the route** — Omaha → NYC stops, even tentative.
7. **Friend's reference site** — the vertical-timeline site URL, if Andrew can dig it up.

## Next steps (once we have a few more inputs)

- [ ] Sketch the visual direction in HTML/CSS — pastel mint/cream background, photo cards, frog/hedgehog/RV icons
- [ ] Build a prototype of **one stop + one drive section** to validate the scroll/timeline feel on iPhone, iPad, Android, and desktop before scaling out
- [ ] Decide on Google Maps embed vs. custom map
- [ ] Decide on photo storage strategy
