#!/usr/bin/env python3
"""Fetch climate-normal overnight lows for each night at each sleep location.

Reads `assets/trip.json` for the stop list + start dates, writes
`assets/weather-data.json` with per-day per-start-date overnight lows.

Per-coord results cached in /tmp/openmeteo-cache/ to survive rate limits.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import date, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TRIP_JSON = REPO_ROOT / "assets" / "trip.json"
OUT_JSON  = REPO_ROOT / "assets" / "weather-data.json"
CACHE_DIR = Path("/tmp/openmeteo-cache")
CACHE_DIR.mkdir(exist_ok=True)


def fetch_with_retry(url, cache_key, max_retries=5):
    cache_path = CACHE_DIR / f"{cache_key}.json"
    if cache_path.exists():
        return json.loads(cache_path.read_text())
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                data = json.load(r)
                cache_path.write_text(json.dumps(data))
                return data
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 60 * (attempt + 1)
                print(f"  rate-limited, sleeping {wait}s...", file=sys.stderr)
                time.sleep(wait)
                continue
            raise
    raise RuntimeError(f"Failed after {max_retries} retries: {url}")


def get_archive(lat, lon):
    cache_key = f"archive_{lat}_{lon}".replace(".", "p").replace("-", "n")
    url = (
        "https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={lat}&longitude={lon}"
        "&start_date=1995-01-01&end_date=2024-12-31"
        "&daily=temperature_2m_min"
        "&temperature_unit=fahrenheit"
        "&timezone=auto"
    )
    return fetch_with_retry(url, cache_key)


def climate_normal_for(arch, target_date):
    times = arch["daily"]["time"]
    mins = arch["daily"]["temperature_2m_min"]
    mm_dd = target_date.strftime("%m-%d")
    matches = [m for m, t in zip(mins, times) if t.endswith(mm_dd) and m is not None]
    if not matches:
        return None
    return round(sum(matches) / len(matches), 1)


def expand_stops(trip):
    """Expand the trip stops list so each NIGHT gets its own entry.

    A stop with nights=2 produces two day entries with the same coord and
    consecutive day numbers + dates.
    """
    expanded = []
    day = 1
    for stop in trip["stops"]:
        for night_idx in range(stop["nights"]):
            expanded.append({
                "day": day,
                "label": stop["label"],
                "lat": stop["lat"],
                "lon": stop["lon"],
            })
            day += 1
    return expanded


def main():
    trip = json.loads(TRIP_JSON.read_text())
    start_dates = {k: date.fromisoformat(v) for k, v in trip["start_dates"].items()}
    expanded = expand_stops(trip)

    # Dedup coords for archive fetches
    unique = {}
    for s in expanded:
        unique.setdefault((s["lat"], s["lon"]), s["label"])

    archives = {}
    for (lat, lon), label in unique.items():
        print(f"Fetching archive for {label}...", file=sys.stderr)
        archives[(lat, lon)] = get_archive(lat, lon)
        time.sleep(2)

    out_stops = []
    for s in expanded:
        offset = s["day"] - 1
        early_d = start_dates["early"] + timedelta(days=offset)
        late_d  = start_dates["late"]  + timedelta(days=offset)
        arch = archives[(s["lat"], s["lon"])]
        e_low = climate_normal_for(arch, early_d)
        l_low = climate_normal_for(arch, late_d)
        print(f"  Day {s['day']} {s['label']}: early({early_d})={e_low}°F late({late_d})={l_low}°F", file=sys.stderr)
        out_stops.append({
            "day": s["day"],
            "label": s["label"],
            "lat": s["lat"],
            "lon": s["lon"],
            "early_date": early_d.isoformat(),
            "late_date":  late_d.isoformat(),
            "early_normal_low_f": e_low,
            "late_normal_low_f":  l_low,
        })

    OUT_JSON.write_text(json.dumps({
        "stops": out_stops,
        "start_dates": trip["start_dates"],
        "source": "Open-Meteo ERA5 archive 1995-2024 (30-year average of daily min temp)",
    }, indent=2))
    print(f"\nWrote {OUT_JSON}", file=sys.stderr)


if __name__ == "__main__":
    main()
