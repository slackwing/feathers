#!/usr/bin/env python3
"""Order the roster and assign card numbers, in place.

  build.py                       reorder html/hxh/roster.json, assign `no`
  build.py --merge a.json b.json merge batch files into the roster first
                                  (entries replace same-slug entries)

Order: first arc the character appears in, then rank (S A B C), then the
order entries already had (so hand-placed ordering within an arc survives),
then name. `no` is 1-based and printed on the card; never hand-edit it."""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROSTER = os.path.join(HERE, "..", "html", "hxh", "roster.json")
ARCS = ["hunter-exam", "zoldyck-family", "heavens-arena", "yorknew-city", "greed-island", "chimera-ant", "chairman-election"]
RANK = {"S": 0, "A": 1, "B": 2, "C": 3}
FIELDS = ["no", "slug", "name", "name_ja", "first", "glyph", "rank", "nen_types", "affiliation", "weapons", "arcs", "description", "images"]

def load(p):
    return json.load(open(p, encoding="utf-8"))

def main(argv):
    roster = load(ROSTER)
    if argv and argv[0] == "--merge":
        by = {c["slug"]: c for c in roster}
        order = [c["slug"] for c in roster]
        for p in argv[1:]:
            for c in load(p):
                if c["slug"] not in by:
                    order.append(c["slug"])
                by[c["slug"]] = {**by.get(c["slug"], {}), **c}
        roster = [by[s] for s in order]
    pos = {c["slug"]: i for i, c in enumerate(roster)}
    roster.sort(key=lambda c: (ARCS.index(c["arcs"][0]) if c.get("arcs") else 99, RANK.get(c.get("rank"), 9), pos[c["slug"]], c["name"]))
    out = []
    for i, c in enumerate(roster, 1):
        c["no"] = i
        c.setdefault("images", [])
        out.append({k: c[k] for k in FIELDS if k in c} | {k: v for k, v in c.items() if k not in FIELDS})
    json.dump(out, open(ROSTER, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"wrote {len(out)} characters to {os.path.relpath(ROSTER)}")

if __name__ == "__main__":
    main(sys.argv[1:])
