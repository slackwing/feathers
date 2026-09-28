import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { icon, iconScale, sprite, textColorFor, avatar, ICONS, PAL } from "../html/hxh/os/icons.js";

setupDom();

test("every icon grid is rectangular and uses palette letters only", () => {
  for (const [name, rows] of Object.entries(ICONS)) {
    const w = rows[0].length;
    assert.ok(rows.every(r => r.length === w), `${name} is ragged`);
    for (const r of rows) for (const c of r) assert.ok(c === "." || PAL[c], `${name}: unknown colour "${c}"`);
  }
});

test("icon renders an integer-scaled SVG with one rect per painted pixel", () => {
  const svg = icon("x", 16);
  assert.match(svg, /^<svg class="px" viewBox="0 0 16 16" width="16" height="16"/);
  const painted = ICONS.x.join("").replace(/\./g, "").length;
  assert.equal((svg.match(/<rect /g) || []).length, painted);
  assert.equal(iconScale("x", 16), 1);          // small icons: one screen pixel per art pixel
  assert.equal(iconScale("x", 48), 3);          // desktop icons: 3×, about half the wallpaper's 5
  assert.equal(iconScale("pumpkin", 24), 2);   // the Start button's pumpkin stays chunky: 12 wide → 2×
  assert.equal(iconScale("tee", 72), 4);
});

test("the icon rule: every icon is a 16×16 grid, except the pumpkin and the boot tee", () => {
  const odd = { pumpkin: "12x12", tee: "18x14" };
  for (const [name, rows] of Object.entries(ICONS)) {
    const dims = `${rows[0].length}x${rows.length}`;
    assert.equal(dims, odd[name] || "16x16", `${name} is ${dims}`);
  }
  // so every small icon lands at the same 16 px and every desktop icon at the same 48 px
  for (const name of ["x", "envelope", "beetle", "book", "db", "hourglass", "question", "crt", "comment", "door"]) {
    assert.match(icon(name, 16), /width="16" height="16"/);
    assert.match(icon(name, 48), /width="48" height="48"/);
  }
});

