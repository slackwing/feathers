/* Pixel icons (hand-drawn ASCII grids → crisp integer-scaled SVG), emoji
   "sprites" (drawn tiny, quantised, upscaled), and the initials avatar.
   Read ICON SIZES below before adding an icon. */
import { esc } from "./dom.js";

export const PAL = {
  k: "#0b0a08", p: "#e8dcc3", w: "#fff6e0", d: "#c4b48f", r: "#c8102e", h: "#ff2444",
  o: "#ff7518", g: "#58e05c", y: "#ffd166", b: "#37d0ff", n: "#9a9a9a",
  v: "#c8a2ff", u: "#7c4dff", N: "#1d3557", G: "#d9a520",
  m: "#8e0b21", s: "#5a5652", t: "#7a4a1e", l: "#9ad9ff", e: "#2fb54a", a: "#ffe9a8", q: "#12213a",
};

/* ICON SIZES — the OS's icon rule (Andrew, 2026-09-19): every icon is a
   16×16 grid. Small icons (taskbar buttons, tray, menus, title bars) draw
   it at 16 px = one screen pixel per art pixel, "full resolution"; desktop
   icons draw it at 48 px = 3 px per art pixel, about half the wallpaper's
   5 px whale scale; text sits between the two. Two exceptions: the Start
   button's pumpkin (12×12 at 2×) and the boot badge's tee (18×14 at 4×). */

