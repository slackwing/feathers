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
  // the binder's heart: "I like this character!" — red, ink-edged, a highlight on the left lobe
  heart: [
    "................",
    "..kkkk....kkkk..",
    ".krrrrk..krrrrk.",
    "krhrrrrkkrrrrrrk",
    "krhhrrrrrrrrrrrk",
    "krrrrrrrrrrrrrrk",
    "krrrrrrrrrrrrrrk",
    "krrrrrrrrrrrrrrk",
    ".krrrrrrrrrrrrk.",
    "..krrrrrrrrrrk..",
    "...krrrrrrrrk...",
    "....krrrrrrk....",
    ".....krrrrk.....",
    "......krrk......",
    ".......kk.......",
    "................",
  ],
  // the heart as a rubber stamp would print it: the outline only, ink-red, two pixels thick
  "heart-stamp": [
    "................",
    "..rrrr....rrrr..",
    ".rrrrrr..rrrrrr.",
    "rrr..rrrrrr..rrr",
    "rr....rrrr....rr",
    "rr............rr",
    "rr............rr",
    "rr............rr",
    ".rr..........rr.",
    "..rr........rr..",
    "...rr......rr...",
    "....rr....rr....",
    ".....rr..rr.....",
    "......rrrr......",
    ".......rr.......",
    "................",
  ],
  // the binder's bookmark: "Bookmark for myself" — a gold ribbon with a notched tail
  bookmark: [
    "................",
    "...kkkkkkkkkk...",
    "...kGGGGGGGGk...",
    "...kGyyyyyyGk...",
    "...kGyyyyyyGk...",
    "...kGyyyyyyGk...",
    "...kGyyyyyyGk...",
    "...kGyyyyyyGk...",
    "...kGyyyyyyGk...",
    "...kGyyyyyyGk...",
    "...kGyyyyyyGk...",
    "...kGyykkyyGk...",
    "...kGykk.kkyGk..",
    "...kkk....kkk...",
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
    ".kqNNNggggNNNk..",
    ".kqNNgNNNNgNNk..",
    ".kqNNgNNNNgNNk..",
    ".kqNNgNNNNgNNk..",
    ".kqNNNggggNNNk..",
    ".kqNNNNNNNNNNk..",
    ".kqNNNNNNNNNNkG.",
    ".kqNNNNNNNNNNkG.",
    ".kkkkkkkkkkkkk..",
    "................",
    "................",
  ],
  // Beetle: the Beetle 07 phone from the show — black head with two antennae,
  // rounded red shell split down the middle. Drawn 15 wide, mirror-symmetric
  // about column 7 (Abi noticed one wing was bigger); column 15 stays empty
  beetle: [
    "................",
    "...k.......k....",
    "....k.....k.....",
    ".....kkkkk......",
    "....kkkkkkk.....",
    "...khrrkrrhk....",
    "..khrrrkrrrhk...",
    ".khrrrrkrrrrhk..",
    ".krrrrrkrrrrrk..",
    ".krrrrrkrrrrrk..",
    "..krrrrkrrrrk...",
    "...krrrkrrrk....",
    "....kkkkkkk.....",
    "..k..k...k..k...",
    ".k...k...k...k..",
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
    "................",
    ".k.k.k.k.k.k.k..",
    "................",
    ".k...........k..",
    "................",
    ".k...........k..",
    "................",
    ".k...........k..",
    "................",
    ".k...........k..",
    "................",
    ".k...........k..",
    "................",
    ".k.k.k.k.k.k.k..",
    "................",
    "................",
  ],
  brush: [
    "............kkk.",
    "...........kyyk.",
    "..........kyyyk.",
    ".........kyyyk..",
    "........kyyyk...",
    ".......kyyyk....",
    "......kkkkk.....",
    ".....knnnk......",
    "....knnnnk......",
    "...kkkkkkk......",
    "..kkkkkkk.......",
    ".kkkkkkk........",
    "kkkkkkk.........",
    "kkkkk...........",
    "kkk.............",
    "................",
  ],
  bucket: [
    "..........kkkk..",
    ".........k....k.",
    "........k......k",
    ".......kkkkkk..k",
    "......kwwwwwwk.k",
    ".....kwwwwwwk.k.",
    "....kwwwwwwk....",
    "...kwwwwwwk.....",
    "..kwwwwwwk......",
    ".kwwwwwwk.......",
    ".kkkkkkk........",
    "bb..............",
    "bbbb............",
    "bbbbb...........",
    ".bbbb...........",
    "..bb............",
  ],
  dropper: [
    "...........kkkk.",
    "..........kkkkkk",
    "..........kkkkkk",
    ".........kkkkkkk",
    "........kbkkkkk.",
    ".......kbbkkkk..",
    "......kbbbk.....",
    ".....kbbbk......",
    "....kbbbk.......",
    "...kbbbk........",
    "..kbbbk.........",
    ".kbbbk..........",
    "kkbbk...........",
    "kkkk............",
    "kk..............",
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
  // Beetle compose tools: paste what the clipboard holds
  clipboard: [
    "......kkkk......",
    ".....kkppkk.....",
    "..kkkkkppkkkkk..",
    "..kwwkkkkkkwwk..",
    "..kwwwwwwwwwwk..",
    "..kwkkkkkkkkwk..",
    "..kwwwwwwwwwwk..",
    "..kwkkkkkkkwwk..",
    "..kwwwwwwwwwwk..",
    "..kwkkkkkkkkwk..",
    "..kwwwwwwwwwwk..",
    "..kwkkkkkwwwwk..",
    "..kwwwwwwwwwwk..",
    "..kkkkkkkkkkkk..",
    "................",
    "................",
  ],
  // Beetle compose tools: a picture
  picture: [
    "................",
    ".kkkkkkkkkkkkkk.",
    ".kbbbbbbbbbbbbk.",
    ".kbbbbbbbbyybbk.",
    ".kbbbbbbbbyybbk.",
    ".kbbbbbbbbbbbbk.",
    ".kbbbbgbbbbbbbk.",
    ".kbbbgggbbbbbbk.",
    ".kbbgggggbbggbk.",
    ".kbgggggggggggk.",
    ".kggggggggggggk.",
    ".kggggggggggggk.",
    ".kkkkkkkkkkkkkk.",
    "................",
    "................",
    "................",
  ],
  // Beetle compose tools: emoji
  smile: [
    "................",
    ".....kkkkkk.....",
    "...kkyyyyyykk...",
    "..kyyyyyyyyyyk..",
    ".kyyyyyyyyyyyyk.",
    ".kyykkyyyykkyyk.",
    ".kyyyyyyyyyyyyk.",
    ".kyyyyyyyyyyyyk.",
    ".kyyyyyyyyyyyyk.",
    ".kykyyyyyyyykyk.",
    ".kyykyyyyyykyyk.",
    ".kyyykkkkkkyyyk.",
    "..kyyyyyyyyyyk..",
    "...kkyyyyyykk...",
    ".....kkkkkk.....",
    "................",
  ],
  // Settings: a gear (generated: ring, eight teeth, a hole, ink edge)
  gear: [
    "................",
    "......kkkk......",
    "...kk.knnk.kk...",
    "..kkkkknnkkkkk..",
    "..kknnnnnnnnkk..",
    "...knkkkkkknk...",
    ".kkknk....knkkk.",
    ".knnnk....knnnk.",
    ".knnnk....knnnk.",
    ".kkknk....knkkk.",
    "...knkkkkkknk...",
    "..kknnnnnnnnkk..",
    "..kkkkknnkkkkk..",
    "...kk.knnk.kk...",
    "......kkkk......",
    "................",
  ],
  // Settings › Sounds: a speaker
  sound: [
    "................",
    "........k.......",
    ".......kk.k.....",
    "......knk..k.k..",
    ".....knnk.k.k.k.",
    ".kkkkknnk..k.k.k",
    ".knnnnnnk..k.k.k",
    ".knnnnnnk..k.k.k",
    ".knnnnnnk..k.k.k",
    ".knnnnnnk..k.k.k",
    ".kkkkknnk..k.k.k",
    ".....knnk.k.k.k.",
    "......knk..k.k..",
    ".......kk.k.....",
    "........k.......",
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

/* ---------- vector icons (smooth, standard) ----------
   The Roster DB's crop / paint tools use ordinary editor icons, not
   pixel art (Andrew, 2026-09-21: the paint bucket and friends looked
   nothing like standard icons). Feather-style: 24×24, 2 px strokes in
   currentColor. */
export const VICONS = {
  marquee: `<rect x="4" y="4" width="16" height="16" rx="1.5" stroke-dasharray="3.2 2.2"/>`,
  brush: `<path d="M20.5 3.5 21 4l-8.6 8.6-1-1z" fill="currentColor" stroke="none"/><path d="M13.5 10.5 3.9 20.1M9.3 14.9c1.2 1.2 1.3 3 .3 4.1S6 20.3 4.5 19.5c1-1 1.2-2.4 2-3.4 1-1.2 1.6-1.6 2.8-1.2z" fill="currentColor"/>`,
  bucket: `<path d="M11.5 3.5 20 12l-7.5 7.5a1 1 0 0 1-1.4 0L4.5 12.9a1 1 0 0 1 0-1.4z"/><path d="M5 12h14"/><path d="M11.5 3.5 8.5 6.5"/><path d="M20 15c0 0 2.5 2.7 2.5 4.3a2.5 2.5 0 0 1-5 0C17.5 17.7 20 15 20 15z" fill="currentColor"/>`,
  dropper: `<path d="M17.5 3.5a2.1 2.1 0 0 1 3 3l-2 2-3-3z" fill="currentColor"/><path d="M15.5 5.5l3 3M14.5 6.5 5 16l-1 4 4-1 9.5-9.5"/>`,
  undo: `<path d="M9 6 4 11l5 5"/><path d="M4 11h9.5a5.5 5.5 0 0 1 0 11H10"/>`,
  redo: `<path d="m15 6 5 5-5 5"/><path d="M20 11h-9.5a5.5 5.5 0 0 0 0 11H14"/>`,
  revert: `<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>`,
  expand: `<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><path d="M4 4l6 6M20 4l-6 6M20 20l-6-6M4 20l6-6"/>`,
  crop: `<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M2 6h14a2 2 0 0 1 2 2v14"/>`,
};

/** A smooth 24-grid icon at `size` px, drawn in currentColor (no `.px` class: these are not pixel art). */
export function vicon(name, size = 16) {
  const body = VICONS[name];
  if (!body) return icon(name, size);
  return `<svg class="vi" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/** Any ASCII grid → crisp SVG at an integer scale k (sprites that are not icons: the blimp). */
export function gridSVG(rows, k = 1, pal = null, cls = "px") {
  const h = rows.length, w = rows[0].length;
  const colors = pal ? { ...PAL, ...pal } : PAL;
  let rects = "";
  rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (colors[c]) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${colors[c]}"/>`;
  }));
  return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" width="${w * k}" height="${h * k}" aria-hidden="true">${rects}</svg>`;
}

/** Integer-scaled so pixels stay crisp: a 16-wide grid at size 16 is 1×, at 48 is 3×. */
export function icon(name, size = 16, pal = null) {
  const rows = ICONS[name] || ICONS.x;
  return gridSVG(rows, Math.max(1, Math.floor(size / rows[0].length)), pal);
}

/** Does `name` exist as a 16×16 grid — i.e. can it draw both the 16 px
    (taskbar, tray, menus, title bars) and the 48 px (desktop) size? Every
    registered app must pass this: one grid IS the icon pair. */
export function hasIconPair(name) {
  const rows = ICONS[name];
  return !!rows && rows.length === 16 && rows.every(r => r.length === 16);
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
