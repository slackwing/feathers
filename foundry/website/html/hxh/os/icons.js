/* Pixel icons (hand-drawn ASCII grids → crisp integer-scaled SVG), emoji
   "sprites" (drawn tiny, quantised, upscaled), and the initials avatar. */
import { esc } from "./dom.js";

export const PAL = {
  k: "#0b0a08", p: "#e8dcc3", w: "#fff6e0", d: "#c4b48f", r: "#c8102e", h: "#ff2444",
  o: "#ff7518", g: "#58e05c", y: "#ffd166", b: "#37d0ff", n: "#9a9a9a",
  v: "#c8a2ff", u: "#7c4dff", N: "#1d3557", G: "#d9a520",
};

export const ICONS = {
  x: [
    "r......r",
    "rr....rr",
    ".rr..rr.",
    "..rrrr..",
    "..rrrr..",
    ".rr..rr.",
    "rr....rr",
    "r......r",
  ],
  pumpkin: [
    ".....gg.....",
    "....gg......",
    "..oooooooo..",
    ".oooooooooo.",
    "oookoooookoo",
    "ookkkookkkoo",
    "oooooooooooo",
    "ookoooooooko",
    "ookkkkkkkkoo",
    ".ookkkkkkoo.",
    ".oooooooooo.",
    "..oooooooo..",
  ],
  envelope: [
    "kkkkkkkkkkkkkkkk",
    "kppppppppppppppk",
    "kkppppppppppppkk",
    "kpkppppppppppkpk",
    "kppkppppppppkppk",
    "kpppkpprrppkpppk",
    "kppppkprrpkppppk",
    "kpppppkkkkpppppk",
    "kppppppppppppppk",
    "kppppppppppppppk",
    "kkkkkkkkkkkkkkkk",
  ],
  folder: [
    ".kkkkkkk........",
    ".kyyyyyyk.......",
    ".kyyyyyyykkkkkkk",
    ".kyyyyyyyyyyyyyk",
    ".kkkkkkkkkkkkkkk",
    ".kyyyyyyyyyyyyyk",
    ".kyyyyyyyyyyyyyk",
    ".kyyyyyyyyyyyyyk",
    ".kyyyyyyyyyyyyyk",
    ".kyyyyyyyyyyyyyk",
    ".kkkkkkkkkkkkkkk",
  ],
  card: [
    "kkkkkkkkkkkkkkkk",
    "kwwwwwwwwwwwwwwk",
    "kwrrrrrrrrrrrrwk",
    "kwwwwwwwwwwwwwwk",
    "kwbbbbwwkkkkkwwk",
    "kwbbbbwwwwwwwwwk",
    "kwbbbbwwkkkwwwwk",
    "kwwwwwwwwwwwwwwk",
    "kwwwwkkkkkkkwwwk",
    "kwwwwwwwwwwwwwwk",
    "kkkkkkkkkkkkkkkk",
  ],
  question: [
    "kkkkkkkkkkkk",
    "kyyyyyyyyyyk",
    "kyyykkkkyyyk",
    "kyykyyyykyyk",
    "kyyyyyyykyyk",
    "kyyyyyykyyyk",
    "kyyyyykyyyyk",
    "kyyyyykyyyyk",
    "kyyyyyyyyyyk",
    "kyyyyykyyyyk",
    "kyyyyyyyyyyk",
    "kkkkkkkkkkkk",
  ],
  db: [
    "..kkkkkkkkkk..",
    ".kbbbbbbbbbbk.",
    ".kbbbbbbbbbbk.",
    "..kkkkkkkkkk..",
    ".kbbbbbbbbbbk.",
    ".kbbbbbbbbbbk.",
    "..kkkkkkkkkk..",
    ".kbbbbbbbbbbk.",
    ".kbbbbbbbbbbk.",
    "..kkkkkkkkkk..",
  ],
  crt: [
    "kkkkkkkkkkkk",
    "kggggggggggk",
    "kgkkkkkkkkgk",
    "kggggggggggk",
    "kgkkkkkkkkgk",
    "kggggggggggk",
    "kkkkkkkkkkkk",
    "....kkkk....",
    "..kkkkkkkk..",
  ],
  hourglass: [
    "kkkkkkkk",
    ".kyyyyk.",
    ".kyyyyk.",
    "..kyyk..",
    "..kppk..",
    ".kpyypk.",
    ".kyyyyk.",
    "kkkkkkkk",
  ],
  // purple square's blocky violet tee (boot badge)
  tee: [
    ".uuuuuu....uuuuuu.",
    "uvvvvvvuuuuvvvvvvu",
    "uvvvvvvvvvvvvvvvvu",
    "uvvvvvvvvvvvvvvvvu",
    "uvvvvvvvvvvvvvvvvu",
    "uuuuuvvvvvvvvuuuuu",
    "....uvvvvvvvvu....",
    "....uvvvvvvvvu....",
    "....uvvvvvvvvu....",
    "....uvvvvvvvvu....",
    "....uvvvvvvvvu....",
    "....uvvvvvvvvu....",
    "....uvvvvvvvvu....",
    "....uuuuuuuuuu....",
  ],
  // the Greed Island style binder: navy boards, gold clasps, ring emblem
  book: [
    ".kkkkkkkkkkkkk..",
    ".kNNNNNNNNNNNkG.",
    ".kNNNNNNNNNNNkG.",
    ".kNNNgggNNNNNk..",
    ".kNNgNNNgNNNNk..",
    ".kNNNgggNNNNNk..",
    ".kNNNNNNNNNNNkG.",
    ".kNNNNNNNNNNNkG.",
    ".kNNNNNNNNNNNk..",
    ".kkkkkkkkkkkkk..",
  ],
  // a buddy-list figure; the "g" tint is overridden per presence state
  buddy: [
    "...kk...",
    "..kggk..",
    "..kggk..",
    "...kk...",
    ".kkggkk.",
    "kggggggk",
    "kggggggk",
    "kkkkkkkk",
  ],
  // the Beetle messenger's app icon: a green beetle, elytra split
  beetle: [
    "..k........k..",
    "...k......k...",
    "..kkkkkkkkkk..",
    ".kkggggggggkk.",
    "kkggggkkggggkk",
    "kgggkgkkgkgggk",
    "kgggggkkgggggk",
    "kkgkggkkggkgkk",
    ".kkggggggggkk.",
    "..kkkkkkkkkk..",
    "...k..kk..k...",
    "..k........k..",
  ],
  // a speech bubble (tray "new message" icon, chat app)
  comment: [
    ".kkkkkkkkkkkk.",
    "kwwwwwwwwwwwwk",
    "kwkwkwkwkwkwwk",
    "kwwwwwwwwwwwwk",
    "kwkwkwkwkwwwwk",
    "kwwwwwwwwwwwwk",
    ".kkkkkkkkwwwk.",
    "......kwwwk...",
    "......kwwk....",
    "......kkk.....",
  ],
  door: [
    "kkkkkkk...",
    "kpppppk...",
    "kpppppk...",
    "kpppppkrr.",
    "kpppkpkrrr",
    "kpppppkrr.",
    "kpppppk...",
    "kpppppk...",
    "kkkkkkk...",
  ],
};

