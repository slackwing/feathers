#!/usr/bin/env python3
"""roster.py — command line for the hxh Roster DB (hobby-server
internal/hxh/rosterdb.go). Used by the hxh-character skill; also handy by
hand. Stdlib only, except `pixelate` (Pillow).

Config: ~/.claude/hxh-roster.env with
    HXH_ROSTER_BASE=https://andrewcheong.com   (or http://127.0.0.1:8770 locally)
    HXH_ROSTER_USER=…    HXH_ROSTER_PASS=…      (an hxh admin account)
Environment variables of the same names override the file. The session
cookie is kept next to it (hxh-roster.cookie) and refreshed on 401.

    roster.py find <slug>                 → the character as JSON, or nothing (exit 1)
    roster.py list [--status pending]
    roster.py get <id>                    → profile + image metadata
    roster.py delete <id>                 → the character and all its pictures
    roster.py create <json-file|->        → new pending character
    roster.py patch <id> <json-file|->    → partial update
    roster.py upload <id> <file> [--type raw] [--source-image N] [--url U] [--caption C]
    roster.py fetch <id> <url> [--caption C]        download a picture and store it as a raw
    roster.py download <image-id> <out-file>
    roster.py image <image-id>            → metadata (+ character)
    roster.py reject|keep <image-id>
    roster.py crop <image-id> X Y W H
    roster.py pixelate <image-id> [--size 96] [--colors 32]
"""
import argparse, http.cookiejar, io, json, os, sys, urllib.error, urllib.parse, urllib.request

ENV_FILE = os.path.expanduser("~/.claude/hxh-roster.env")
COOKIE_FILE = os.path.expanduser("~/.claude/hxh-roster.cookie")
UA = "hxh-roster/1.0 (+https://andrewcheong.com/hxh; acheong87@gmail.com)"


def config():
    cfg = {}
    if os.path.exists(ENV_FILE):
        for line in open(ENV_FILE):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                cfg[k.strip()] = v.strip().strip('"').strip("'")
    for k in ("HXH_ROSTER_BASE", "HXH_ROSTER_USER", "HXH_ROSTER_PASS"):
        if os.environ.get(k):
            cfg[k] = os.environ[k]
    cfg.setdefault("HXH_ROSTER_BASE", "https://andrewcheong.com")
    return cfg


class Client:
    def __init__(self):
        self.cfg = config()
        self.base = self.cfg["HXH_ROSTER_BASE"].rstrip("/")
        self.jar = http.cookiejar.MozillaCookieJar(COOKIE_FILE)
        if os.path.exists(COOKIE_FILE):
            try:
                self.jar.load(ignore_discard=True, ignore_expires=True)
            except Exception:
                pass
        self.http = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def login(self):
        u, p = self.cfg.get("HXH_ROSTER_USER"), self.cfg.get("HXH_ROSTER_PASS")
        if not (u and p):
            sys.exit(f"no credentials: put HXH_ROSTER_USER / HXH_ROSTER_PASS in {ENV_FILE}")
        self._raw("POST", "/admin/api/login", json.dumps({"username": u, "password": p}).encode(), "application/json")
        os.makedirs(os.path.dirname(COOKIE_FILE), exist_ok=True)
        self.jar.save(ignore_discard=True, ignore_expires=True)
        os.chmod(COOKIE_FILE, 0o600)

    def _raw(self, method, path, body=None, ctype=None):
        req = urllib.request.Request(self.base + path, data=body, method=method)
        req.add_header("User-Agent", UA)
        if ctype:
            req.add_header("Content-Type", ctype)
        try:
            with self.http.open(req, timeout=120) as r:
                return r.status, r.headers.get("Content-Type", ""), r.read()
        except urllib.error.HTTPError as e:
            return e.code, e.headers.get("Content-Type", ""), e.read()

    def call(self, method, path, body=None, ctype=None, retry=True):
        status, ct, data = self._raw(method, path, body, ctype)
        if status == 401 and retry:
            self.login()
            return self.call(method, path, body, ctype, retry=False)
        if status >= 400:
            msg = data.decode("utf-8", "replace").strip()
            try:
                msg = json.loads(msg).get("error", msg)
            except Exception:
                pass
            sys.exit(f"{method} {path}: HTTP {status}: {msg}")
        if "json" in ct:
            return json.loads(data or b"null")
        return data

    def db(self, method, path, obj=None):
        body = json.dumps(obj).encode() if obj is not None else None
        return self.call(method, "/hxh/api/db" + path, body, "application/json" if obj is not None else None)


def read_json_arg(arg):
    text = sys.stdin.read() if arg == "-" else open(arg, encoding="utf-8").read()
    return json.loads(text)


def out(obj):
    print(json.dumps(obj, ensure_ascii=False, indent=1))


def sniff(data):
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def upload_bytes(c, char_id, data, typ="raw", source_image=None, url="", caption=""):
    mime = sniff(data)
    if not mime:
        sys.exit("not a png/jpeg/gif/webp file")
    q = {"type": typ, "source_url": url, "caption": caption[:200]}
    if source_image:
        q["source_image_id"] = str(source_image)
    res = c.call("POST", f"/hxh/api/db/chars/{char_id}/images?" + urllib.parse.urlencode(q), data, mime)
    im = res["image"]
    tag = "added" if res["created"] else f"already there ({im['status']})"
    print(f"#{im['id']} {im['type']} {im['width']}x{im['height']} {tag}", file=sys.stderr)
    return res


