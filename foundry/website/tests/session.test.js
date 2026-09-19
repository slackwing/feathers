import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom, fakeFetch } from "./dom.js";
import { Session, Nav, WARM_KEY } from "../html/hxh/os/session.js";

const d = setupDom();

test("me: account or null (401, network error)", async () => {
  const log = [];
  const s = new Session({ fetch: fakeFetch({ "GET /admin/api/me": [200, { username: "a" }] }, log) });
  assert.deepEqual(await s.me(), { username: "a" });
  assert.equal(log[0].path, "/admin/api/me");
  assert.equal(await new Session({ fetch: fakeFetch({ "GET /admin/api/me": [401, {}] }) }).me(), null);
  assert.equal(await new Session({ fetch: async () => { throw new Error("net"); } }).me(), null);
});

test("login posts JSON and maps errors to the committee's words", async () => {
  const log = [];
  const s = new Session({ fetch: fakeFetch({ "POST /admin/api/login": init => JSON.parse(init.body).password === "ok" ? [200, { username: "a" }] : [401, {}] }, log) });
  assert.deepEqual(await s.login("a", "ok"), { username: "a" });
  assert.deepEqual(log[0].body, { username: "a", password: "ok" });
  await assert.rejects(() => s.login("a", "bad"), /does not recognize you/);
  const s2 = new Session({ fetch: fakeFetch({ "POST /admin/api/login": [500, {}] }) });
  await assert.rejects(() => s2.login("a", "x"), /Something went wrong/);
});

test("logout and forgot never throw; forgot posts the username", async () => {
  const log = [];
  const s = new Session({ fetch: fakeFetch({}, log) });
  await s.logout();
  await s.forgot("andrew");
  assert.deepEqual(log.map(l => l.method + " " + l.path), ["POST /admin/api/logout", "POST /admin/api/forgot"]);
  assert.deepEqual(log[1].body, { username: "andrew" });
  await new Session({ fetch: async () => { throw new Error("net"); } }).forgot("x");
});

test("a custom api base is honoured", async () => {
  const log = [];
  await new Session({ fetch: fakeFetch({}, log), api: "/x" }).me();
  assert.equal(log[0].path, "/x/me");
});

test("Nav: go leaves a one-shot warm flag; cold does not; consumeWarm clears it", () => {
  const loc = { href: "" };
  const nav = new Nav({ storage: d.win.sessionStorage, location: loc, home: "/hxh/" });
  assert.equal(nav.consumeWarm(), false);
  nav.go("/hxh/other/");
  assert.equal(loc.href, "/hxh/other/");
  assert.equal(d.win.sessionStorage.getItem(WARM_KEY), "1");
  assert.equal(nav.consumeWarm(), true);
  assert.equal(nav.consumeWarm(), false);
  nav.cold();
  assert.equal(loc.href, "/hxh/");
  assert.equal(nav.consumeWarm(), false);
});

test("Nav survives a broken storage", () => {
  const bad = { setItem() { throw new Error("quota"); }, getItem() { throw new Error("x"); }, removeItem() {} };
  const loc = { href: "" };
  const nav = new Nav({ storage: bad, location: loc });
  nav.go("/a");
  assert.equal(loc.href, "/a");
  assert.equal(nav.consumeWarm(), false);
});
