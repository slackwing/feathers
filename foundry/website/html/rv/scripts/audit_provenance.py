#!/usr/bin/env python3
"""Audit provenance metadata in trip.json.

Lists facts and structural fields that are unvetted (author=claude) and unpinned,
grouped by confidence level. Useful for batch-vetting in a focused session.

Usage:
    python3 scripts/audit_provenance.py              # default: all unvetted
    python3 scripts/audit_provenance.py --confidence guessed     # filter
    python3 scripts/audit_provenance.py --pinned-only            # show pinned items
    python3 scripts/audit_provenance.py --summary                # counts only
"""

import argparse
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TRIP = ROOT / "assets" / "trip.json"


def short(text, n=70):
    s = str(text).replace("\n", " ").strip()
    return s if len(s) <= n else s[:n - 1] + "…"


def collect(trip):
    """Walk trip.json and yield (kind, location, key, value, meta_dict) tuples."""
    # trip-level meta
    for k, m in trip.get("trip", {}).get("meta", {}).items():
        yield ("trip", "trip", k, trip["trip"].get(k), m)
    # start_dates meta
    sd = trip.get("start_dates", {})
    for k, m in sd.get("meta", {}).items():
        yield ("start_date", "start_dates", k, sd.get(k), m)
    # stops: meta + facts
    for s in trip.get("stops", []):
        loc = f"stop day {s['day']} ({s.get('short_name', s.get('label', '?'))})"
        for k, m in s.get("meta", {}).items():
            yield ("stop_field", loc, k, s.get(k), m)
        for i, f in enumerate(s.get("facts", [])):
            yield ("fact", loc, f"facts[{i}]", f.get("text"), f)
    # drives
    for d in trip.get("drives", []):
        loc = f"drive {d['from_day']}->{d['to_day']} ({d.get('from_label')}->{d.get('to_label')})"
        for k, m in d.get("meta", {}).items():
            yield ("drive_field", loc, k, d.get(k), m)
    # activities
    for a in trip.get("activities", []):
        loc = f"activity '{a.get('name')}'"
        for k, m in a.get("meta", {}).items():
            yield ("activity_field", loc, k, a.get(k), m)
    # passthroughs
    for p in trip.get("passthroughs", []):
        loc = f"passthrough '{p.get('name')}'"
        for k, m in p.get("meta", {}).items():
            yield ("passthrough_field", loc, k, p.get(k), m)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--confidence", help="filter by confidence level (vetted/researched/recalled/guessed/placeholder)")
    p.add_argument("--author", help="filter by author (claude/andrew)")
    p.add_argument("--pinned-only", action="store_true", help="show only pinned items")
    p.add_argument("--unpinned-only", action="store_true", help="show only unpinned items")
    p.add_argument("--summary", action="store_true", help="counts only")
    p.add_argument("--kind", help="filter by record kind (trip/start_date/stop_field/fact/drive_field/activity_field/passthrough_field)")
    args = p.parse_args()

    trip = json.loads(TRIP.read_text())
    items = list(collect(trip))

    # Apply filters
    def keep(rec):
        kind, loc, key, val, meta = rec
        if args.kind and kind != args.kind: return False
        if args.confidence and meta.get("confidence") != args.confidence: return False
        if args.author and meta.get("author") != args.author: return False
        if args.pinned_only and not meta.get("pinned"): return False
        if args.unpinned_only and meta.get("pinned"): return False
        return True

    filtered = [r for r in items if keep(r)]

    if args.summary:
        by_conf = defaultdict(lambda: defaultdict(int))
        for kind, loc, key, val, meta in items:
            by_conf[meta.get("author", "?")][meta.get("confidence", "?")] += 1
        pinned = sum(1 for r in items if r[4].get("pinned"))
        print(f"Total items: {len(items)} ({pinned} pinned)")
        for author, conf_counts in sorted(by_conf.items()):
            print(f"  {author}:")
            for conf, n in sorted(conf_counts.items(), key=lambda kv: -kv[1]):
                print(f"    {conf:12s} {n:4d}")
        return

    # Group output by location for readability
    by_loc = defaultdict(list)
    for r in filtered:
        by_loc[r[1]].append(r)

    for loc in sorted(by_loc.keys()):
        print(f"\n## {loc}")
        for kind, _, key, val, meta in by_loc[loc]:
            pin = "[P] " if meta.get("pinned") else "    "
            auth = meta.get("author", "?")
            conf = meta.get("confidence", "?")
            note = f" - {meta['note']}" if meta.get("note") else ""
            print(f"  {pin}{auth:6s}/{conf:11s}  {key:20s}  {short(val)}{note}")

    print(f"\n{len(filtered)} items shown ({len(items)} total in trip.json).")


if __name__ == "__main__":
    main()