test("unknown icons fall back to ×; palettes can be overridden", () => {
  assert.equal(icon("nope"), icon("x"));
  assert.match(icon("x", 16, { r: "#fff6e0" }), /fill="#fff6e0"/);
  assert.doesNotMatch(icon("x", 16, { r: "#fff6e0" }), /#c8102e/);
});

test("sprite survives a host without canvas", () => {
  const c = sprite("🎃", 16);
  assert.equal(c.tagName, "CANVAS");
  assert.equal(c.width, 16);
});

test("textColorFor flips to ink on pale colours", () => {
  assert.equal(textColorFor("#ffffff"), "#0b0a08");
  assert.equal(textColorFor("#000000"), "#fff6e0");
  assert.equal(textColorFor("nope"), "#fff6e0");
});

test("avatar carries the initial, colour and escaped name", () => {
  const a = avatar({ initial: "AC", color: "#d914e3", display_name: "<A>" }, "lg");
  assert.match(a, /class="avatar lg"/);
  assert.match(a, /--c:#d914e3/);
  assert.match(a, /title="&lt;A&gt;"/);
  assert.match(a, />AC</);
  assert.match(avatar(null), />\?</);
});

test("desktop icons: every desktop app has a 20×20 grid in DESK, palette letters only, drawn at 3× = 60 px; an app without one falls back to its 16-grid at 3× (Andrew, 2026-09-27: 25% larger, same pixel granularity)", async () => {
  const { DESK, DESK_SCALE, DESK_GRID, desktopIcon } = await import("../html/hxh/os/icons.js");
  assert.equal(DESK_SCALE, 3, "the same 3 px cells as before");
  assert.equal(DESK_GRID * DESK_SCALE, 60, "25% larger than the old 48");
  for (const [name, rows] of Object.entries(DESK)) {
    assert.equal(`${rows[0].length}x${rows.length}`, "20x20", `${name}`);
    assert.ok(rows.every(r => r.length === 20), `${name} is ragged`);
    for (const r of rows) for (const c of r) assert.ok(c === "." || PAL[c], `${name}: unknown colour "${c}"`);
    assert.match(desktopIcon(name), /viewBox="0 0 20 20" width="60" height="60"/);
    assert.ok(ICONS[name], `${name} also has its 16-grid for the taskbar, tray and menus`);
  }
  for (const name of ["envelope", "book", "beetle", "arena", "db", "tools"]) assert.ok(DESK[name], `the ${name} desktop app has a 20-grid`);
  // every desktop app on the page has one: a 16-grid fallback draws 48 px among 60s and looks shrunken
  const fs = await import("node:fs"), path = await import("node:path");
  const appsDir = new URL("../html/hxh/apps/", import.meta.url).pathname;
  const files = fs.readdirSync(appsDir, { recursive: true }).filter(f => f.endsWith(".js")).map(f => fs.readFileSync(path.join(appsDir, f), "utf8"));
  for (const src of files) {
    const icon = src.match(/static icon = "([^"]+)"/)?.[1];
    if (!icon || /static desktop = false/.test(src)) continue;
    assert.ok(DESK[icon], `the desktop app with icon "${icon}" needs a 20×20 grid in DESK`);
  }
  assert.match(desktopIcon("door"), /width="48" height="48"/, "no 20-grid: its 16-grid at 3×");
  // the binder is a tall cover and the Beetle a tall egg, both at 20 and at 16
  const bbox = rows => { const ys = rows.map((r, y) => /[^.]/.test(r) ? y : -1).filter(y => y >= 0); const xs = rows.flatMap(r => [...r].map((c, x) => c !== "." ? x : -1)).filter(x => x >= 0); return { w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 }; };
  for (const g of [DESK.book, ICONS.book]) { const b = bbox(g.map(r => r.replace(/G/g, "."))); assert.ok(b.h > b.w * 1.3, `the binder is taller than wide (${b.w}×${b.h})`); }
});

test("the Beetle and the game pad are mirror-symmetric in outline at both sizes (Andrew, 2026-09-27: the antenna off-centre, the D-pad lopsided)", async () => {
  const { DESK } = await import("../html/hxh/os/icons.js");
  const shape = rows => rows.map(r => [...r].map(c => c === "." ? "." : "#").join(""));
  const mirrored = rows => { const sh = shape(rows); const xs = sh.flatMap(r => [...r].map((c, x) => c === "#" ? x : -1)).filter(x => x >= 0); const lo = Math.min(...xs), hi = Math.max(...xs);
    return sh.every(r => { for (let x = lo; x <= hi; x++) if (r[x] !== r[lo + hi - x]) return false; return true; }); };
  for (const [set, g] of [["DESK", DESK], ["ICONS", ICONS]]) for (const name of ["beetle", "arena"]) assert.ok(mirrored(g[name]), `${set}.${name} is lopsided`);
  // and the pad's controls sit symmetrically: the D-pad's arms are equal, the D-pad and the buttons equally far from the middle
  const pad = DESK.arena, cells = ch => pad.flatMap((r, y) => [...r].map((c, x) => c === ch ? [x, y] : null)).filter(Boolean);
  const d = cells("s"), xs = d.map(p => p[0]), ys = d.map(p => p[1]);
  const mid = v => (Math.min(...v) + Math.max(...v)) / 2;
  // the buttons: every coloured cell right of the middle (not the outline, the body or the grey pills)
  const btn = pad.flatMap((r, y) => [...r].map((c, x) => x >= 10 && !".kLP".includes(c) ? [x, y] : null)).filter(Boolean);
  assert.equal(mid(ys), mid(btn.map(p => p[1])), "D-pad and buttons share a middle row");
  assert.equal(mid(xs) + mid(btn.map(p => p[0])), 19, "D-pad and buttons mirror about the pad's middle");
  // the four Super Famicom colours, one each — blue, green, red, gold — and every button edged dark enough to stand off the pale body
  // (Andrew, 2026-09-28: "why are there two green buttons" — X was a pale cyan beside the green — "give them better contrast")
  const { PAL } = await import("../html/hxh/os/icons.js");
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const hue = hex => { const [r, g, b] = rgb(hex), mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
    return 60 * (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4); };
  const lum = hex => { const [r, g, b] = rgb(hex).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b; };
  const ratio = (a, b) => { const [lo, hi] = [lum(a), lum(b)].sort((x, y) => x - y); return (hi + .05) / (lo + .05); };
  const want = { X: [200, 250], Y: [100, 160], A: [335, 375], B: [35, 60] };   // blue, green, red (wrapping past 360), gold
  for (const [name, [x, y]] of Object.entries({ X: [14, 7], Y: [12, 9], A: [16, 9], B: [14, 11] })) {
    const four = [pad[y][x], pad[y][x + 1], pad[y + 1][x], pad[y + 1][x + 1]].map(c => PAL[c]);   // a 2×2: light, main, main, shadow
    const hh = hue(four[1]), h2 = hh < 90 && want[name][1] > 360 ? hh + 360 : hh;
    assert.ok(h2 >= want[name][0] && h2 <= want[name][1], `${name} (${four[1]}) is off its colour: hue ${hh.toFixed(0)}`);
    assert.ok(ratio(four[3], PAL.L) >= 3, `${name}'s shadow ${four[3]} is too faint on the body`);
    assert.ok(ratio(four[1], PAL.L) >= 1.5, `${name}'s face ${four[1]} is too faint on the body`);
  }
});

test("the Binder's desktop icon is 2 px shorter at the bottom, its lower gold tab up with it; the tools icon replaces the bug at both sizes (Andrew, 2026-09-27)", async () => {
  const { DESK, ICONS } = await import("../html/hxh/os/icons.js");
  const book = DESK.book, rows = book.map((r, i) => [r, i]);
  const drawn = rows.filter(([r]) => /[^.]/.test(r)).map(([, i]) => i);
  assert.equal(book.length, 20);
  assert.deepEqual([drawn[0], drawn.at(-1)], [0, 17], "the cover ends 2 rows higher, the top unmoved");
  const gold = rows.filter(([r]) => r.includes("G")).map(([, i]) => i);
  assert.deepEqual(gold, [3, 4, 5, 12, 13, 14], "the lower tab up by 2");
  assert.ok(!DESK.bug && !ICONS.bug, "no bug icon left");
  for (const g of [ICONS.tools, DESK.tools]) assert.ok(g && g.every(r => r.length === g.length) && /t/.test(g.join("")) && /n/.test(g.join("")), "a wooden handle and steel");
});

test("desktop icons fill a column down to just above the taskbar, then wrap into the next; resizing reflows them (Andrew, 2026-09-27)", async () => {
  const fs = await import("node:fs");
  const css = fs.readFileSync(new URL("../html/hxh/os/os.css", import.meta.url), "utf8");
  const rule = css.match(/\n\.icons \{[^}]*\}/)[0];
  assert.match(rule, /flex-direction: column/);
  assert.match(rule, /flex-wrap: wrap/);
  assert.match(rule, /max-height: calc\(100svh \/ var\(--zoom\) - var\(--taskbar-h\)/, "bounded by the visible desktop above the taskbar");
});
