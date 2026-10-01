import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom, fakeFetch, tick } from "./dom.js";
import { OS } from "../html/hxh/os/os.js";
import { AboutApp, INTRO, PROMPTS_URL } from "../html/hxh/apps/about/app.js";
import { hasIconPair, DESK } from "../html/hxh/os/icons.js";

const d = setupDom();
const ME = { username: "abi", display_name: "Abi", initial: "AB", color: "#349db2", roles: [{ website: "hxh", role: "guest" }] };
const make = prompts => {
  const fetch = fakeFetch({ "GET /admin/api/me": [200, ME], [`GET ${PROMPTS_URL}`]: prompts ? [200, prompts] : [500, {}] });
  const os = new OS({ win: d.win, fetch, env: { reduced: true, floating: () => true, zoom: () => 1, width: 1366, height: 900, wait: () => Promise.resolve() } });
  return { os, options: { fetch } };
};

test("About: a question-mark app for everyone; the window opens on Andrew's note, then every prompt, numbered, verbatim — typos, lowercase, line breaks and all (Andrew, 2026-09-27)", async () => {
  const prompts = ["make a site\nfor hunter x halloween", "the binder is tiny!  make it fill like 85% of the screen", "<b>not html</b> & stuff"];
  const { os, options } = make(prompts);
  await os.start({ apps: [[AboutApp, options]], start: true });
  assert.ok(hasIconPair("question"));
  assert.equal(os.startItems().some(i => i.label === "About"), false, "not in Start's app list");
  assert.equal(document.querySelector('.icons [data-act="about"]'), null, "nor on the desktop (Andrew, 2026-10-01)");
  const entry = os.settingsItems().find(i => i.label === "Other").items().find(i => i.label === "About");
  assert.ok(entry, "Settings › Other › About is its door");
  entry.onclick();
  await new Promise(r => setTimeout(r, 0));
  const w = os.wm.get("win-about");
  await tick(0);
  assert.equal(w.$(".aintro").textContent, INTRO, "Andrew's note, verbatim");
  assert.match(INTRO, /^Hey y'all, welcome! This site was created with Claude Fable and Opus 5\.5\. AI makes things look easy, but full-blown projects take persistence and patience\. .* Thanks Abi for handling that side!$/);
  const items = [...w.$(".aprompts").children];
  assert.equal(w.$(".aprompts").tagName, "OL", "a numbered list");
  assert.deepEqual(items.map(li => li.textContent), prompts, "verbatim");
  assert.equal(items[2].querySelector("b"), null, "text, never HTML");
  assert.match(getComputedStyle(w.$(".ascroll")).fontFamily || "Arial", /Arial/);
});

test("About: if the prompts cannot be read, it says so", async () => {
  const { os, options } = make(null);
  await os.start({ apps: [[AboutApp, options]], start: true });
  await os.launch("about");
  assert.match(os.wm.get("win-about").$(".aprompts").textContent, /could not be loaded/);
});
