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
FORECAST_CACHE = CACHE_DIR / "openmeteo-forecast"
DIRECTIONS_CACHE.mkdir(parents=True, exist_ok=True)
ARCHIVE_CACHE.mkdir(parents=True, exist_ok=True)
FORECAST_CACHE.mkdir(parents=True, exist_ok=True)

# Forecast window — Open-Meteo's forecast endpoint reliably covers ~16
# days; we use 10 to leave headroom and only overlay forecast on the
# historical average when we're actually close enough for the forecast
# to be meaningful.
FORECAST_WINDOW_DAYS = 10

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
        # Only cache DETERMINISTIC failures (the route genuinely doesn't
        # exist). Transient statuses (OVER_QUERY_LIMIT, UNKNOWN_ERROR,
        # REQUEST_DENIED, ...) must NOT be cached — one bad run used to
        # poison the cache and every later run returned the error as a
        # "hit" until --force re-fetched everything.
        if raw.get("status") in ("ZERO_RESULTS", "NOT_FOUND"):
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


# ============================================================
# Open-Meteo forecast (near-term overlay)
# ============================================================

def get_openmeteo_forecast(lat, lon, force=False, today=None):
    """Returns forecast response with daily temperature_2m_min and
    precipitation_probability_max for the next 16 days. Cache key
    includes today's date so we get fresh data each day. Returns
    (data, cache_hit) or (None, False) on error."""
    if today is None:
        today = date.today()
    ck = cache_key_dict({
        "type": "openmeteo_forecast",
        "coord": [round(lat, 4), round(lon, 4)],
        "run_date": today.isoformat(),
        "vars": ["temperature_2m_min", "precipitation_probability_max"],
    })
    if not force:
        hit = cache_get(FORECAST_CACHE, ck)
        if hit is not None:
            return hit, True

    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        "&daily=temperature_2m_min,precipitation_probability_max"
        "&temperature_unit=fahrenheit"
        "&forecast_days=16"
        "&timezone=auto"
    )
    for attempt in range(2):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                data = json.load(r)
            break
        except urllib.error.HTTPError as e:
            if e.code == 429:
                if attempt == 0:
                    print(f"  rate-limited (forecast), sleeping 30s once...", file=sys.stderr)
                    time.sleep(30)
                    continue
                print(f"  rate-limited (forecast), giving up", file=sys.stderr)
                return None, False
            raise
        except Exception as e:
            print(f"  forecast error: {e}", file=sys.stderr)
            return None, False

    cache_put(FORECAST_CACHE, ck, data)
    time.sleep(1)
    return data, False


def forecast_low_for_date(forecast, target_date):
    """Look up the min temp for target_date in the forecast response.
    Returns None if the date isn't in the response window."""
    if not forecast:
        return None
    times = forecast.get("daily", {}).get("time", [])
    mins = forecast.get("daily", {}).get("temperature_2m_min", [])
    key = target_date.isoformat()
    for t, m in zip(times, mins):
        if t == key and m is not None:
            return round(m, 1)
    return None


def forecast_rain_pct_for_date(forecast, target_date):
    """Look up the daily max precipitation probability for target_date.
    Returns None if the date isn't in the response window."""
    if not forecast:
        return None
    times = forecast.get("daily", {}).get("time", [])
    probs = forecast.get("daily", {}).get("precipitation_probability_max", [])
    key = target_date.isoformat()
    for t, p in zip(times, probs):
        if t == key and p is not None:
            return round(p, 1)
    return None


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


# RV padding factors are NOT applied at compute time. We store the raw
# Google duration + an `is_mountain` flag and let the renderer multiply
# at display time. Source of truth stays close to the API; the heuristic
# is reversible and tunable without re-fetching.
RV_PAD_INTERSTATE = 1.10
RV_PAD_MOUNTAIN = 1.25


# ============================================================
# Build map.json (route + junctions + segments + sleep temps)
# ============================================================

