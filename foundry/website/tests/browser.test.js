import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { OS } from "../html/hxh/os/os.js";
import { BrowserApp, HOME, SEARCH, normalize, refuses } from "../html/hxh/apps/browser.js";
import { hasIconPair } from "../html/hxh/os/icons.js";
import * as apps from "../html/hxh/apps/index.js";

const ADMIN = { username: "andrew", display_name: "Andrew", roles: [{ website: "hxh", role: "admin" }] };
let d, os;
function make(me = ADMIN) {
  d = setupDom({ url: "https://andrewcheong.com/hxh/" });
  os = new OS({ win: d.win, fetch: async () => ({ ok: true, json: async () => me }), env: { reduced: true, floating: () => true, zoom: () => 1, width: 1366, height: 900, wait: () => Promise.resolve() } });
  return os;
}
beforeEach(() => make());

test("HunterNet: an app for admins only while it is polished, with a globe at both sizes (Andrew, 2026-09-29)", async () => {
  assert.equal(apps.Browser, BrowserApp);
  assert.ok(hasIconPair("globe"));
  await os.start({ apps: [BrowserApp], boot: false, start: true });
  assert.ok(document.querySelector('.icons [data-act="browser"]'), "an admin sees it");
  const guest = { username: "abi", roles: [{ website: "hxh", role: "guest" }] };
  assert.equal(os.registry.get("browser").visible(guest), false, "a guest does not");
  assert.equal(os.registry.get("browser").visible({ username: "anonymous", roles: [{ website: "hxh", role: "anonymous" }] }), false);
});

test("the address bar: http(s) only — never javascript:, data: or file:, which would run as this site", () => {
  assert.equal(normalize("https://en.wikipedia.org/wiki/Gon"), "https://en.wikipedia.org/wiki/Gon");
  assert.equal(normalize("en.wikipedia.org/wiki/Gon"), "https://en.wikipedia.org/wiki/Gon", "a bare address gets https");
  assert.equal(normalize("/hxh/", "https://andrewcheong.com/about"), "https://andrewcheong.com/hxh/", "this site, by path");
  assert.equal(normalize("killua zoldyck"), SEARCH + "killua%20zoldyck", "words search Wikipedia (the search engines refuse frames)");
  for (const bad of ["javascript:alert(1)", " JavaScript:alert(1)", "data:text/html,<b>x</b>", "file:///etc/passwd", "vbscript:x", "", "   "]) assert.equal(normalize(bad), null, JSON.stringify(bad));
  assert.equal(normalize("localhost:8080/x").startsWith("https://localhost:8080"), false, "a host:port without a dot is not taken for an address");
});

test("known refusers get HunterNet's own page (Hunterpedia included); YouTube's embed player is framable", () => {
  assert.equal(refuses("https://hunterxhunter.fandom.com/wiki/Hunterpedia"), true);
  assert.equal(refuses("https://www.google.com/search?q=x"), true);
  assert.equal(refuses("https://www.youtube.com/watch?v=x"), true);
  assert.equal(refuses("https://www.youtube-nocookie.com/embed/x"), false);
  assert.equal(refuses("https://en.wikipedia.org/wiki/Gon"), false);
  assert.equal(refuses("https://notgoogle.com/"), false, "a host that merely ends in the letters is not a subdomain");
});

test("home on open, then back / forward / refresh through HunterNet's own history; the frame can never navigate the OS", async () => {
  await os.start({ apps: [BrowserApp], boot: false });
  const app = os.registry.get("browser");
  await os.launch("browser");
  const w = os.wm.get("win-browser"), frame = () => w.$(".view iframe");
  assert.equal(app.current, HOME);
  assert.equal(frame().getAttribute("src"), HOME);
  assert.doesNotMatch(frame().getAttribute("sandbox"), /allow-top-navigation/);
  assert.equal(w.$('[data-act="back"]').disabled, true);
  app.go("en.wikipedia.org/wiki/Killua_Zoldyck");
  assert.equal(w.$(".addr input").value, "https://en.wikipedia.org/wiki/Killua_Zoldyck");
  app.back();
  assert.equal(app.current, HOME);
  assert.equal(w.$('[data-act="forward"]').disabled, false);
  app.forward();
  assert.match(app.current, /Killua/);
  const before = frame(); app.reload();
  assert.ok(frame() && frame() !== before, "refresh: a fresh frame");
  assert.equal(app.go("javascript:alert(1)"), false, "refused");
  assert.match(app.current, /Killua/, "and history untouched");
  assert.match(w.$(".bstatus").textContent, /Can't open/);
  app.go("hunterxhunter.fandom.com/wiki/Hunterpedia");
  assert.equal(frame(), null, "no blank frame for a refuser");
  assert.equal(w.$(".nope").hidden, false);
  assert.match(w.$(".nope .why").textContent, /hunterxhunter\.fandom\.com can't be shown inside HunterNet/);
});

test("the site shown inside HunterNet never saves a desktop over the real one (it shares this browser's storage)", async () => {
  await os.start({ apps: [BrowserApp], boot: false });
  os.framed = true;
  await os.launch("browser");
  assert.equal(os.layout.save(), null);
  os.framed = false;
  assert.ok(os.layout.save(), "unframed, it saves as before");
});
