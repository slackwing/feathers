import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { OS } from "../html/hxh/os/os.js";
import { BrowserApp, HOME, SEARCH, normalize, refuses, readerPage, readerAPI, readerDoc } from "../html/hxh/apps/browser.js";
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

test("HunterNet: an app for everyone signed in — guests and the anonymous viewer too — with a globe at both sizes (Andrew, 2026-09-29)", async () => {
  assert.equal(apps.Browser, BrowserApp);
  assert.ok(hasIconPair("globe"));
  await os.start({ apps: [BrowserApp], boot: false, start: true });
  assert.ok(document.querySelector('.icons [data-act="browser"]'));
  const app = os.registry.get("browser");
  assert.equal(app.visible({ username: "abi", roles: [{ website: "hxh", role: "guest" }] }), true);
  assert.equal(app.visible({ username: "anonymous", roles: [{ website: "hxh", role: "anonymous" }] }), true);
  assert.equal(app.visible(null), false);
});

test("the address bar: http(s) only — never javascript:, data: or file:, which would run as this site", () => {
  assert.equal(normalize("https://en.wikipedia.org/wiki/Gon"), "https://en.wikipedia.org/wiki/Gon");
  assert.equal(normalize("en.wikipedia.org/wiki/Gon"), "https://en.wikipedia.org/wiki/Gon", "a bare address gets https");
  assert.equal(normalize("/hxh/", "https://andrewcheong.com/about"), "https://andrewcheong.com/hxh/", "this site, by path");
  assert.equal(normalize("killua zoldyck"), SEARCH + "killua%20zoldyck", "words search Wikipedia (the search engines refuse frames)");
  for (const bad of ["javascript:alert(1)", " JavaScript:alert(1)", "data:text/html,<b>x</b>", "file:///etc/passwd", "vbscript:x", "", "   "]) assert.equal(normalize(bad), null, JSON.stringify(bad));
  assert.equal(normalize("localhost:8080/x").startsWith("https://localhost:8080"), false, "a host:port without a dot is not taken for an address");
});

test("known refusers get HunterNet's own page; YouTube's embed player is framable; Fandom wiki pages go to reader view", () => {
  assert.deepEqual(readerPage("https://hunterxhunter.fandom.com/wiki/Killua_Zoldyck"), { host: "hunterxhunter.fandom.com", page: "Killua Zoldyck" });
  assert.equal(readerPage("https://hunterxhunter.fandom.com/"), null, "not an article: the refusal page");
  assert.equal(readerPage("https://en.wikipedia.org/wiki/Gon"), null);
  assert.match(readerAPI({ host: "hunterxhunter.fandom.com", page: "Hunterpedia" }), /^https:\/\/hunterxhunter\.fandom\.com\/api\.php\?action=parse&page=Hunterpedia&format=json&origin=\*/);
  assert.equal(refuses("https://www.google.com/search?q=x"), true);
  assert.equal(refuses("https://www.youtube.com/watch?v=x"), true);
  assert.equal(refuses("https://www.youtube-nocookie.com/embed/x"), false);
  assert.equal(refuses("https://en.wikipedia.org/wiki/Gon"), false);
  assert.equal(refuses("https://notgoogle.com/"), false, "a host that merely ends in the letters is not a subdomain");
});

const PARSE = { title: "Hunterpedia", displaytitle: "<span>Hunterpedia</span>", text: '<p>Welcome <a href="/wiki/Gon_Freecss">Gon</a></p><script>parent.hacked = 1</script><img src="data:image/gif;base64,R0lGOD" data-src="https://static.wikia.nocookie.net/x.png" onerror="alert(1)"><iframe src="https://evil.example"></iframe><form action="/x"><input></form>' };
const fakeFetch = log => async url => { log.push(String(url)); return String(url).includes("api.php") ? { ok: true, status: 200, json: async () => ({ parse: PARSE }) } : { ok: false, status: 404, json: async () => ({}) }; };

