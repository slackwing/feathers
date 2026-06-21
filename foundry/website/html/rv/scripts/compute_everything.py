#!/usr/bin/env python3
"""Unified data pipeline: directions + weather for the RV trip's V2 route map.

Reads:
- assets/map-sources.json (locations + route + off_route)
- assets/trip.json        (for trip start_date + total_days; sleep dates
                           are predicted by route position fraction)

Writes:
- assets/map.json           (locations + junctions + route + segments;
                             sleep locations get `night_temp_f` embedded,
                             majors get `wet_day_pct` embedded)

Content-addressed cache lives in .cache/ (gitignored). Each API call's
key is sha1 of its inputs. Re-runs only hit APIs for new or changed
inputs. Fresh clones rebuild the cache on first run.

Reads Google Maps key from ~/.config/rv-trip/google-maps-key.

Usage:
    python3 scripts/compute_everything.py
    python3 scripts/compute_everything.py --force      # ignore cache
"""

import argparse
import hashlib
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
from datetime import date, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCES = REPO_ROOT / "assets" / "map-sources.json"
TRIP = REPO_ROOT / "assets" / "trip.json"
MAP_OUT = REPO_ROOT / "assets" / "map.json"

CACHE_DIR = REPO_ROOT / ".cache"
DIRECTIONS_CACHE = CACHE_DIR / "directions"
ARCHIVE_CACHE = CACHE_DIR / "openmeteo-archive"
DIRECTIONS_CACHE.mkdir(parents=True, exist_ok=True)
ARCHIVE_CACHE.mkdir(parents=True, exist_ok=True)

KEY_PATH = Path.home() / ".config" / "rv-trip" / "google-maps-key"
JUNCTION_THRESHOLD_MI = 5.0
EARTH_RADIUS_MI = 3958.8


# ============================================================
# Helpers: geo
# ============================================================

