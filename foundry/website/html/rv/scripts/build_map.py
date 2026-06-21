#!/usr/bin/env python3
"""Build assets/map.json from assets/map-sources.json.

Reads:
- assets/map-sources.json (hand-edited: locations + route + off_route)
- ~/.config/rv-trip/google-maps-key (API key, NEVER in the repo)

Writes:
- assets/map.json (route + junctions + segments with Google-derived
  drive times, RV-padded)

Caches all Google Directions responses in /tmp/rv-directions-cache/
so re-runs are free.

See MAP_V2_MECHANICS.md for the data model.
"""

import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCES = REPO_ROOT / "assets" / "map-sources.json"
OUT = REPO_ROOT / "assets" / "map.json"
KEY_PATH = Path.home() / ".config" / "rv-trip" / "google-maps-key"
CACHE_DIR = Path("/tmp/rv-directions-cache")
CACHE_DIR.mkdir(exist_ok=True)

JUNCTION_THRESHOLD_MI = 5.0


# ---------- geo helpers ----------

EARTH_RADIUS_MI = 3958.8

def haversine_mi(lat1, lon1, lat2, lon2):
    """Great-circle distance in miles between two lat/lon points."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_MI * math.asin(math.sqrt(a))


def nearest_point_on_segment(plat, plon, a_lat, a_lon, b_lat, b_lon):
    """Return (lat, lon, t) of the nearest point on segment AB to P.

    Uses a flat-earth approximation (good enough since segments are
    ~hundreds of miles and we just need 'nearest'). t in [0, 1] is the
    fractional position along AB.
    """
    # Project to local-flat coords (km-ish) centered on segment midpoint.
    mid_lat = (a_lat + b_lat) / 2
    lon_scale = math.cos(math.radians(mid_lat))
    ax, ay = a_lon * lon_scale, a_lat
    bx, by = b_lon * lon_scale, b_lat
    px, py = plon * lon_scale, plat
    dx, dy = bx - ax, by - ay
    len_sq = dx * dx + dy * dy
    if len_sq == 0:
        return a_lat, a_lon, 0.0
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / len_sq))
    qx, qy = ax + dx * t, ay + dy * t
    return qy, qx / lon_scale, t


def nearest_point_on_polyline(plat, plon, polyline):
    """Find the nearest point on the route polyline to P.

    polyline: list of (lat, lon) tuples in order.
    Returns (lat, lon, seg_index, t, distance_mi).
    """
    best = (0.0, 0.0, 0, 0.0, float("inf"))
    for i in range(len(polyline) - 1):
        a_lat, a_lon = polyline[i]
        b_lat, b_lon = polyline[i + 1]
        q_lat, q_lon, t = nearest_point_on_segment(plat, plon, a_lat, a_lon, b_lat, b_lon)
        d = haversine_mi(plat, plon, q_lat, q_lon)
        if d < best[4]:
            best = (q_lat, q_lon, i, t, d)
    return best


# ---------- API ----------

def load_key():
    if not KEY_PATH.exists():
        sys.exit(f"FATAL: API key not found at {KEY_PATH}")
    return KEY_PATH.read_text().strip()


def fetch_directions(orig_lat, orig_lon, dest_lat, dest_lon, key):
    """Call Google Directions; return (distance_mi, duration_min, summary)."""
    cache_key = f"{orig_lat:.5f}_{orig_lon:.5f}__{dest_lat:.5f}_{dest_lon:.5f}".replace(".", "p").replace("-", "n")
    cache_path = CACHE_DIR / f"{cache_key}.json"
    if cache_path.exists():
        data = json.loads(cache_path.read_text())
    else:
        params = {
            "origin": f"{orig_lat},{orig_lon}",
            "destination": f"{dest_lat},{dest_lon}",
            "key": key,
        }
        url = "https://maps.googleapis.com/maps/api/directions/json?" + urllib.parse.urlencode(params)
        for attempt in range(3):
            try:
                with urllib.request.urlopen(url, timeout=30) as r:
                    data = json.load(r)
                break
            except urllib.error.URLError as e:
                if attempt == 2:
                    raise
                print(f"  retry {attempt + 1} after {e}", file=sys.stderr)
                time.sleep(5)
        cache_path.write_text(json.dumps(data))
        time.sleep(0.05)  # gentle on the API

    if data.get("status") != "OK":
        raise RuntimeError(f"Directions API: {data.get('status')} {data.get('error_message', '')}")
    leg = data["routes"][0]["legs"][0]
    distance_mi = leg["distance"]["value"] / 1609.344
    duration_min = leg["duration"]["value"] / 60.0
    summary = data["routes"][0].get("summary", "")
    return distance_mi, duration_min, summary


# ---------- RV padding ----------

def is_mountain_summary(summary):
    """Heuristic: does the route summary smell like mountains?"""
    s = summary.lower()
    mountain_keys = ["us-550", "us-160", "co-145", "co-92", "co-135", "us-50", "us-285",
                     "us-70", "us-82", "us-54", "nm-475", "nm-130", "co-114"]
    return any(k in s for k in mountain_keys)


def rv_pad(duration_min, summary):
    """Apply RV padding: mountain segments +25%, interstate-only +10%."""
    if is_mountain_summary(summary):
        return duration_min * 1.25
    return duration_min * 1.10


# ---------- Build ----------

def main():
    src = json.loads(SOURCES.read_text())
    key = load_key()

    locations = {loc["id"]: loc for loc in src["locations"]}
    route_ids = src["route"]
    off_route_ids = src["off_route"]

    # Sanity checks
    for rid in route_ids:
        if rid not in locations:
            sys.exit(f"FATAL: route id {rid!r} not in locations")
    for orid in off_route_ids:
        if orid not in locations:
            sys.exit(f"FATAL: off_route id {orid!r} not in locations")

    # Main route polyline (lat, lon) from route[].
    polyline = [(locations[rid]["lat"], locations[rid]["lon"]) for rid in route_ids]

    # Determine junctions for off-route locations.
    junctions = []
    junction_for = {}   # off_route_id -> junction_id
    route_segments = list(route_ids)  # mutable; we'll insert junctions in order

    # Per off-route location: find nearest point on polyline, decide if
    # we need a junction (>5 mi). Sleep spots ALWAYS get a junction.
    junction_insertions = []  # (seg_index, t, junction_id, junction_lat, junction_lon)
    for orid in off_route_ids:
        loc = locations[orid]
        q_lat, q_lon, seg_idx, t, dist_mi = nearest_point_on_polyline(loc["lat"], loc["lon"], polyline)
        is_sleep = loc.get("kind") == "sleep"
        needs_junction = dist_mi > JUNCTION_THRESHOLD_MI or is_sleep

        if needs_junction:
            jid = f"j_{orid}"
            # If within threshold (sleep on or near the line), still make a
            # junction but place it AT the nearest point on the line. The
            # spur will be very short.
            junctions.append({
                "id": jid,
                "lat": round(q_lat, 6),
                "lon": round(q_lon, 6),
                "for_location": orid,
                "off_route_distance_mi": round(dist_mi, 2),
            })
            junction_for[orid] = jid
            junction_insertions.append((seg_idx, t, jid))
        else:
            # Within threshold, NOT a sleep spot, NOT in route[] — surface
            # it directly on the line. But per current sources, all such
            # cases are already in route[] (or sleeps which always get
            # junctions). This branch is reserved for future use.
            print(f"  (note) {orid} within {JUNCTION_THRESHOLD_MI} mi of line, no junction (not implemented for non-sleeps)", file=sys.stderr)

    # Insert junctions into route order. Sort insertions by (seg_idx, t) so
    # they go in the right spots, and insert from end to start to preserve
    # indices.
    junction_insertions.sort(key=lambda x: (x[0], x[1]))
    # Re-build route with junctions interleaved.
    new_route = []
    insertion_idx = 0
    for i, rid in enumerate(route_ids):
        new_route.append(rid)
        # If any junctions belong on segment i (between route[i] and route[i+1]),
        # insert them in order of t.
        while insertion_idx < len(junction_insertions) and junction_insertions[insertion_idx][0] == i:
            new_route.append(junction_insertions[insertion_idx][2])
            insertion_idx += 1
    if insertion_idx != len(junction_insertions):
        sys.exit(f"FATAL: leftover junction insertions: {junction_insertions[insertion_idx:]}")

    # Build coord lookup that knows about junctions too.
    def coord_of(node_id):
        if node_id in locations:
            return locations[node_id]["lat"], locations[node_id]["lon"]
        for j in junctions:
            if j["id"] == node_id:
                return j["lat"], j["lon"]
        sys.exit(f"FATAL: no coords for {node_id}")

    # Compute segments: consecutive route entries.
    segments = []
    print(f"\nFetching Directions API for {len(new_route) - 1} main-route segments...", file=sys.stderr)
    for i in range(len(new_route) - 1):
        a, b = new_route[i], new_route[i + 1]
        a_lat, a_lon = coord_of(a)
        b_lat, b_lon = coord_of(b)
        # If both endpoints are essentially the same point (junction near a
        # route node), skip the API call.
        if haversine_mi(a_lat, a_lon, b_lat, b_lon) < 0.05:
            segments.append({"from": a, "to": b, "minutes": 0, "distance_mi": 0, "summary": "(coincident)"})
            print(f"  {a} -> {b}: coincident, 0 min", file=sys.stderr)
            continue
        try:
            dist, dur, summary = fetch_directions(a_lat, a_lon, b_lat, b_lon, key)
            padded = rv_pad(dur, summary)
            segments.append({
                "from": a,
                "to": b,
                "minutes": round(padded, 1),
                "raw_minutes": round(dur, 1),
                "distance_mi": round(dist, 1),
                "summary": summary,
            })
            print(f"  {a} -> {b}: {dist:.0f}mi {dur:.0f}min raw -> {padded:.0f}min RV ({summary})", file=sys.stderr)
        except Exception as e:
            print(f"  ERROR {a} -> {b}: {e}", file=sys.stderr)
            segments.append({"from": a, "to": b, "minutes": None, "error": str(e)})

    # Spurs: from each junction to its off-route location.
    print(f"\nFetching Directions API for {len(junctions)} spurs...", file=sys.stderr)
    for j in junctions:
        orid = j["for_location"]
        loc = locations[orid]
        if haversine_mi(j["lat"], j["lon"], loc["lat"], loc["lon"]) < 0.05:
            segments.append({"from": j["id"], "to": orid, "minutes": 0, "distance_mi": 0, "summary": "(coincident)"})
            print(f"  {j['id']} -> {orid}: coincident, 0 min", file=sys.stderr)
            continue
        try:
            dist, dur, summary = fetch_directions(j["lat"], j["lon"], loc["lat"], loc["lon"], key)
            padded = rv_pad(dur, summary)
            segments.append({
                "from": j["id"],
                "to": orid,
                "minutes": round(padded, 1),
                "raw_minutes": round(dur, 1),
                "distance_mi": round(dist, 1),
                "summary": summary,
            })
            print(f"  {j['id']} -> {orid}: {dist:.1f}mi {dur:.0f}min raw -> {padded:.0f}min RV", file=sys.stderr)
        except Exception as e:
            print(f"  ERROR {j['id']} -> {orid}: {e}", file=sys.stderr)
            segments.append({"from": j["id"], "to": orid, "minutes": None, "error": str(e)})

    # Write map.json
    out = {
        "_comment": "Generated by scripts/build_map.py from assets/map-sources.json. Do not hand-edit; edit the sources and re-run.",
        "version": 2,
        "locations": src["locations"],
        "junctions": junctions,
        "route": new_route,
        "segments": segments,
    }
    OUT.write_text(json.dumps(out, indent=2))
    print(f"\nWrote {OUT}", file=sys.stderr)
    print(f"  {len(new_route)} route entries ({len(route_ids)} original + {len(junctions)} junctions)", file=sys.stderr)
    print(f"  {len(segments)} segments", file=sys.stderr)


if __name__ == "__main__":
    main()
