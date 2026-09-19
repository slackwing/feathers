import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { Boot, Badge, badgeHTML, bootLines } from "../html/hxh/os/boot.js";

const d = setupDom();
const fastEnv = { reduced: false, wait: () => Promise.resolve() };

test("bootLines: HunterOS lines plus extras; the badge carries the tee", () => {
  const lines = bootLines([{ text: "extra" }]);
  assert.equal(lines.length, 4);
  assert.match(lines[0].text, /HunterOS 99/);
  assert.equal(lines[1].ok, true);
  assert.equal(lines[3].text, "extra");
  assert.match(badgeHTML(), /a purple square<br>production/);
  assert.match(badgeHTML(), /<svg/);
  const b = new Badge().mount(document.body);
  assert.ok(b.el.classList.contains("os-badge"));
  b.unmount();
});

test("run types the lines with OK marks, splash first, and resolves", async () => {
  const boot = new Boot({ env: fastEnv }).mount(document.body);
  assert.equal(boot.el.id, "boot");
  const p = boot.run({ badge: "B", splash: { html: "<i>S</i>", ms: 1 }, lines: [{ text: "one", ok: true }, { text: "two" }], speed: 0, tail: 0 });
  assert.ok(boot.running && boot.el.classList.contains("on"));
  assert.equal(boot.el.querySelector(".badge").textContent, "B");
  assert.equal(boot.el.querySelector(".splash i").textContent, "S");
  await p;
  assert.equal(boot.running, false);
  assert.ok(!boot.el.classList.contains("on"));
  assert.equal(boot.el.querySelector(".splash"), null);
  const rows = [...boot.el.querySelectorAll("div:not(.badge)")].map(r => r.textContent);
  assert.deepEqual(rows, ["one OK", "two", ""]);
  boot.unmount();
});

test("a click skips the boot; reduced motion resolves at once", async () => {
  const slow = { reduced: false, wait: () => new Promise(r => setTimeout(r, 50)) };
  const boot = new Boot({ env: slow }).mount(document.body);
  const p = boot.run({ lines: [{ text: "abc" }] });
  d.click(boot.el);
  await p;
  assert.equal(boot.running, false);
  const quick = new Boot({ env: { reduced: true } }).mount(document.body);
  await quick.run({ lines: [{ text: "x" }] });
  assert.ok(!quick.el.classList.contains("on"));
  boot.unmount(); quick.unmount();
});