/** Integer-scaled so pixels stay crisp: an 8-wide grid at size 16 is 2×. */
export function icon(name, size = 16, pal = null) {
  const rows = ICONS[name] || ICONS.x;
  const h = rows.length, w = rows[0].length;
  const k = Math.max(1, Math.floor(size / w));
  const colors = pal ? { ...PAL, ...pal } : PAL;
  let rects = "";
  rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (colors[c]) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${colors[c]}"/>`;
  }));
  return `<svg class="px" viewBox="0 0 ${w} ${h}" width="${w * k}" height="${h * k}" aria-hidden="true">${rects}</svg>`;
}

/** Pixel size of icon(name, size) — the grid's integer scale. */
export function iconScale(name, size = 16) {
  const rows = ICONS[name] || ICONS.x;
  return Math.max(1, Math.floor(size / rows[0].length));
}

/** Emoji drawn on a tiny canvas and upscaled nearest-neighbour = a pixel sprite. */
export function sprite(emoji, n = 16) {
  const c = document.createElement("canvas");
  c.className = "px"; c.width = n; c.height = n;
  const g = c.getContext?.("2d");
  if (!g) return c;   // no canvas (tests): an empty sprite
  g.font = `${Math.round(n * 0.8)}px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif`;
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(emoji, n / 2, n / 2 + n * 0.06);
  // Kill anti-aliasing and snap to the 216-colour web palette so it reads
  // as pixel art rather than a blurry upscale.
  const d = g.getImageData(0, 0, n, n), px = d.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 110) { px[i + 3] = 0; continue; }
    px[i + 3] = 255;
    px[i] = Math.round(px[i] / 51) * 51;
    px[i + 1] = Math.round(px[i + 1] / 51) * 51;
    px[i + 2] = Math.round(px[i + 2] / 51) * 51;
  }
  g.putImageData(d, 0, 0);
  return c;
}

/** Ink on pale colours, cream on dark — the rv admin page's luminance rule. */
export function textColorFor(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || "")) return "#fff6e0";
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 170 ? "#0b0a08" : "#fff6e0";
}

/** Circular initials avatar from the shared-auth profile (initial + color). */
export function avatar(acct, cls = "") {
  const color = acct?.color || "#9a9a9a";
  return `<span class="avatar ${cls}" style="--c:${esc(color)};--t:${textColorFor(color)}" title="${esc(acct?.display_name || "")}">${esc(acct?.initial || "?")}</span>`;
}
