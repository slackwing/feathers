#!/usr/bin/env python3
"""Validate html/hxh/roster.json against CHARACTER.md. Exit 1 on problems.
Usage: validate.py [roster.json ...]  (default: the master copy)"""
import json, re, sys, os, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT = os.path.join(HERE, "..", "html", "hxh", "roster.json")
NEN = {"enhancement", "transmutation", "conjuration", "emission", "manipulation", "specialization"}
ARCS = ["hunter-exam", "zoldyck-family", "heavens-arena", "yorknew-city", "greed-island", "chimera-ant", "chairman-election"]
RANKS = {"S", "A", "B", "C"}
SLUG = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
JA = re.compile(r"^[぀-ヿ一-鿿０-～・　＝・ー A-Za-z0-9]+$")

def is_emoji(s):
    if not s or len(s) > 3:
        return False
    if any(ch in "‍\U0001F3FB\U0001F3FC\U0001F3FD\U0001F3FE\U0001F3FF" for ch in s):
        return False   # ZWJ sequences / skin tones
    base = s[0]
    return unicodedata.category(base) in ("So", "Sk") or ord(base) >= 0x1F000

def check(path):
    problems = []
    try:
        data = json.load(open(path, encoding="utf-8"))
    except Exception as e:
        return [f"{path}: not valid JSON: {e}"]
    if not isinstance(data, list):
        return [f"{path}: top level must be a list"]
    slugs, glyphs, firsts = {}, {}, {}
    for i, c in enumerate(data):
        tag = f"[{i}] {c.get('slug', '?')}"
        for k in ("slug", "name", "name_ja", "first", "glyph", "rank", "nen_types", "affiliation", "weapons", "arcs", "description"):
            if k not in c:
                problems.append(f"{tag}: missing {k}")
        if not SLUG.match(c.get("slug", "")):
            problems.append(f"{tag}: bad slug")
        if c.get("slug") in slugs:
            problems.append(f"{tag}: duplicate slug (also [{slugs[c['slug']]}])")
        slugs[c.get("slug")] = i
        if not c.get("name"):
            problems.append(f"{tag}: empty name")
        if not c.get("name_ja") or not JA.match(c["name_ja"]):
            problems.append(f"{tag}: name_ja missing or not Japanese: {c.get('name_ja')!r}")
        f = c.get("first", "")
        if not f or len(f) > 10 or " " in f:
            problems.append(f"{tag}: first must be 1-10 chars, no spaces: {f!r}")
        if f in firsts:
            problems.append(f"{tag}: first {f!r} also used by {firsts[f]}")
        firsts[f] = c.get("slug")
        g = c.get("glyph", "")
        if not is_emoji(g):
            problems.append(f"{tag}: glyph is not a single plain emoji: {g!r}")
        glyphs.setdefault(g, []).append(c.get("slug"))
        if c.get("rank") not in RANKS:
            problems.append(f"{tag}: rank must be S/A/B/C")
        nt = c.get("nen_types", [])
        if not isinstance(nt, list) or len(nt) > 2 or any(t not in NEN for t in nt):
            problems.append(f"{tag}: nen_types must be 0-2 of {sorted(NEN)}: {nt}")
        arcs = c.get("arcs", [])
        if not isinstance(arcs, list) or not arcs or any(a not in ARCS for a in arcs):
            problems.append(f"{tag}: arcs must be non-empty subset of {ARCS}: {arcs}")
        elif [ARCS.index(a) for a in arcs] != sorted(ARCS.index(a) for a in arcs):
            problems.append(f"{tag}: arcs not chronological: {arcs}")
        if not isinstance(c.get("weapons", []), list) or any(not SLUG.match(w) for w in c.get("weapons", [])):
            problems.append(f"{tag}: weapons must be kebab slugs: {c.get('weapons')}")
        if not c.get("affiliation"):
            problems.append(f"{tag}: affiliation empty")
        words = len(c.get("description", "").split())
        if not 45 <= words <= 75:
            problems.append(f"{tag}: description is {words} words (want 45-75)")
        if "images" in c and (not isinstance(c["images"], list) or any(not u.startswith("http") for u in c["images"])):
            problems.append(f"{tag}: images must be a list of URLs")
    for g, who in glyphs.items():
        if len(who) > 2:
            problems.append(f"glyph {g} used {len(who)} times: {who}")
    return problems

if __name__ == "__main__":
    paths = sys.argv[1:] or [DEFAULT]
    bad = 0
    for p in paths:
        probs = check(p)
        n = len(json.load(open(p, encoding="utf-8"))) if not probs or "not valid JSON" not in probs[0] else 0
        print(f"{p}: {n} entries, {len(probs)} problems")
        for x in probs:
            print("  -", x)
        bad += len(probs)
    sys.exit(1 if bad else 0)