def build_map(sources, key, force, trip_start_date, trip_total_days):
    """Build map.json (v3 architecture).

    DATA MODEL:
      route[]   — hand-crafted highway polyline node ids (majors + minor anchors).
                  This is the spine; NO auto-injected junctions.
      segments[] — Google-direct drive segments between adjacent route[] nodes.
      pois[]    — off-route locations (sleeps, drive-by minors, detour-majors).
                  Each POI has anchor (= nearest route node id) + spur to the
                  POI's true coords. Day-walks pay spur cost ONLY on days that
                  start/end at that POI (or visit it as a detour).

    Each sleep location also gets a `night_temp_f` and `predicted_date`.
    Each major gets `wet_day_pct` and `predicted_date`. Dates are assigned
    by route-fraction (cumulative raw minutes to that POI's anchor).
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

    # ----- Main-route segments (between adjacent route[] nodes) -----
    def coord_of(node_id):
        return locations[node_id]["lat"], locations[node_id]["lon"]

    segments = []
    n_hits, n_misses = 0, 0
    print(f"\n[DIRECTIONS] {len(route_ids) - 1} main-route segments", file=sys.stderr)
    for i in range(len(route_ids) - 1):
        a, b = route_ids[i], route_ids[i + 1]
        a_lat, a_lon = coord_of(a)
        b_lat, b_lon = coord_of(b)
        if haversine_mi(a_lat, a_lon, b_lat, b_lon) < 0.05:
            segments.append({"from": a, "to": b, "raw_minutes": 0, "distance_mi": 0, "summary": "(coincident)", "is_mountain": False})
            continue
        res, hit = get_directions(a_lat, a_lon, b_lat, b_lon, key, force)
        if hit:
            n_hits += 1
        else:
            n_misses += 1
        if "error" in res:
            print(f"  ERROR {a} -> {b}: {res['error']}", file=sys.stderr)
            segments.append({"from": a, "to": b, "raw_minutes": None, "error": res["error"]})
            continue
        segments.append({
            "from": a, "to": b,
            "raw_minutes": round(res["duration_min"], 1),
            "distance_mi": round(res["distance_mi"], 1),
            "summary": res["summary"],
            "is_mountain": is_mountain_summary(res["summary"]),
        })

    # ----- Compute cumulative position along the route (raw minutes) -----
    seg_map = {(s["from"], s["to"]): s for s in segments}
    cumulative_min_at = {}  # node_id -> cumulative raw minutes from route[0]
    cumulative = 0.0
    cumulative_min_at[route_ids[0]] = 0.0
    for i in range(len(route_ids) - 1):
        a, b = route_ids[i], route_ids[i + 1]
        seg = seg_map.get((a, b))
        if seg and seg.get("raw_minutes") is not None:
            cumulative += seg["raw_minutes"]
        cumulative_min_at[b] = cumulative
    total_route_min = cumulative

    # ----- POIs: anchor (nearest route node) + spur -----
    # For each off-route location, find the nearest route_ids node (by
    # great-circle distance), then ask Google for the spur drive time
    # from that anchor's true coords to the POI's true coords.
    def nearest_route_node(poi_lat, poi_lon):
        best_id = None
        best_d = float("inf")
        for rid in route_ids:
            r_lat, r_lon = coord_of(rid)
            d = haversine_mi(poi_lat, poi_lon, r_lat, r_lon)
            if d < best_d:
                best_d = d
                best_id = rid
        return best_id, best_d

    pois = []
    print(f"\n[POIS] {len(off_route_ids)} POI spurs", file=sys.stderr)
    for orid in off_route_ids:
        loc = locations[orid]
        # Allow the catalog to PIN the anchor explicitly (e.g. when the
        # nearest-by-haversine isn't the right "drive from" point).
        # Distance is still recomputed from the pinned anchor's coords.
        forced = loc.get("anchor_override")
        if forced and forced in route_ids:
            f_lat, f_lon = coord_of(forced)
            anchor_id = forced
            anchor_dist = haversine_mi(loc["lat"], loc["lon"], f_lat, f_lon)
        else:
            anchor_id, anchor_dist = nearest_route_node(loc["lat"], loc["lon"])
        a_lat, a_lon = coord_of(anchor_id)
        spur_entry = {
            "id": orid,
            "anchor": anchor_id,
            "anchor_distance_mi": round(anchor_dist, 2),
            "kind": loc.get("kind", "sleep"),
        }
        if haversine_mi(a_lat, a_lon, loc["lat"], loc["lon"]) < 0.05:
            spur_entry["spur_raw_minutes"] = 0
            spur_entry["spur_distance_mi"] = 0
            spur_entry["spur_summary"] = "(coincident)"
            spur_entry["spur_is_mountain"] = False
        else:
            res, hit = get_directions(a_lat, a_lon, loc["lat"], loc["lon"], key, force)
            if hit:
                n_hits += 1
            else:
                n_misses += 1
            if "error" in res:
                print(f"  ERROR spur {anchor_id} -> {orid}: {res['error']}", file=sys.stderr)
                spur_entry["spur_raw_minutes"] = None
                spur_entry["spur_error"] = res["error"]
            else:
                spur_entry["spur_raw_minutes"] = round(res["duration_min"], 1)
                spur_entry["spur_distance_mi"] = round(res["distance_mi"], 1)
                spur_entry["spur_summary"] = res["summary"]
                spur_entry["spur_is_mountain"] = is_mountain_summary(res["summary"])
        pois.append(spur_entry)

    print(f"  cache: {n_hits} hits, {n_misses} new fetches", file=sys.stderr)

    # ----- For weather date assignment, POI fraction = its anchor's fraction. -----
    poi_anchor = {p["id"]: p["anchor"] for p in pois}

    def fraction_for_location(loc_id):
        if loc_id in cumulative_min_at:
            return cumulative_min_at[loc_id] / total_route_min if total_route_min else 0
        # Off-route: use its anchor's fraction.
        if loc_id in poi_anchor:
            anchor = poi_anchor[loc_id]
            return cumulative_min_at[anchor] / total_route_min if total_route_min else 0
        return None

    def date_for_fraction(frac):
        # Distribute across trip_total_days (inclusive both ends).
        offset_days = round(frac * (trip_total_days - 1))
        return trip_start_date + timedelta(days=offset_days)

    # ----- Sleep night temps (% position based) -----
    # For each sleep spot we always compute the historical climate
    # normal (night_temp_f). If the predicted date is within
    # FORECAST_WINDOW_DAYS of today, we ALSO fetch the actual forecast
    # and store it in night_temp_f_forecast so the frontend can render
    # it alongside (crossing out the historical). Historical stays put.
    today = date.today()
    forecast_end = today + timedelta(days=FORECAST_WINDOW_DAYS)
    # Prior run's weather values, keyed by location id. When a fetch is
    # rate-limited we fall back to these instead of nulling out data
    # that was perfectly good yesterday.
    prior_weather = {}
    if MAP_OUT.exists():
        try:
            for pl in json.loads(MAP_OUT.read_text()).get("locations", []):
                prior_weather[pl["id"]] = pl
        except (json.JSONDecodeError, KeyError):
            pass
    locations_out = []
    sleep_n_hits, sleep_n_misses = 0, 0
    fcst_n_hits, fcst_n_misses, fcst_n_skipped = 0, 0, 0
    major_n_hits, major_n_misses = 0, 0
    print(f"\n[WEATHER for sleep spots — by route position]", file=sys.stderr)
    print(f"  forecast window: {today} → {forecast_end}", file=sys.stderr)
    for loc in sources["locations"]:
        loc_copy = dict(loc)
        frac = fraction_for_location(loc["id"])
        if loc.get("kind") == "sleep" and frac is not None:
            d = date_for_fraction(frac)
            archive, hit = get_openmeteo_archive(loc["lat"], loc["lon"], force)
            loc_copy["route_fraction"] = round(frac, 3)
            loc_copy["predicted_date"] = d.isoformat()
            if archive is None:
                # Rate-limited: keep the previous run's value rather
                # than nulling out good data.
                prior = prior_weather.get(loc["id"], {})
                loc_copy["night_temp_f"] = prior.get("night_temp_f")
                print(f"  sleep  {loc['name']:<40}  frac={frac:.2f}  {d}  RATE-LIMITED (kept prior {loc_copy['night_temp_f']})", file=sys.stderr)
            else:
                if hit:
                    sleep_n_hits += 1
                else:
                    sleep_n_misses += 1
                temp = climate_normal_low(archive, d)
                loc_copy["night_temp_f"] = temp
                # Forecast overlay: only when predicted_date lies inside
                # the forecast window from "today".
                fcst_temp = None
                fcst_tag = ""
                if today <= d <= forecast_end:
                    fcst, fhit = get_openmeteo_forecast(loc["lat"], loc["lon"], force, today=today)
                    if fcst is None:
                        fcst_n_skipped += 1
                        fcst_tag = "  [FORECAST FETCH FAILED]"
                    else:
                        if fhit:
                            fcst_n_hits += 1
                        else:
                            fcst_n_misses += 1
                        fcst_temp = forecast_low_for_date(fcst, d)
                        if fcst_temp is not None:
                            loc_copy["night_temp_f_forecast"] = fcst_temp
                            loc_copy["forecast_fetched_at"] = today.isoformat()
                            fcst_tag = f"  fcst={fcst_temp}°F {'(cache)' if fhit else '(fetched)'}"
                        else:
                            fcst_tag = "  [no fcst value for date]"
                else:
                    fcst_n_skipped += 1
                print(f"  sleep  {loc['name']:<40}  frac={frac:.2f}  {d}  hist={temp}°F  {'(cache)' if hit else '(fetched)'}{fcst_tag}", file=sys.stderr)
        elif loc.get("kind") == "major" and frac is not None:
            d = date_for_fraction(frac)
            archive, hit = get_openmeteo_archive(loc["lat"], loc["lon"], force)
            loc_copy["route_fraction"] = round(frac, 3)
            loc_copy["predicted_date"] = d.isoformat()
            if archive is None:
                prior = prior_weather.get(loc["id"], {})
                loc_copy["wet_day_pct"] = prior.get("wet_day_pct")
                print(f"  major  {loc['name']:<40}  frac={frac:.2f}  {d}  RATE-LIMITED (kept prior {loc_copy['wet_day_pct']})", file=sys.stderr)
            else:
                if hit:
                    major_n_hits += 1
                else:
                    major_n_misses += 1
                rain = rain_stats(archive, d)
                wet_pct = rain["wet_day_pct"] if rain else None
                loc_copy["wet_day_pct"] = wet_pct
                # Forecast overlay for rain: same 10-day window as
                # sleep temps. Uses the same combined forecast endpoint,
                # so the cached response is shared across temp + rain.
                fcst_rain = None
                fcst_rain_tag = ""
                if today <= d <= forecast_end:
                    fcst, fhit = get_openmeteo_forecast(loc["lat"], loc["lon"], force, today=today)
                    if fcst is None:
                        fcst_rain_tag = "  [FORECAST FETCH FAILED]"
                    else:
                        if fhit:
                            fcst_n_hits += 1
                        else:
                            fcst_n_misses += 1
                        fcst_rain = forecast_rain_pct_for_date(fcst, d)
                        if fcst_rain is not None:
                            loc_copy["wet_day_pct_forecast"] = fcst_rain
                            loc_copy["forecast_fetched_at"] = today.isoformat()
                            fcst_rain_tag = f"  fcst={fcst_rain}% {'(cache)' if fhit else '(fetched)'}"
                        else:
                            fcst_rain_tag = "  [no fcst value for date]"
                print(f"  major  {loc['name']:<40}  frac={frac:.2f}  {d}  hist={wet_pct}%  {'(cache)' if hit else '(fetched)'}{fcst_rain_tag}", file=sys.stderr)
        locations_out.append(loc_copy)

    print(f"  sleep cache: {sleep_n_hits} hits, {sleep_n_misses} new", file=sys.stderr)
    print(f"  major cache: {major_n_hits} hits, {major_n_misses} new", file=sys.stderr)
    print(f"  forecast   : {fcst_n_hits} hits, {fcst_n_misses} new, {fcst_n_skipped} skipped", file=sys.stderr)

    return {
        "_comment": "Generated by scripts/compute_everything.py. Do not hand-edit; edit assets/map-sources.json or trip.json and re-run.",
        "version": 3,
        "trip_start_date": trip_start_date.isoformat(),
        "trip_total_days": trip_total_days,
        "total_route_raw_minutes": round(total_route_min, 1),
        "locations": locations_out,
        "route": route_ids,
        "segments": segments,
        "pois": pois,
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

    # Refuse to publish a map with errored drive times. An errored
    # segment silently skews every downstream route_fraction, predicted
    # date, and weather assignment — better to keep yesterday's good
    # map.json and make the failure loud.
    bad_segs = [f"{s['from']}->{s['to']}: {s['error']}"
                for s in map_out["segments"] if s.get("error")]
    bad_spurs = [f"spur {p['anchor']}->{p['id']}: {p['spur_error']}"
                 for p in map_out["pois"] if p.get("spur_error")]
    if bad_segs or bad_spurs:
        for msg in bad_segs + bad_spurs:
            print(f"FATAL: {msg}", file=sys.stderr)
        print(f"\nNOT writing {MAP_OUT} — fix the errors above and re-run.", file=sys.stderr)
        sys.exit(1)

    # Atomic write: temp file in the same dir + rename, so an interrupt
    # can't leave a truncated map.json for the next deploy to publish.
    tmp = MAP_OUT.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(map_out, indent=2))
    os.replace(tmp, MAP_OUT)
    print(f"\nWrote {MAP_OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
