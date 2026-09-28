import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom, fakeFetch } from "./dom.js";
import { Profile, PROFILE_PREFIX } from "../html/hxh/os/profile.js";
import { Settings } from "../html/hxh/os/settings.js";
import { OS, THEME_KEY } from "../html/hxh/os/os.js";

const mem = () => { const m = new Map(); return { get length() { return m.size; }, key: i => [...m.keys()][i] ?? null, getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), map: m }; };

test("Profile: each user's preferences apart on one browser; signed out reads defaults and writes nothing (Andrew, 2026-09-28)", () => {
  const store = mem();
  const p = new Profile({ storage: store });
  const s = new Settings({ storage: p });
  assert.equal(s.getStr("theme", "seapumpkin"), "seapumpkin", "signed out: the default");
  s.setStr("theme", "tropical");
  assert.equal(store.map.size, 0, "signed out: nothing saved to the browser");
  p.setUser("andrew");
  assert.equal(s.getStr("theme", "seapumpkin"), "seapumpkin", "the signed-out pick does not become andrew's");
  s.setStr("theme", "win98");
  p.setUser("abi");
  assert.equal(s.getStr("theme", "seapumpkin"), "seapumpkin", "abi has her own");
  s.setStr("theme", "tropical");
  p.setUser("andrew");
  assert.equal(s.getStr("theme", "seapumpkin"), "win98", "andrew's is still his");
  assert.equal(store.getItem(PROFILE_PREFIX + "abi:hxh.set.theme"), "tropical");
});

test("Profile: the old per-browser keys move into the first user's profile, then leave the browser", () => {
  const store = mem();
  store.setItem("hxh.set.theme", "tropical"); store.setItem("hxh.crt", "1"); store.setItem("hxh.sound", "0"); store.setItem("hxh.desk.andrew", "{}");
  const p = new Profile({ storage: store });
  p.setUser("andrew");
  assert.equal(p.getItem("hxh.set.theme"), "tropical");
  assert.equal(p.getItem("hxh.crt"), "1");
  assert.equal(p.getItem("hxh.sound"), "0");
  assert.equal(store.getItem("hxh.set.theme"), null, "gone from the browser");
  assert.equal(store.getItem("hxh.desk.andrew"), "{}", "the saved desktop is already per user: untouched");
  p.setUser("abi");
  assert.equal(p.getItem("hxh.set.theme"), null, "the next person starts clean");
});

test("the OS applies the signed-in user's theme once it knows who; the account pages show the default", async () => {
  const d = setupDom();
  d.win.localStorage.clear();
  d.win.localStorage.setItem(PROFILE_PREFIX + "andrew:hxh.set." + THEME_KEY, "tropical");
  const fetch = fakeFetch({ "GET /admin/api/me": [200, { username: "andrew", display_name: "Andrew", roles: [] }] });
  const os = new OS({ win: d.win, fetch, env: { reduced: true, floating: () => true, zoom: () => 1, width: 1366, height: 900, wait: () => Promise.resolve() } });
  os.setup();
  assert.equal(d.win.document.documentElement.dataset.theme, "seapumpkin", "before sign-in: the default");
  await os.start({ apps: [], boot: false });
  assert.equal(d.win.document.documentElement.dataset.theme, "tropical", "andrew's own");
  d.win.localStorage.clear();
});