def http_get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) " + UA})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        sys.exit(f"GET {url}: HTTP {e.code}")
    except urllib.error.URLError as e:
        sys.exit(f"GET {url}: {e.reason}")


def pixelate(data, size=96, colors=32):
    """Pixel art at its true size: shrink with Lanczos, then quantize with
    no dither. libimagequant keeps the anime palette (Gon's yellow eyes
    stayed yellow); median cut turned everything brown. Compared
    2026-09-19 on Gon's portrait crop; fallback = octree + a little
    saturation, the runner-up."""
    from PIL import Image, ImageEnhance
    im = Image.open(io.BytesIO(data)).convert("RGBA")
    w, h = im.size
    scale = size / max(w, h)
    small = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    rgb = small.convert("RGB")
    try:
        q = rgb.quantize(colors=colors, method=Image.Quantize.LIBIMAGEQUANT, dither=Image.Dither.NONE)
    except Exception:
        rgb = ImageEnhance.Color(rgb).enhance(1.2)
        q = rgb.quantize(colors=colors, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    outim = Image.merge("RGBA", (*q.convert("RGB").split(), small.getchannel("A")))
    buf = io.BytesIO()
    outim.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("login")
    p = sub.add_parser("find"); p.add_argument("slug")
    p = sub.add_parser("list"); p.add_argument("--status", default="")
    p = sub.add_parser("get"); p.add_argument("id", type=int)
    p = sub.add_parser("delete"); p.add_argument("id", type=int)
    p = sub.add_parser("create"); p.add_argument("json")
    p = sub.add_parser("patch"); p.add_argument("id", type=int); p.add_argument("json")
    p = sub.add_parser("upload"); p.add_argument("id", type=int); p.add_argument("file")
    p.add_argument("--type", default="raw"); p.add_argument("--source-image", type=int); p.add_argument("--url", default=""); p.add_argument("--caption", default="")
    p = sub.add_parser("fetch"); p.add_argument("id", type=int); p.add_argument("url"); p.add_argument("--caption", default="")
    p = sub.add_parser("download"); p.add_argument("image", type=int); p.add_argument("out")
    p = sub.add_parser("image"); p.add_argument("image", type=int)
    p = sub.add_parser("reject"); p.add_argument("image", type=int)
    p = sub.add_parser("keep"); p.add_argument("image", type=int)
    p = sub.add_parser("crop"); p.add_argument("image", type=int); [p.add_argument(k, type=int) for k in ("x", "y", "w", "h")]
    p = sub.add_parser("pixelate"); p.add_argument("image", type=int); p.add_argument("--size", type=int, default=96); p.add_argument("--colors", type=int, default=32)
    a = ap.parse_args()
    c = Client()

    if a.cmd == "login":
        c.login(); print("ok")
    elif a.cmd == "find":
        rows = c.db("GET", "/chars?slug=" + urllib.parse.quote(a.slug))
        if not rows:
            sys.exit(1)
        out(rows[0])
    elif a.cmd == "list":
        for r in c.db("GET", "/chars?status=" + a.status):
            print(f"{r['id']:>4}  {r['status']:<9} {r['rank']}  {r['name']}  ({r['slug']}, {r['image_count']} images)")
    elif a.cmd == "get":
        out(c.db("GET", f"/chars/{a.id}"))
    elif a.cmd == "delete":
        c.db("DELETE", f"/chars/{a.id}"); print("deleted", file=sys.stderr)
    elif a.cmd == "create":
        out(c.db("POST", "/chars", read_json_arg(a.json)))
    elif a.cmd == "patch":
        out(c.db("PATCH", f"/chars/{a.id}", read_json_arg(a.json)))
    elif a.cmd == "upload":
        upload_bytes(c, a.id, open(a.file, "rb").read(), a.type, a.source_image, a.url, a.caption)
    elif a.cmd == "fetch":
        data = http_get(a.url)
        upload_bytes(c, a.id, data, "raw", None, a.url, a.caption)
    elif a.cmd == "download":
        data = c.db("GET", f"/images/{a.image}")
        open(a.out, "wb").write(data); print(f"{len(data)} bytes → {a.out}", file=sys.stderr)
    elif a.cmd == "image":
        out(c.db("GET", f"/images/{a.image}/meta"))
    elif a.cmd in ("reject", "keep"):
        out(c.db("PATCH", f"/images/{a.image}", {"status": "rejected" if a.cmd == "reject" else "kept"}))
    elif a.cmd == "crop":
        out(c.db("POST", f"/images/{a.image}/crop", {"x": a.x, "y": a.y, "w": a.w, "h": a.h}))
    elif a.cmd == "pixelate":
        meta = c.db("GET", f"/images/{a.image}/meta")
        data = c.db("GET", f"/images/{a.image}")
        png = pixelate(data, a.size, a.colors)
        upload_bytes(c, meta["image"]["char_id"], png, "pixelated", a.image, "", f"pixel {a.size}px {a.colors}c")


if __name__ == "__main__":
    main()
