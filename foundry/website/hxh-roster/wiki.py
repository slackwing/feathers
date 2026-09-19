#!/usr/bin/env python3
"""wiki.py — read the Hunter × Hunter Fandom wiki through its MediaWiki
API (page fetches are blocked with 402; the API is not). Used by the
hxh-character skill.

    wiki.py infobox "Gon Freecss"      → the Hunterpedia:Character infobox as JSON
    wiki.py images "Gon Freecss" [--min 600] [--all]
                                       → pictures used on the page with size + original URL,
                                         largest first (default: skip manga/1999/flags/icons)
    wiki.py sheet "Gon Freecss" out.png [--min 600] [--max 24] [--only gon]
                                       → a numbered contact sheet of those pictures (ImageMagick)
                                         and the numbered list on stdout — LOOK before choosing
    wiki.py section "Gon Freecss" Appearance      → one section's wikitext, plain-ish
    wiki.py search "Zetsk"             → page titles
"""
import argparse, json, re, sys, urllib.parse, urllib.request

API = "https://hunterxhunter.fandom.com/api.php"
UA = "hxh-roster/1.0 (+https://andrewcheong.com/hxh; acheong87@gmail.com)"


def api(**params):
    params.setdefault("format", "json")
    req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params), headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def wikitext(page):
    d = api(action="parse", page=page, prop="wikitext", redirects=1)
    if "error" in d:
        sys.exit(f"{page}: {d['error'].get('info')}")
    return d["parse"]["wikitext"]["*"], d["parse"]["title"]


def strip_markup(s):
    s = re.sub(r"<ref[^>]*/>", "", s)
    s = re.sub(r"<ref[^>]*>.*?</ref>", "", s, flags=re.S)
    s = re.sub(r"\{\{Note\|.*?\}\}", "", s, flags=re.S)
    s = re.sub(r"\{\{dtb\|([^}]*)\}\}", r"\1", s)
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", s)
    s = re.sub(r"<br\s*/?>", " / ", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"'''?", "", s)
    return re.sub(r"\s+", " ", s).strip()


def template_fields(text, name):
    """Fields of the first {{name ...}} template, brace-balanced."""
    i = text.find("{{" + name)
    if i < 0:
        return None
    depth, j = 0, i
    while j < len(text):
        if text.startswith("{{", j):
            depth += 1; j += 2; continue
        if text.startswith("}}", j):
            depth -= 1; j += 2
            if depth == 0:
                break
            continue
        j += 1
    body = text[i + 2:j - 2]
    fields, key, buf, d = {}, None, [], 0
    for line in body.split("\n"):
        m = re.match(r"^\|\s*([^=|]+?)\s*=(.*)$", line) if d == 0 else None
        if m:
            if key:
                fields[key] = "\n".join(buf).strip()
            key, buf = m.group(1).strip(), [m.group(2)]
        else:
            buf.append(line)
        d += line.count("{{") - line.count("}}")
    if key:
        fields[key] = "\n".join(buf).strip()
    return fields


SKIP = re.compile(r"1999|manga|chap(ter)?\s*\d|flag|icon|logo|featured|\.gif$|OP Card|ED Card|Volume|cover", re.I)


def cmd_infobox(a):
    text, title = wikitext(a.page)
    f = template_fields(text, "Hunterpedia:Character")
    if f is None:
        sys.exit(f"{title}: no character infobox")
    keep = ["name", "kana", "rōmaji", "romaji", "gender", "age", "birthday", "height", "weight", "blood type", "type", "nen type",
            "status", "occupation", "affiliation", "previous affiliation", "relatives", "abilities", "manga debut", "anime debut"]
    out = {"title": title}
    for k, v in f.items():
        kl = k.lower()
        if kl in keep or kl.startswith("aff") or "nen" in kl or "type" in kl:
            out[kl] = strip_markup(v)
    print(json.dumps(out, ensure_ascii=False, indent=1))


