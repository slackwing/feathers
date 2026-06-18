#!/usr/bin/env python3
"""Fetch 30-yr precipitation normals for each night at each sleep location.

Reads `assets/trip.json`, writes `assets/rain-data.json` with per-day
per-start-date wet-day probability (±3 day window around the calendar date).
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
OUT_JSON  = REPO_ROOT / "assets" / "rain-data.json"
CACHE_DIR = Path("/tmp/openmeteo-rain-cache")
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
    raise RuntimeError("retries exhausted")


def get_archive(lat, lon):
    cache_key = f"rainarch_{lat}_{lon}".replace(".", "p").replace("-", "n")
    url = (
        "https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={lat}&longitude={lon}"
        "&start_date=1995-01-01&end_date=2024-12-31"
        "&daily=precipitation_sum,precipitation_hours"
        "&precipitation_unit=inch&timezone=auto"
    )
    return fetch_with_retry(url, cache_key)


def rain_stats(arch, target_date, window_days=3):
    times = arch["daily"]["time"]
    precs = arch["daily"]["precipitation_sum"]
    hours = arch["daily"]["precipitation_hours"]
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


def expand_stops(trip):
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

    unique = {}
    for s in expanded:
        unique.setdefault((s["lat"], s["lon"]), s["label"])

    archives = {}
    for (lat, lon), label in unique.items():
        print(f"Fetching precip archive for {label}...", file=sys.stderr)
        archives[(lat, lon)] = get_archive(lat, lon)
        time.sleep(2)

    out_stops = []
    for s in expanded:
        offset = s["day"] - 1
        early_d = start_dates["early"] + timedelta(days=offset)
        late_d  = start_dates["late"]  + timedelta(days=offset)
        arch = archives[(s["lat"], s["lon"])]
        e = rain_stats(arch, early_d)
        l = rain_stats(arch, late_d)
        print(f"  Day {s['day']} {s['label']}: early={e} late={l}", file=sys.stderr)
        out_stops.append({
            "day": s["day"],
            "label": s["label"],
            "lat": s["lat"],
            "lon": s["lon"],
            "early_date": early_d.isoformat(),
            "late_date":  late_d.isoformat(),
            "early_rain": e,
            "late_rain":  l,
        })

    OUT_JSON.write_text(json.dumps({
        "stops": out_stops,
        "source": "Open-Meteo ERA5 archive 1995-2024, ±3 day window, wet = >=0.1in",
    }, indent=2))
    print(f"\nWrote {OUT_JSON}", file=sys.stderr)


if __name__ == "__main__":
    main()
