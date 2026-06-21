# Route Map V2 — Plan

A second, cleaner route map for `index.html`. Coexists with the old
weather-page maps (they stay as a climate-data tool). This one is for
**planning the trip as we go** — showing options for sleep, not a
locked sequence.

## Design summary

- **New data file** `assets/map.json` — separate from `trip.json`.
- **One canonical `locations[]` array** of points-of-interest. Types:
  `major_destination`, `minor_stop`, `sleep_spot`, (future: `shower`,
  `dump`, etc.). All carry real `lat`/`lon`.
- **Backbone route** = chain of `route_nodes[]` (major destinations +
  minor stops only). Each adjacent pair forms a `segment` with
  RV-padded `hours`.
- **Sleep spots** are NOT on the route. They float at their real
  coordinates. Each carries a snap-to-route reference:
  `{segment_id, t in [0,1], detour_hours}`. The internal "snap point"
  is invisible but used for accurate time math.
- **SVG render** on `index.html`, real-coords-honest aspect ratio (no
  y-stretch). Pan + zoom (Google-Maps-style). Major dots large with
  labels; minor dots small with grey italic labels; sleep spots
  rendered as 🚐 emoji (fixed screen size regardless of zoom).
- Drop all the custom SVG icons (mountain/coast/museum/etc) — those
  belong to the weather-page map.
- No temperature/rain coloring on V2. Add later if useful.

## Phase 1 (build now)

1. Define the data structure for `assets/map.json`.
2. Seed it: major destinations + segments + RV emoji sleep spots
   (positions at real coords). Minor stops included in data but not
   rendered yet.
3. New SVG block on `index.html` (placement TBD per Q15).
4. Real-aspect projection (no y-stretch).
5. Pan (drag) + zoom (wheel toward cursor) for the SVG.
6. Render: straight-line segments with hours label, major destination
   dots + labels, 🚐 emojis at real coords (fixed size on zoom).
7. **No** click-to-activate, **no** highlight blue path, **no** minor
   stops rendered, **no** detour-time math surfaced — yet.

## Phase 2 (after phase 1 lands)

8. Render minor stops as small dots on the route with grey italic
   labels.
9. Click any icon (major / minor / 🚐) to "activate" it. Hovering any
   subsequent icon highlights a blue path connecting the two with the
   summed RV-hours shown.
10. Math: for sleep-spot endpoints, sum =
    `detour_hours(from_sleep) + segment_hours_between_snap_points +
    detour_hours(into_sleep)`. Use the invisible snap points on
    each segment as the bridge.
11. Pinch-zoom + double-click-to-zoom on mobile if not already in
    phase 1.

## Phase 3 (later)

- Add per-location categories (shower, dump, gas with diesel, etc.)
  with toggleable filter chips.
- Layer in temperature/rain coloring (re-use the climate data).
- Maybe replace the weather-page maps once V2 has full feature parity.

## Open questions for Andrew

(Numbered so Andrew can reply 1., 2., 3., ... in order.)

1. **Major destinations list.** Andrew proposed: San Diego, Tucson,
   White Sands NP, Albuquerque, Mesa Verde, Telluride, Black Canyon,
   Denver, then "major cities going east." My eastern-half proposal:
   **Lincoln NE, Omaha, Chicago (as a passthrough label), South Bend
   OR Cleveland (pick one OH/IN anchor), New York City.** Drop or
   keep? Specifically: is **Chicago** a major destination (we're
   skirting on I-80, not visiting), or just a minor stop? And do you
   want **Mesa Verde + Telluride + Black Canyon** as three separate
   majors (CO loop gets visually busy) or consolidate to two?

2. **Albuquerque vs. Santa Fe.** Meow Wolf is in Santa Fe. I'd lean
   **Santa Fe as a minor stop on the line** between ABQ and Mesa
   Verde, since it's a real geographic waypoint. ABQ stays major
   (Breaking Bad tour). OK?

3. **Crested Butte.** Currently a Day 10 activity. Major destination,
   minor stop, or drop from the map entirely (treat as a side trip
   from the Black Canyon node)?

4. **Sleep spots scope.** Should I (a) seed with the current
   trip.json sleep spots (Pacific Beach, Gila Bend, Willcox,
   Cloudcroft, Hyde Park, Mancos, Last Dollar Rd, Cement Creek,
   Cherry Creek SP, Lake McConaughy, Des Moines Walmart, South Bend
   Walmart, Allentown Walmart), (b) start with a smaller curated set
   and add candidates (2–3 options near each major destination), or
   (c) both — seed the 13, leave room for alternatives?

