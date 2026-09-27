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
  for (const name of ["envelope", "book", "beetle", "arena", "db"]) assert.ok(DESK[name], `the ${name} desktop app has a 20-grid`);
  assert.match(desktopIcon("door"), /width="48" height="48"/, "no 20-grid: its 16-grid at 3×");
  // the binder is a tall cover and the Beetle a tall egg, both at 20 and at 16
  const bbox = rows => { const ys = rows.map((r, y) => /[^.]/.test(r) ? y : -1).filter(y => y >= 0); const xs = rows.flatMap(r => [...r].map((c, x) => c !== "." ? x : -1)).filter(x => x >= 0); return { w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 }; };
  for (const g of [DESK.book, ICONS.book]) { const b = bbox(g.map(r => r.replace(/G/g, "."))); assert.ok(b.h > b.w * 1.3, `the binder is taller than wide (${b.w}×${b.h})`); }
});
