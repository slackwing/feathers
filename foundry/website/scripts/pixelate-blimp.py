#!/usr/bin/env python3
"""Pixel-art sprite of Abi's blimp (html/hxh/img/blimp.png → blimp-px.png).

The desktop wallpaper is pixel art at 5 screen px per art px (os/env.js
WHALE.scale); Settings › Display › Blimp › Pixelated flies the ship as a
sprite at TWICE that granularity — 2.5 screen px per cell (Andrew,
2026-09-24: "matches the pixelation of the rest of the background";
2026-09-25: "lost too much… double that granularity and preserve some
features like the X's"). The sprite is SPRITE_W × SPRITE_H cells
(blimp.js: the ship's box ÷ SPRITE_PX), each cell decided from its block
of source pixels:

  - transparent when the block is mostly empty and carries no ink;
  - INK (the drawing's line colour) when enough of the block is line —
    a low bar over transparency so masts and the stern's axis line
    survive as 1-px lines, a higher one inside the hull so outlines stay
    1 px and panel lines read;
  - otherwise the block's mean colour, snapped to the drawing's own flat
    fills (its most frequent opaque colours) — hard edges, no blends.

Prints the palette and the sprite row that carries the stern's axis line
(blimp.js PX_LINE_ROW must match: the pixelated rope sits on that row).
Run from foundry/website:  python3 scripts/pixelate-blimp.py
"""
import sys
from collections import Counter
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / "html/hxh/img/blimp.png", ROOT / "html/hxh/img/blimp-px.png"
SPRITE_W, SPRITE_H = 96, 72          # = blimp.js SPRITE_W/H (ship box 240 × 180 at a 2.5 px cell)
INK = (35, 31, 32)                   # the drawing's line colour (#231f20)
INK_DIST = 40                        # how close a source pixel must be to count as ink
INK_OVER_AIR = 0.12                  # ink fraction that makes an otherwise-empty cell ink: masts, the stern's axis line
INK_AT_EDGE = 0.05                   # a body cell on the silhouette with this much line in it is outline: one clean cell all round
INK_IN_HULL = 0.26                   # an interior cell is ink when a line crosses it well: 1-px panel lines (dashed, like the drawing's stripes) and the plate's X strokes, no blobs (0.35 lost the X's)
SOLID = 0.5                          # opaque fraction that makes a cell part of the body
PALETTE_MIN = 0.002                  # a flat fill is a colour with at least this share of the opaque pixels

def dist2(a, b): return sum((x - y) ** 2 for x, y in zip(a[:3], b[:3]))

src = Image.open(SRC).convert("RGBA")
B = 13                                                    # block: the source scaled to a whole number of cells (1248 × 936)
big = src.resize((SPRITE_W * B, SPRITE_H * B), Image.LANCZOS)
px = big.load()

# the drawing's flat fills: frequent, opaque, not ink
cnt = Counter(p[:3] for p in src.getdata() if p[3] > 250)
total = sum(cnt.values())
palette = []
for c, n in cnt.most_common(200):
    if n < PALETTE_MIN * total: break
    if dist2(c, INK) < INK_DIST ** 2: continue
    if any(dist2(c, q) < 12 ** 2 for q in palette): continue   # antialiasing twins
    palette.append(c)
print("palette:", ["#%02x%02x%02x" % c for c in palette])

# pass 1: every cell's opaque / ink fractions and mean fill colour
cells = {}
for cy in range(SPRITE_H):
    for cx in range(SPRITE_W):
        n = solid = ink = 0; r = g = b = 0
        for y in range(cy * B, (cy + 1) * B):
            for x in range(cx * B, (cx + 1) * B):
                p = px[x, y]; n += 1
                if p[3] < 128: continue
                solid += 1
                if dist2(p, INK) < INK_DIST ** 2: ink += 1
                else: r += p[0]; g += p[1]; b += p[2]
        fill = solid - ink
        cells[cx, cy] = (solid / n, ink / n, (r / fill, g / fill, b / fill) if fill else None)
body = {c for c, (sf, kf, _) in cells.items() if sf >= SOLID}
# pass 2: decide each cell
out = Image.new("RGBA", (SPRITE_W, SPRITE_H), (0, 0, 0, 0))
op = out.load()
for (cx, cy), (sf, kf, mean) in cells.items():
    if (cx, cy) not in body:
        if kf >= INK_OVER_AIR: op[cx, cy] = INK + (255,)
        continue
    edge = any((cx + dx, cy + dy) not in body for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    if (edge and kf >= INK_AT_EDGE) or kf >= INK_IN_HULL or mean is None: op[cx, cy] = INK + (255,); continue
    op[cx, cy] = min(palette, key=lambda c: dist2(c, mean)) + (255,)

out.save(OUT)
# the stern's axis line: the ink rows in the sprite's last column
rows = [y for y in range(SPRITE_H) if op[SPRITE_W - 1, y][3] and op[SPRITE_W - 1, y][:3] == INK]
print(f"saved {OUT.relative_to(ROOT)} {out.size}; stern axis line in the last column at row(s) {rows}  → blimp.js PX_LINE_ROW")
if len(sys.argv) > 1:   # optional: a 5× preview on sky blue for eyeballing
    Z = 5   # preview zoom per cell
    prev = Image.new("RGBA", (SPRITE_W * Z * 2 + 30, SPRITE_H * Z + 20), (110, 178, 235, 255))
    prev.paste(out.resize((SPRITE_W * Z, SPRITE_H * Z), Image.NEAREST), (10, 10), out.resize((SPRITE_W * Z, SPRITE_H * Z), Image.NEAREST))
    small = src.resize((SPRITE_W * Z, SPRITE_H * Z), Image.LANCZOS)
    prev.paste(small, (SPRITE_W * Z + 20, 10), small)
    prev.save(sys.argv[1]); print("preview", sys.argv[1])