export const ICONS = {
  // the Hunter × Halloween ×, after the show's logo: a bold red cross, ink-edged
  x: [
    "rrrk........krrr",
    "rrrkk......kkrrr",
    "krrrkk....kkrrrk",
    "kkrrrkk..kkrrrkk",
    ".kkrrrkkkkrrrkk.",
    "..kkrrrkkrrrkk..",
    "...kkrrrrrrkk...",
    "....kkrrrrkk....",
    "....kkrrrrkk....",
    "...kkrrrrrrkk...",
    "..kkrrrkkrrrkk..",
    ".kkrrrkkkkrrrkk.",
    "kkrrrkk..kkrrrkk",
    "krrrkk....kkrrrk",
    "rrrkk......kkrrr",
    "rrrk........krrr",
  ],
  // the Start button's pumpkin — the one icon that stays chunky (12×12, drawn 2×)
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
    "................",
    "................",
    "kkkkkkkkkkkkkkkk",
    "kppppppppppppppk",
    "kkppppppppppppkk",
    "kpkppppppppppkpk",
    "kppkppppppppkppk",
    "kpppkpprrppkpppk",
    "kppppkprrpkppppk",
    "kpppppkkkkpppppk",
    "kppppppppppppppk",
    "kpppppppppppppdk",
    "kkkkkkkkkkkkkkkk",
    "................",
    "................",
    "................",
  ],
  folder: [
    "................",
    "................",
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
    "................",
    "................",
    "................",
  ],
  card: [
    "................",
    "................",
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
    "................",
    "................",
    "................",
  ],
  // About: a bevelled yellow help block
  question: [
    "kkkkkkkkkkkkkkkk",
    "kaaaaaaaaaaaaaGk",
    "kayyyyyyyyyyyyGk",
    "kayyyykkkkkyyyGk",
    "kayyykkyyykkyyGk",
    "kayyykkyyykkyyGk",
    "kayyyyyyyykkyyGk",
    "kayyyyyyykkyyyGk",
    "kayyyyyykkyyyyGk",
    "kayyyyyykkyyyyGk",
    "kayyyyyyyyyyyyGk",
    "kayyyyyykkyyyyGk",
    "kayyyyyykkyyyyGk",
    "kayyyyyyyyyyyyGk",
    "kaGGGGGGGGGGGGGk",
    "kkkkkkkkkkkkkkkk",
  ],
  // Roster DB: a stack of discs
  db: [
    "....kkkkkkkk....",
    "..kkllllllllkk..",
    ".kllllllllllllk.",
    ".kbbbbbbbbbbbbk.",
    ".kbbbbbbbbbbbbk.",
    ".kkkkkkkkkkkkkk.",
    ".kllllllllllllk.",
    ".kbbbbbbbbbbbbk.",
    ".kbbbbbbbbbbbbk.",
    ".kkkkkkkkkkkkkk.",
    ".kllllllllllllk.",
    ".kbbbbbbbbbbbbk.",
    ".kbbbbbbbbbbbbk.",
    "..kkbbbbbbbbkk..",
    "....kkkkkkkk....",
    "................",
  ],
  // Scanlines: a CRT with a green raster
  crt: [
    ".kkkkkkkkkkkkkk.",
    "kddddddddddddddk",
    "kdkkkkkkkkkkkkdk",
    "kdkggggggggggkdk",
    "kdkeeeeeeeeeekdk",
    "kdkggggggggggkdk",
    "kdkeeeeeeeeeekdk",
    "kdkggggggggggkdk",
    "kdkeeeeeeeeeekdk",
    "kdkkkkkkkkkkkkdk",
    "kddddddddddddddk",
    ".kkkkkkkkkkkkkk.",
    "......kddk......",
    "....kkkkkkkk....",
    "...kddddddddk...",
    "...kkkkkkkkkk...",
  ],
  // Register: sand running
  hourglass: [
    ".kkkkkkkkkkkkkk.",
    ".kttttttttttttk.",
    ".kkkkkkkkkkkkkk.",
    "..kwwwwwwwwwwk..",
    "..kwwwwwwwwwwk..",
    "...kwyyyyyywk...",
    "....kyyyyyyk....",
    ".....kayyak.....",
    "......kyyk......",
    "......kwyk......",
    ".....kwyywk.....",
    "....kwyyyywk....",
    "...kwyyyyyywk...",
    "..kyyyyyyyyyyk..",
    ".kttttttttttttk.",
    ".kkkkkkkkkkkkkk.",
  ],
  // purple square's blocky violet tee (boot badge, 18×14 drawn 4×)
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
    "................",
    ".kkkkkkkkkkkkk..",
    ".kqNNNNNNNNNNkG.",
    ".kqNNNNNNNNNNkG.",
    ".kqNNNNNNNNNNk..",
    ".kqNNNNgggNNNk..",
    ".kqNNNgNNNgNNk..",
    ".kqNNNgNNNgNNk..",
    ".kqNNNNgggNNNk..",
    ".kqNNNNNNNNNNk..",
    ".kqNNNNNNNNNNkG.",
    ".kqNNNNNNNNNNkG.",
    ".kqNNNNNNNNNNk..",
    ".kkkkkkkkkkkkk..",
    "................",
    "................",
  ],
  // Beetle: the Beetle 07 phone from the show — black head with two antennae,
  // rounded red shell split down the middle, a cream highlight
  beetle: [
    "................",
    "...k........k...",
    "....k......k....",
    ".....kkkkkk.....",
    "....kkkkkkkk....",
    "...khrrrkrrrhk..",
    "..kwhrrrkrrrhk..",
    "..kwrrrrkrrrrk..",
    "..khrrrrkrrrrk..",
    "..khrrrrkrrrrk..",
    "...krrrrkrrrk...",
    "...kkrrrkrrkk...",
    "....kkkkkkkk....",
    "...k..k..k..k...",
    "..k...k..k...k..",
    "................",
  ],
  // a speech bubble (tray "new message" icon, chat app)
  comment: [
    "................",
    "................",
    "................",
    "..kkkkkkkkkkkk..",
    ".kwwwwwwwwwwwwk.",
    ".kwkwkwkwkwkwwk.",
    ".kwwwwwwwwwwwwk.",
    ".kwkwkwkwkwwwwk.",
    ".kwwwwwwwwwwwwk.",
    "..kkkkkkkkwwwk..",
    ".......kwwwk....",
    ".......kwwk.....",
    ".......kkk......",
    "................",
    "................",
    "................",
  ],
  // Roster DB crop tools
  // Log out: a door and the way out
  crop: [
    "...k........k...",
    "...k........k...",
    "...k........k...",
    "kkkkkkkkkkkkkkkk",
    "...kppppppppk...",
    "...kppppppppk...",
    "...kppppppppk...",
    "...kpppkkpppk...",
    "...kpppkkpppk...",
    "...kppppppppk...",
    "...kppppppppk...",
    "...kppppppppk...",
    "kkkkkkkkkkkkkkkk",
    "...k........k...",
    "...k........k...",
    "...k........k...",
  ],
  marquee: [
    "kk.kk.kk.kk.kk.k",
    "................",
    "k..............k",
    "k..............k",
    "................",
    "k..............k",
    "k..............k",
    "................",
    "k..............k",
    "k..............k",
    "................",
    "k..............k",
    "k..............k",
    "................",
    "k..............k",
    "k.kk.kk.kk.kk.kk",
  ],
  brush: [
    "..............kk",
    ".............kyk",
    "............kyyk",
    "...........kyyk.",
    "..........kyyk..",
    ".........kyyk...",
    "........kyyk....",
    ".......kyyk.....",
    "......kkkk......",
    ".....krrrk......",
    "....krrrrk......",
    "...krrrrk.......",
    "..krrrrk........",
    ".krrrrk.........",
    "kkkkkk..........",
    "................",
  ],
  bucket: [
    "................",
    "......kkkk......",
    ".....kppppk.....",
    "....kppppppk....",
    "...kkkkkkkkkk...",
    "...kppppppppk...",
    "...kppppppppk...",
    "...kppppppppk...",
    "....kppppppk....",
    "....kppppppk....",
    ".....kppppk.....",
    ".....kkkkkk.....",
    "..........bb....",
    ".........bbbb...",
    ".........bbbb...",
    "..........bb....",
  ],
  dropper: [
    "............kkkk",
    "...........kkkkk",
    "..........kkkkkk",
    ".........kbkkkk.",
    "........kbbkkk..",
    ".......kbbbk....",
    "......kbbbk.....",
    ".....kbbbk......",
    "....kbbbk.......",
    "...kbbbk........",
    "..kbbbk.........",
    ".kbbbk..........",
    "kbbbk...........",
    "kbbk............",
    "kkk.............",
    "................",
  ],
  undo: [
    "................",
    "................",
    "....k...........",
    "...kk...........",
    "..kkkkkkkkkk....",
    ".kkkkkkkkkkkkk..",
    "..kkkk.....kkkk.",
    "...kk........kk.",
    "....k.........kk",
    "..............kk",
    ".............kkk",
    "........kkkkkk..",
    "................",
    "................",
    "................",
    "................",
  ],
  redo: [
    "................",
    "................",
    "...........k....",
    "...........kk...",
    "....kkkkkkkkkk..",
    "..kkkkkkkkkkkkk.",
    ".kkkk.....kkkk..",
    ".kk........kk...",
    "kk.........k....",
    "kk..............",
    "kkk.............",
    "..kkkkkk........",
    "................",
    "................",
    "................",
    "................",
  ],
  revert: [
    "................",
    ".....kkkkkk.....",
    "...kkk....kkk...",
    "..kk........kk.k",
    ".kk..........kkk",
    ".k..........kkkk",
    "................",
    "................",
    "................",
    "................",
    "kkkk..........k.",
    "kkk..........kk.",
    "k.kk........kk..",
    "...kkk....kkk...",
    ".....kkkkkk.....",
    "................",
  ],
  expand: [
    ".......kk.......",
    "......kkkk......",
    ".....kkkkkk.....",
    ".......kk.......",
    ".......kk.......",
    "..k..........k..",
    ".kk..........kk.",
    "kkkkk......kkkkk",
    ".kk..........kk.",
    "..k..........k..",
    ".......kk.......",
    ".......kk.......",
    ".....kkkkkk.....",
    "......kkkk......",
    ".......kk.......",
    "................",
  ],
  door: [
    "kkkkkkkkkk......",
    "kppppppppk......",
    "kpkkkkkkpk......",
    "kpkddddkpk......",
    "kpkddddkpk......",
    "kpkddddkpk..k...",
    "kpkddddkpk..kk..",
    "kpkddddkpkkkkkk.",
    "kpkddskkpkrrrrrk",
    "kpkddddkpkkkkkk.",
    "kpkddddkpk..kk..",
    "kpkddddkpk..k...",
    "kpkddddkpk......",
    "kpkkkkkkpk......",
    "kppppppppk......",
    "kkkkkkkkkk......",
  ],
};

/** Integer-scaled so pixels stay crisp: a 16-wide grid at size 16 is 1×, at 48 is 3×. */
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