def haversine_mi(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_MI * math.asin(math.sqrt(a))


def nearest_point_on_segment(plat, plon, a_lat, a_lon, b_lat, b_lon):
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
    return ay + dy * t, (ax + dx * t) / lon_scale, t


def nearest_point_on_polyline(plat, plon, polyline):
    best = (0.0, 0.0, 0, 0.0, float("inf"))
    for i in range(len(polyline) - 1):
        a_lat, a_lon = polyline[i]
        b_lat, b_lon = polyline[i + 1]
        q_lat, q_lon, t = nearest_point_on_segment(plat, plon, a_lat, a_lon, b_lat, b_lon)
        d = haversine_mi(plat, plon, q_lat, q_lon)
        if d < best[4]:
            best = (q_lat, q_lon, i, t, d)
    return best


# ============================================================
# Helpers: content-addressed cache
# ============================================================

def cache_key_dict(d):
    """SHA1 of a JSON-canonicalized dict. Stable across runs."""
    canon = json.dumps(d, sort_keys=True, separators=(",", ":"))
    return hashlib.sha1(canon.encode("utf-8")).hexdigest()


def cache_get(cache_dir, key):
    p = cache_dir / f"{key}.json"
    if p.exists():
        return json.loads(p.read_text())
    return None


def cache_put(cache_dir, key, value):
    p = cache_dir / f"{key}.json"
    p.write_text(json.dumps(value))


# ============================================================
# Google Directions
# ============================================================

def load_google_key():
    if not KEY_PATH.exists():
        sys.exit(f"FATAL: API key not found at {KEY_PATH}")
    return KEY_PATH.read_text().strip()


def get_directions(orig_lat, orig_lon, dest_lat, dest_lon, key, force=False):
    """Returns dict with distance_mi, duration_min, summary. Cached."""
    ck = cache_key_dict({
        "type": "google_directions",
        "orig": [round(orig_lat, 5), round(orig_lon, 5)],
        "dest": [round(dest_lat, 5), round(dest_lon, 5)],
    })
    if not force:
        hit = cache_get(DIRECTIONS_CACHE, ck)
        if hit is not None:
            return hit, True  # (result, cache_hit)

    params = {
        "origin": f"{orig_lat},{orig_lon}",
        "destination": f"{dest_lat},{dest_lon}",
        "key": key,
    }
    url = "https://maps.googleapis.com/maps/api/directions/json?" + urllib.parse.urlencode(params)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                raw = json.load(r)
            break
        except urllib.error.URLError as e:
            if attempt == 2:
                raise
            time.sleep(3)

    if raw.get("status") != "OK":
        result = {"error": raw.get("status"), "error_message": raw.get("error_message", "")}
        cache_put(DIRECTIONS_CACHE, ck, result)
        return result, False

    leg = raw["routes"][0]["legs"][0]
    result = {
        "distance_mi": leg["distance"]["value"] / 1609.344,
        "duration_min": leg["duration"]["value"] / 60.0,
        "summary": raw["routes"][0].get("summary", ""),
    }
    cache_put(DIRECTIONS_CACHE, ck, result)
    time.sleep(0.05)  # gentle on API
    return result, False


# ============================================================
# Open-Meteo archive
# ============================================================

def get_openmeteo_archive(lat, lon, force=False):
    """Returns the raw archive response (cached). 1995-2024 daily data."""
    ck = cache_key_dict({
        "type": "openmeteo_archive",
        "coord": [round(lat, 4), round(lon, 4)],
        "start": "1995-01-01",
        "end": "2024-12-31",
        "vars": ["temperature_2m_min", "precipitation_sum", "precipitation_hours"],
    })
    if not force:
        hit = cache_get(ARCHIVE_CACHE, ck)
        if hit is not None:
            return hit, True

    url = (
        "https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={lat}&longitude={lon}"
        "&start_date=1995-01-01&end_date=2024-12-31"
        "&daily=temperature_2m_min,precipitation_sum,precipitation_hours"
        "&temperature_unit=fahrenheit"
        "&precipitation_unit=inch"
        "&timezone=auto"
    )
    for attempt in range(2):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                data = json.load(r)
            break
        except urllib.error.HTTPError as e:
            if e.code == 429:
                if attempt == 0:
                    print(f"  rate-limited, sleeping 30s once...", file=sys.stderr)
                    time.sleep(30)
                    continue
                # Give up gracefully; caller treats None as "no data".
                print(f"  rate-limited, giving up (run again later)", file=sys.stderr)
                return None, False
            raise

    cache_put(ARCHIVE_CACHE, ck, data)
    time.sleep(2)
    return data, False


def climate_normal_low(archive, target_date):
    """Mean of daily min temp across all years for the same MM-DD."""
    times = archive["daily"]["time"]
    mins = archive["daily"]["temperature_2m_min"]
    mm_dd = target_date.strftime("%m-%d")
    matches = [m for m, t in zip(mins, times) if t.endswith(mm_dd) and m is not None]
    if not matches:
        return None
    return round(sum(matches) / len(matches), 1)


def rain_stats(archive, target_date, window_days=3):
    times = archive["daily"]["time"]
    precs = archive["daily"]["precipitation_sum"]
    hours = archive["daily"]["precipitation_hours"]
    by_date = {t: (p, h) for t, p, h in zip(times, precs, hours)}
    wet, tot, total_p, total_h = 0, 0, 0.0, 0.0
    for year in range(1995, 2025):
        try:
            yd = date(year, target_date.month, target_date.day)
        except ValueError:
            continue
        for offset in range(-window_days, window_days + 1):
            d = yd + timedelta(days=offset)
            k = d.isoformat()
            if k in by_date:
                p, h = by_date[k]
                if p is None:
                    continue
                tot += 1
                total_p += p
                if h is not None:
                    total_h += h
                if p >= 0.1:
                    wet += 1
    if tot == 0:
        return None
    return {
        "wet_day_pct": round(100 * wet / tot, 1),
        "avg_daily_precip_in": round(total_p / tot, 3),
        "avg_daily_precip_hr": round(total_h / tot, 2),
    }


# ============================================================
# RV padding
# ============================================================

def is_mountain_summary(summary):
    s = (summary or "").lower()
    mtns = ["us-550", "us-160", "co-145", "co-92", "co-135", "us-50",
            "us-285", "us-70", "us-82", "us-54", "nm-475", "nm-130", "co-114"]
    return any(k in s for k in mtns)


def rv_pad(duration_min, summary):
    return duration_min * (1.25 if is_mountain_summary(summary) else 1.10)


# ============================================================
# Build map.json (route + junctions + segments + sleep temps)
# ============================================================

def build_map(sources, key, force, trip_start_date, trip_total_days):
    """Build map.json.

    Each sleep location gets a `night_temp_f` and `night_date`.
    Each major location gets a `wet_day_pct` and `predicted_date`.
    Dates are assigned by route position: a location at X% along the
    total route minutes (including spurs for off-route) → trip date
    at X% of (trip_total_days - 1) from start.
    """
    locations = {loc["id"]: loc for loc in sources["locations"]}
    route_ids = sources["route"]
    off_route_ids = sources["off_route"]

    for rid in route_ids:
        if rid not in locations:
            sys.exit(f"FATAL: route id {rid!r} not in locations")
    for orid in off_route_ids:
        if orid not in locations:
            sys.exit(f"FATAL: off_route id {orid!r} not in locations")

    polyline = [(locations[rid]["lat"], locations[rid]["lon"]) for rid in route_ids]

    # Junctions for off-route locations.
    junctions = []
    junction_insertions = []  # (seg_idx, t, junction_id)
    for orid in off_route_ids:
        loc = locations[orid]
        q_lat, q_lon, seg_idx, t, dist_mi = nearest_point_on_polyline(
            loc["lat"], loc["lon"], polyline
        )
        is_sleep = loc.get("kind") == "sleep"
        needs_junction = dist_mi > JUNCTION_THRESHOLD_MI or is_sleep
        if needs_junction:
            jid = f"j_{orid}"
            junctions.append({
                "id": jid,
                "lat": round(q_lat, 6),
                "lon": round(q_lon, 6),
                "for_location": orid,
                "off_route_distance_mi": round(dist_mi, 2),
            })
            junction_insertions.append((seg_idx, t, jid))

    junction_insertions.sort(key=lambda x: (x[0], x[1]))
    new_route = []
    insertion_idx = 0
    for i, rid in enumerate(route_ids):
        new_route.append(rid)
        while insertion_idx < len(junction_insertions) and junction_insertions[insertion_idx][0] == i:
            new_route.append(junction_insertions[insertion_idx][2])
            insertion_idx += 1

    def coord_of(node_id):
        if node_id in locations:
            return locations[node_id]["lat"], locations[node_id]["lon"]
        for j in junctions:
            if j["id"] == node_id:
                return j["lat"], j["lon"]
        sys.exit(f"FATAL: no coords for {node_id}")

    # Compute main-route segments.
    segments = []
    n_hits, n_misses = 0, 0
    print(f"\n[DIRECTIONS] {len(new_route) - 1} main-route + {len(junctions)} spurs", file=sys.stderr)
    for i in range(len(new_route) - 1):
        a, b = new_route[i], new_route[i + 1]
        a_lat, a_lon = coord_of(a)
        b_lat, b_lon = coord_of(b)
        if haversine_mi(a_lat, a_lon, b_lat, b_lon) < 0.05:
            segments.append({"from": a, "to": b, "minutes": 0, "distance_mi": 0, "summary": "(coincident)"})
            continue
        res, hit = get_directions(a_lat, a_lon, b_lat, b_lon, key, force)
        if hit:
            n_hits += 1
        else:
            n_misses += 1
        if "error" in res:
            print(f"  ERROR {a} -> {b}: {res['error']}", file=sys.stderr)
            segments.append({"from": a, "to": b, "minutes": None, "error": res["error"]})
            continue
        padded = rv_pad(res["duration_min"], res["summary"])
        segments.append({
            "from": a, "to": b,
            "minutes": round(padded, 1),
            "raw_minutes": round(res["duration_min"], 1),
            "distance_mi": round(res["distance_mi"], 1),
            "summary": res["summary"],
        })

    for j in junctions:
        orid = j["for_location"]
        loc = locations[orid]
        if haversine_mi(j["lat"], j["lon"], loc["lat"], loc["lon"]) < 0.05:
            segments.append({"from": j["id"], "to": orid, "minutes": 0, "distance_mi": 0, "summary": "(coincident)"})
            continue
        res, hit = get_directions(j["lat"], j["lon"], loc["lat"], loc["lon"], key, force)
        if hit:
            n_hits += 1
        else:
            n_misses += 1
        if "error" in res:
            print(f"  ERROR spur {j['id']} -> {orid}: {res['error']}", file=sys.stderr)
            segments.append({"from": j["id"], "to": orid, "minutes": None, "error": res["error"]})
            continue
        padded = rv_pad(res["duration_min"], res["summary"])
        segments.append({
            "from": j["id"], "to": orid,
            "minutes": round(padded, 1),
            "raw_minutes": round(res["duration_min"], 1),
            "distance_mi": round(res["distance_mi"], 1),
            "summary": res["summary"],
        })

    print(f"  cache: {n_hits} hits, {n_misses} new fetches", file=sys.stderr)

    # ----- Compute fractional position along the route for each node -----
    # Total = sum of main-route segment minutes (NOT including spurs).
    seg_map = {(s["from"], s["to"]): s for s in segments}
    cumulative_min_at = {}  # node_id -> cumulative minutes from route[0]
    cumulative = 0.0
    cumulative_min_at[new_route[0]] = 0.0
    for i in range(len(new_route) - 1):
        a, b = new_route[i], new_route[i + 1]
        seg = seg_map.get((a, b))
        if seg and seg.get("minutes") is not None:
            cumulative += seg["minutes"]
        cumulative_min_at[b] = cumulative
    total_route_min = cumulative

    # For an off-route location, fraction = its junction's fraction.
    junction_for = {j["for_location"]: j["id"] for j in junctions}

    def fraction_for_location(loc_id):
        if loc_id in cumulative_min_at:
            return cumulative_min_at[loc_id] / total_route_min if total_route_min else 0
        # Off-route: use its junction.
        if loc_id in junction_for:
            jid = junction_for[loc_id]
            return cumulative_min_at[jid] / total_route_min if total_route_min else 0
        return None

    def date_for_fraction(frac):
        # Distribute across trip_total_days (inclusive both ends).
        offset_days = round(frac * (trip_total_days - 1))
        return trip_start_date + timedelta(days=offset_days)

    # ----- Sleep night temps (% position based) -----
    locations_out = []
    sleep_n_hits, sleep_n_misses = 0, 0
    major_n_hits, major_n_misses = 0, 0
    print(f"\n[WEATHER for sleep spots — by route position]", file=sys.stderr)
    for loc in sources["locations"]:
        loc_copy = dict(loc)
        frac = fraction_for_location(loc["id"])
        if loc.get("kind") == "sleep" and frac is not None:
            d = date_for_fraction(frac)
            archive, hit = get_openmeteo_archive(loc["lat"], loc["lon"], force)
            loc_copy["route_fraction"] = round(frac, 3)
            loc_copy["predicted_date"] = d.isoformat()
            if archive is None:
                loc_copy["night_temp_f"] = None
                print(f"  sleep  {loc['name']:<40}  frac={frac:.2f}  {d}  RATE-LIMITED", file=sys.stderr)
            else:
                if hit:
                    sleep_n_hits += 1
                else:
                    sleep_n_misses += 1
                temp = climate_normal_low(archive, d)
                loc_copy["night_temp_f"] = temp
                print(f"  sleep  {loc['name']:<40}  frac={frac:.2f}  {d}  {temp}°F  {'(cache)' if hit else '(fetched)'}", file=sys.stderr)
        elif loc.get("kind") == "major" and frac is not None:
            d = date_for_fraction(frac)
            archive, hit = get_openmeteo_archive(loc["lat"], loc["lon"], force)
            loc_copy["route_fraction"] = round(frac, 3)
            loc_copy["predicted_date"] = d.isoformat()
            if archive is None:
                loc_copy["wet_day_pct"] = None
                print(f"  major  {loc['name']:<40}  frac={frac:.2f}  {d}  RATE-LIMITED", file=sys.stderr)
            else:
                if hit:
                    major_n_hits += 1
                else:
                    major_n_misses += 1
                rain = rain_stats(archive, d)
                wet_pct = rain["wet_day_pct"] if rain else None
                loc_copy["wet_day_pct"] = wet_pct
                print(f"  major  {loc['name']:<40}  frac={frac:.2f}  {d}  {wet_pct}%   {'(cache)' if hit else '(fetched)'}", file=sys.stderr)
        locations_out.append(loc_copy)

    print(f"  sleep cache: {sleep_n_hits} hits, {sleep_n_misses} new", file=sys.stderr)
    print(f"  major cache: {major_n_hits} hits, {major_n_misses} new", file=sys.stderr)

    return {
        "_comment": "Generated by scripts/compute_everything.py. Do not hand-edit; edit assets/map-sources.json or trip.json and re-run.",
        "version": 2,
        "trip_start_date": trip_start_date.isoformat(),
        "trip_total_days": trip_total_days,
        "total_route_minutes": round(total_route_min, 1),
        "locations": locations_out,
        "junctions": junctions,
        "route": new_route,
        "segments": segments,
    }


# ============================================================
# Main
# ============================================================

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="Ignore cache; re-fetch everything.")
    args = ap.parse_args()

    sources = json.loads(SOURCES.read_text())
    trip = json.loads(TRIP.read_text())
    key = load_google_key()

    # Trip date range from trip.json: start + sum of active stops' nights.
    start = date.fromisoformat(trip["start_dates"]["early"])
    total_days = sum(s["nights"] for s in trip["stops"] if not s.get("dropped_at"))
    print(f"Trip: {start} + {total_days} days", file=sys.stderr)

    map_out = build_map(sources, key, args.force, start, total_days)
    MAP_OUT.write_text(json.dumps(map_out, indent=2))
    print(f"\nWrote {MAP_OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
