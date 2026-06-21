# Route Map V2 — Mechanics

Authoritative description of how the V2 route map's data model works.
Render and editing logic should match this exactly.

## The mental model

**Backbone:** a chain of dots from San Diego → New York, connected by
straight line segments. Some dots are **majors** (large, labeled —
the cities we're driving toward). Some dots are **minors** (small,
small-grey-italic labels — towns we pass through or near).

**Off-route spots:** sleep spots (🚐), and minors that are far enough
off the main route to look wrong if forced onto the line. They live
at their **real geographic coordinates** and are connected to the
main route by an unlabeled side-spur line.

**Junctions:** for any spot more than **5 miles** from the nearest
point on the main route line, we insert an invisible **junction**
node directly on the main route line. The spot connects to the
junction with a side-spur. The junction has no visible dot or label
— but it's a real node in the route graph, so all time-distance
math (sum of hours from any point to any other point) flows through
it cleanly.

For spots within 5 miles of the line, no junction needed — they sit
directly on the line.

## The data shape

`assets/map.json`:

```jsonc
{
  "version": 2,
  "locations": [
    // One entry per real-world place we care about.
    // `kind` is what the place IS in the world.
    {
      "id": "tucson",
      "kind": "major",          // major | minor | sleep
      "name": "Tucson",
      "lat": 32.2226, "lon": -110.9747,
      "confidence": "vetted"
    },
    {
      "id": "yuma",
      "kind": "minor",
      "name": "Yuma",
      "lat": 32.6927, "lon": -114.6277
    },
    {
      "id": "cement_creek",
      "kind": "sleep",
      "name": "Cement Creek Rd",
      "lat": 38.81, "lon": -106.85,
      "sleep_type": "free_dispersed"
    }
    // ...
  ],

  "junctions": [
    // Invisible nodes ON the main route line, used to anchor
    // off-route locations. Auto-generated at build time for any
    // location > 5 mi from the nearest main route point.
    {
      "id": "j_cement_creek",
      "lat": 38.55, "lon": -106.92,   // computed: nearest point on main line
      "for_location": "cement_creek"
    }
    // ...
  ],

  "route": [
    // The MAIN ROUTE, in order from start to end. Each entry is
    // either a location id or a junction id. The line is drawn
    // by connecting consecutive entries with straight segments.
    "san_diego",
    "yuma",
    "gila_bend",
    "tucson",
    // ...
    "j_cement_creek",   // junction for the Cement Creek RV spot
    // ...
    "new_york"
  ],

  "segments": [
    // One per pair of consecutive `route[]` entries PLUS one per
    // off-route spur. Stores the drive time computed by the maps
    // API. Direction matters per Andrew's Q11 ruling: stored time
    // is the "to" direction (going to the off-route spot, not
    // coming back).
    { "from": "san_diego", "to": "yuma",        "minutes": 175 },
    { "from": "yuma",      "to": "gila_bend",   "minutes": 140 },
    // ...
    // Spur from junction out to the off-route spot:
    { "from": "j_cement_creek", "to": "cement_creek", "minutes": 30 }
    // ...
  ]
}
```

### Why this shape

- **One `locations` array** for all real places. Their `kind` says
  what they ARE; the route logic figures out how to connect them.
- **`junctions` are explicit** and live in their own array. They're
  not in `locations` because they're not real places. They appear in
  `route[]` between the surrounding main-route entries.
- **`route[]` is just an ordered list of ids.** This is the
  authoritative "what does the line draw through" answer. Reordering
  the trip = reorder this array.
- **`segments[]` stores time per edge.** Symmetric for main-route
  segments (real road both ways). Asymmetric is allowed: we only
  store the `from→to` direction; Andrew's Q11 says spurs use the
  `to` direction (going off-route to the spot).

### Junctions vs. on-line minors

A minor that's within 5 miles of the route doesn't need a junction.
Just include it directly in `route[]`. The line will pass through it.
Visually it looks the same; structurally it's simpler.

A minor that's >5 miles off-route gets:
- Itself in `locations` with `kind: "minor"`.
- An auto-generated junction in `junctions` at the nearest point on
  the main route line.
- The junction id in `route[]` between the surrounding nodes.
- A spur segment from junction → minor in `segments[]`.

A sleep spot (`kind: "sleep"`) always gets a junction — even if it's
right on the line, conceptually it's "off-itinerary" and we want the
🚐 to be visually distinguished, not blend into the line as a dot.
(Implementation note: if straight-line distance < 5 mi, the junction
coords equal the sleep spot coords, and the spur segment is 0
minutes. Still a junction in the data model.)

## Render rules

**Main route line:** polyline through every entry in `route[]`,
including junctions. Junctions add no visible kink because they're
positioned on the line that the surrounding nodes already define.

**Spurs:** thin straight line from junction to off-route location.
Same stroke as main route but maybe lighter / dashed.

**Dot sizes:**
- Major: large dot (current: r=5.5, green `#2f8a6e`), label in
  bold next to it.
- Minor: small dot (TBD: r=3, grey), italic small grey label.
- Junction: **no visible dot**, no label.
- Sleep: no dot — the 🚐 emoji is the marker, at the location's real
  (lat, lon), fixed screen size on zoom.

**Hour labels:**
- One label per **major-to-major leg**, placed at the midpoint of
  the straight line between consecutive majors in `route[]`. The
  number is the sum of `segments[].minutes` for every segment on the
  path between the two majors (including spurs? **no — spurs are
  side trips, not part of the through-route time**). Format: under
  60 min → `"45m"`, otherwise `"1h10m"` or `"3h"`.

## Time-distance math (phase 2: click-to-activate)

When the user clicks any location (major, minor, or 🚐) to activate
it, then hovers another location, the blue-highlighted path and time
sum work like this:

1. Find the **junction** for each endpoint (if a major/minor is
   already in `route[]`, the location id IS the route-side node;
   otherwise use its junction). Sleep spots always have a junction.
2. Find the segments along the `route[]` chain between the two
   junctions; sum their minutes.
3. Add the spur segment time for each endpoint that's off-route
   (junction → off-route location, in the "to" direction per Q11).
4. Format the total as `"1h45m"` etc.

This works for any pair: sleep↔sleep, sleep↔major, major↔major, etc.
The junction layer makes the graph uniform.

## Build process

When we add/edit/remove a location, a Python script (TBD:
`scripts/build_map.py`) does:

1. For each off-route location (any location where straight-line
   distance to nearest main-route point > 5 mi), compute the nearest
   point on the line and emit a junction.
2. For every adjacent pair in `route[]`, call Google Directions API
   to get the drive time. Apply RV padding (mountain segments +20–
   25%; interstate +10%).
3. For every spur (junction → off-route location), same: Google
   Directions, "to" direction, RV-padded.
4. Cache responses (keyed by lat/lon pair) so re-runs are free.
5. Write the new `map.json`.

Andrew runs this whenever the route or spots change. The web app is
pure-static — it just reads `map.json`.

## Open items / future

- **Asymmetric spur times**: currently we only store `to` direction.
  Q11 says that's fine for now (Google Maps live nav handles the
  return path). If we ever want both, add a second segment entry.
- **Crested Butte etc.**: these get junctions automatically by the
  5-mile rule (CB is ~25 mi off the BC→Denver line).
- **Minor stops within San Diego, Tucson, etc.**: per Q4/Q10, none
  yet. Only added once we're on the road.