def page_images(page, min_side, all_=False):
    text, title = wikitext(page)
    d = api(action="query", prop="images", titles=title, imlimit=500)
    page = next(iter(d["query"]["pages"].values()))
    titles = [i["title"] for i in page.get("images", [])]
    rows = []
    for k in range(0, len(titles), 50):
        d = api(action="query", prop="imageinfo", iiprop="url|size|mime", titles="|".join(titles[k:k + 50]))
        for p in d["query"]["pages"].values():
            ii = p.get("imageinfo")
            if not ii:
                continue
            ii = ii[0]
            name = p["title"].removeprefix("File:")
            if not all_ and (SKIP.search(name) or ii["mime"] == "image/gif" or max(ii["width"], ii["height"]) < min_side):
                continue
            # where on the page it is used → the caption in the wikitext, if any
            m = re.search(r"\[\[File:" + re.escape(name) + r"\|([^\]]*)\]\]", text)
            cap = ""
            if m:
                parts = [x for x in m.group(1).split("|") if not re.match(r"^(thumb|left|right|center|\d+px|frame|frameless|none)$", x.strip())]
                cap = strip_markup(parts[-1]) if parts else ""
            rows.append({"file": name, "width": ii["width"], "height": ii["height"], "mime": ii["mime"], "bytes": ii["size"],
                         "url": ii["url"].split("?")[0], "caption": cap})
    rows.sort(key=lambda r: -(r["width"] * r["height"]))
    return rows


def cmd_images(a):
    rows = page_images(a.page, a.min, a.all)
    for r in rows:
        print(f"{r['width']:>5}x{r['height']:<5} {r['file']}  {('— ' + r['caption']) if r['caption'] else ''}")
        print(f"            {r['url']}")
    print(f"{len(rows)} pictures", file=sys.stderr)


def cmd_sheet(a):
    """Download small copies of the page's pictures and tile them, numbered,
    so the chooser can LOOK at every candidate at once."""
    import os, subprocess, tempfile
    rows = page_images(a.page, a.min)
    if a.only:
        rows = [r for r in rows if re.search(a.only, r["file"] + " " + r["caption"], re.I)]
    rows = rows[:a.max]
    tmp = tempfile.mkdtemp(prefix="sheet-")
    files = []
    for n, r in enumerate(rows):
        out = os.path.join(tmp, f"{n:02d}.png")
        req = urllib.request.Request(r["url"] + "/scale-to-width-down/480", headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) " + UA})
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                open(out, "wb").write(resp.read())
            files.append(out)
        except Exception as e:
            print(f"{n:02d} download failed: {e}", file=sys.stderr)
        print(f"{n:02d}  {r['width']}x{r['height']}  {r['file']}  {('— ' + r['caption']) if r['caption'] else ''}")
        print(f"      {r['url']}")
    subprocess.run(["magick", "montage", *files, "-tile", "4x", "-geometry", "480x270+6+6", "-background", "#222",
                    "-fill", "white", "-pointsize", "26", "-label", "%t", a.out], check=True)
    print(f"{len(files)} pictures → {a.out}", file=sys.stderr)


def cmd_section(a):
    text, title = wikitext(a.page)
    m = re.search(r"^==+\s*" + re.escape(a.section) + r"\s*==+\s*$(.*?)(?=^==[^=]|\Z)", text, flags=re.M | re.S)
    if not m:
        sys.exit(f"{title}: no section {a.section!r}; sections: " + ", ".join(re.findall(r"^==\s*([^=]+?)\s*==\s*$", text, flags=re.M)))
    body = re.sub(r"\{\{[^{}]*\}\}", "", m.group(1))
    print(strip_markup(re.sub(r"\[\[File:[^\]]*\]\]", "", body)))


def cmd_search(a):
    d = api(action="query", list="search", srsearch=a.q, srlimit=20)
    for r in d["query"]["search"]:
        print(r["title"])


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("infobox"); p.add_argument("page"); p.set_defaults(f=cmd_infobox)
    p = sub.add_parser("images"); p.add_argument("page"); p.add_argument("--min", type=int, default=600); p.add_argument("--all", action="store_true"); p.set_defaults(f=cmd_images)
    p = sub.add_parser("sheet"); p.add_argument("page"); p.add_argument("out"); p.add_argument("--min", type=int, default=600); p.add_argument("--max", type=int, default=24); p.add_argument("--only", default=""); p.set_defaults(f=cmd_sheet)
    p = sub.add_parser("section"); p.add_argument("page"); p.add_argument("section"); p.set_defaults(f=cmd_section)
    p = sub.add_parser("search"); p.add_argument("q"); p.set_defaults(f=cmd_search)
    a = ap.parse_args()
    a.f(a)


if __name__ == "__main__":
    main()
