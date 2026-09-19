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
  assert.match(svg, /^<svg class="px" viewBox="0 0 8 8" width="16" height="16"/);
  const painted = ICONS.x.join("").replace(/\./g, "").length;
  assert.equal((svg.match(/<rect /g) || []).length, painted);
  assert.equal(iconScale("x", 16), 2);
  assert.equal(iconScale("pumpkin", 24), 2);   // 12 wide → 2×
  assert.equal(iconScale("tee", 72), 4);
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