test("home is Hunterpedia in reader view: the article from Fandom's API, drawn in a frame with no scripts (Andrew, 2026-09-29)", async () => {
  const log = [];
  await os.start({ apps: [[BrowserApp, { fetch: fakeFetch(log) }]], boot: false });
  await os.launch("browser");
  await new Promise(r => setTimeout(r, 0));
  const app = os.registry.get("browser"), w = os.wm.get("win-browser"), frame = w.$(".view iframe");
  assert.equal(app.current, HOME);
  assert.ok(log.some(u => u.startsWith("https://hunterxhunter.fandom.com/api.php?action=parse&page=Hunterpedia")), "the API, from the visitor's browser");
  assert.equal(frame.getAttribute("sandbox").split(" ").includes("allow-scripts"), false, "nothing of the page runs");
  const html = frame.srcdoc;
  assert.match(html, /<h1>Hunterpedia<\/h1>/);
  assert.match(html, /<base href="https:\/\/hunterxhunter\.fandom\.com\/wiki\/">/);
  assert.doesNotMatch(html, /<script|<iframe|<form|onerror=/i, "cleaned");
  assert.match(html, /src="https:\/\/static\.wikia\.nocookie\.net\/x\.png"/, "the lazy picture's real source");
  assert.match(html, /<img [^>]*referrerpolicy="no-referrer"/, "Fandom's image server sends a placeholder to a foreign referrer");
});

test("readerDoc: a hostile article cannot smuggle markup through the title either", () => {
  const html = readerDoc({ title: "x", displaytitle: '<img src=x onerror=alert(1)>"</h1><script>1</script>' }, "hunterxhunter.fandom.com");
  assert.doesNotMatch(html, /<script>1|onerror/);
});

test("back / forward / refresh through HunterNet's own history; the frame can never navigate the OS", async () => {
  await os.start({ apps: [[BrowserApp, { fetch: fakeFetch([]) }]], boot: false });
  const app = os.registry.get("browser");
  await os.launch("browser");
  const w = os.wm.get("win-browser"), frame = () => w.$(".view iframe");
  app.go("en.wikipedia.org/wiki/Gon_Freecss");
  assert.doesNotMatch(frame().getAttribute("sandbox"), /allow-top-navigation/);
  app.go("en.wikipedia.org/wiki/Killua_Zoldyck");
  assert.equal(w.$(".addr input").value, "https://en.wikipedia.org/wiki/Killua_Zoldyck");
  app.back();
  assert.match(app.current, /Gon/);
  assert.equal(w.$('[data-act="forward"]').disabled, false);
  app.forward();
  assert.match(app.current, /Killua/);
  const before = frame(); app.reload();
  assert.ok(frame() && frame() !== before, "refresh: a fresh frame");
  assert.equal(app.go("javascript:alert(1)"), false, "refused");
  assert.match(app.current, /Killua/, "and history untouched");
  assert.match(w.$(".bstatus").textContent, /Can't open/);
  app.go("https://www.google.com/search?q=gon");
  assert.equal(frame(), null, "no blank frame for a refuser");
  assert.equal(w.$(".nope").hidden, false);
  assert.match(w.$(".nope .why").textContent, /www\.google\.com can't be shown inside HunterNet/);
});

test("going back, a page that redirects on load (/hxh → /hxh/) corrects its entry instead of wiping the forward pages (Andrew, 2026-09-29: went back, couldn't go forward)", async () => {
  await os.start({ apps: [[BrowserApp, { fetch: fakeFetch([]) }]], boot: false });
  const app = os.registry.get("browser");
  await os.launch("browser");
  app.entries = ["https://a.example/", "https://andrewcheong.com/hxh", "https://c.example/"]; app.index = 1;
  app.first = true;
  app.frame = { contentWindow: { location: { href: "https://andrewcheong.com/hxh/" } }, remove() {} };
  app.loaded();
  assert.deepEqual(app.entries, ["https://a.example/", "https://andrewcheong.com/hxh/", "https://c.example/"], "the forward page kept");
  app.frame = { contentWindow: { location: { href: "https://andrewcheong.com/hxh/about/" } }, remove() {} };
  app.loaded();   // a later load: a link followed inside the page
  assert.deepEqual(app.entries.slice(-2), ["https://andrewcheong.com/hxh/", "https://andrewcheong.com/hxh/about/"]);
});

test("the site shown inside HunterNet never saves a desktop over the real one (it shares this browser's storage)", async () => {
  await os.start({ apps: [BrowserApp], boot: false });
  os.framed = true;
  await os.launch("browser");
  assert.equal(os.layout.save(), null);
  os.framed = false;
  assert.ok(os.layout.save(), "unframed, it saves as before");
});