5. **What's "on the route" vs. "a sleep spot near the route"?**
   Cloudcroft / Hyde Park / Cement Creek are *destinations* in the
   sense that they're where we sleep, but on the V2 framing they're
   sleep spots near a route that goes through real towns. I'd treat
   the backbone as **White Sands → Santa Fe → Mancos → Telluride →
   Black Canyon → Denver** (real towns/landmarks), with
   Cloudcroft/Hyde Park/Cement Creek floating as sleep spots. Sound
   right, or do you want some of those *on* the route?

6. **Aspect ratio on mobile.** Real-coords-honest means the map is
   **much wider than tall** (SD→NYC). On mobile that means tiny
   labels OR horizontal scroll. Which? (a) full-width with horizontal
   scroll on mobile, (b) fit-to-viewport with tiny labels, (c) some
   other idea.

7. **Pan/zoom mechanics.** Phase 1 minimum: scroll wheel zooms toward
   cursor + drag pans. Do you want **pinch-zoom + double-click-to-
   zoom** in phase 1 too, or defer to phase 2?

8. **Zoom bounds.** Min = fit-to-viewport (whole route visible). Max
   = something like "Pacific Beach and Mission Bay readable as
   separate dots." OK, or do you want unbounded max zoom?

9. **Fixed-size on zoom.** RV emoji stays the same screen size as you
   zoom. Should the same apply to **dots and labels**? (My
   recommendation: yes — emojis/dots/labels fixed screen size, only
   the route geometry scales. The alternative — dots scale with zoom
   — gets ugly fast.)

10. **Minor stops in data from day 1?** Even though they're not
    rendered in phase 1, the segment hours depend on them (we need to
    know what towns the route passes through to estimate accurately).
    I'd include them in `route_nodes[]` from the start, just don't
    render them yet. OK?

11. **Segment hours: re-estimate or back-derive?** The current
    trip.json has drive hours per stop-pair. The new model needs
    hours per route-node-pair (different chain). Should I (a)
    re-estimate fresh using Google-Maps-style + RV padding, or (b)
    try to back-derive from current trip.json? (a) is cleaner and
    more accurate; (b) preserves existing pinned numbers.

12. **Snap-point storage.** Two options for how a sleep spot anchors
    to the route: (a) `{segment_id, t in [0,1]}` — interpolate along
    the straight segment, simple math; (b) `{snap_lat, snap_lon}` —
    explicit coords, more flexible if you want the snap point off the
    straight line (e.g., near a real road bend). I'd default to (a).
    OK?

13. **Detour-time units.** Hours (decimal, matches existing
    codebase) or minutes (integer)? Default: hours.

14. **Phase 1/2 cut.** Phase 1 = data + new map block + pan/zoom +
    majors with hours + 🚐 emojis at real coords. Phase 2 = minor
    stops rendered + click-to-activate + hover-highlight blue path
    with summed hours + detour-time surface. Is that the right cut,
    or do you want any phase-2 items pulled into phase 1?

15. **Where on index.html does the new map sit?** Above the day
    cards, below them, or in a dedicated section right after the hero
    photo? I'd suggest **right after the hero**, since it's now the
    primary planning tool.

16. **Coexistence confirmed.** V2 does NOT touch weather.html — old
    temp/rain maps stay as-is. Yes?

## What I can build without answers (starting now)

The data structure and a starter map can be built before Q1–Q16 are
answered, with placeholders where Andrew's input matters. Specifically:

- Define `assets/map.json` schema (locations + route_nodes + segments
  + sleep_spots with snap refs).
- Seed it with a reasonable first pass on majors/minors/sleeps based
  on the current trip.json. Mark anything Andrew might want to
  change with `confidence: "guessed"` so it's obvious what's open.
- Stub a new SVG block + render module on `index.html`.
- Implement real-aspect projection + wheel-zoom + drag-pan.
- Render majors (large dots + labels) and segments (with hour labels).
- Render sleep spots as 🚐 emoji at real coords, fixed screen size.
- Leave minor-stop rendering, click-to-activate, and blue-path
  highlighting as stubs / TODOs for phase 2.

Once Andrew answers, I'll adjust the seed data + any structural
choices that turn out wrong, then proceed to phase 2.
