import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

// The users console (html/admin/assets/console.js): ONE implementation behind /admin/ and /<site>/_admin/ (Andrew, 2026-10-01).
const src = fs.readFileSync(new URL("../html/admin/assets/console.js", import.meta.url), "utf8");
function load() {
  const sandbox = {};
  vm.runInNewContext(src, sandbox);   // the script only hangs Console on its global; mount() is what touches the page
  return sandbox.Console;
}

test("the add-user form's username comes from the name: lowercase letters and digits, accents dropped (\"Kimmy T\" → kimmyt)", () => {
  const C = load();
  assert.equal(C.usernameFor("Judy"), "judy");
  assert.equal(C.usernameFor("Kimmy T"), "kimmyt");
  assert.equal(C.usernameFor("José Q."), "joseq");
  assert.equal(C.usernameFor("  "), "");
});

test("/admin/ and /hxh/_admin/ are the same console, the site page only naming its site", () => {
  const admin = fs.readFileSync(new URL("../html/admin/index.html", import.meta.url), "utf8");
  const hxh = fs.readFileSync(new URL("../html/hxh/_admin/index.html", import.meta.url), "utf8");
  assert.match(admin, /assets\/console\.js/);
  assert.match(admin, /Console\.mount\(\{ site: null/);
  assert.match(hxh, /\/admin\/assets\/console\.js/);
  assert.match(hxh, /Console\.mount\(\{ site: "hxh"/);
  for (const page of [admin, hxh]) assert.doesNotMatch(page, /<script>\s*const API/, "no console code of its own");
});

test("the one branch: a site console's form creates, gives the default role, then invites — /admin/'s only creates", () => {
  assert.match(src, /if \(!site\) \{\s*\/\/ \/admin\/ only creates the user/);
  assert.match(src, /websites\[0\]\?\.default/);
});
