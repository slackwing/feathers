import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { People, PEOPLE_URL } from "../html/hxh/os/people.js";
import { StartMenu } from "../html/hxh/os/startmenu.js";

setupDom();

const ME = { username: "andrew", display_name: "Andrew C", initial: "AC", color: "#2fb54a" };
const bus = () => { const seen = []; return { seen, emit: (ev, p) => seen.push(ev) }; };
const fetchOf = body => async url => { assert.equal(url, PEOPLE_URL); return { ok: true, json: async () => body }; };

test("People: one merge of the shared profile and the site's overrides — a claim brings the character's name and picture, the colour stays yours (Andrew, 2026-09-27: the Start menu still showed a green AC after claiming Chrollo)", async () => {
  const b = bus();
  const p = new People({ fetch: fetchOf({ andrew: { character: "Chrollo", avatar_url: "/hxh/api/db/images/7/thumb" } }), bus: b, user: () => ME });
  assert.equal(p.of(ME).avatar_url, undefined, "before the overrides arrive: the plain profile");
  assert.match(p.avatar(ME), /class="avatar "[^>]*>AC</);
  assert.equal(await p.load(), true);
  assert.deepEqual(b.seen, ["people"]);
  const me = p.of(ME);
  assert.equal(me.character, "Chrollo");
  assert.equal(me.avatar_url, "/hxh/api/db/images/7/thumb");
  assert.equal(me.color, "#2fb54a", "the member's colour is their own");
  assert.match(p.avatar("andrew"), /<img src="\/hxh\/api\/db\/images\/7\/thumb"/, "by username too: the signed-in account is the fallback profile");
  assert.equal(await p.load(), false, "nothing new: no event");
  assert.deepEqual(b.seen, ["people"]);
});

test("People: the chat's contacts feed the same store, and a released claim drops the override; a failed fetch keeps what we had", async () => {
  const b = bus();
  const p = new People({ fetch: async () => { throw new Error("offline"); }, bus: b, user: () => ME });
  p.setContacts([{ ...ME, state: "online", character: "Chrollo", avatar_url: "/x.png" }, { username: "abi", display_name: "Abi", initial: "AB", color: "#c8102e", state: "away" }]);
  assert.equal(p.of("andrew").avatar_url, "/x.png");
  assert.equal(p.of("abi").display_name, "Abi", "profiles come with the contacts");
  assert.equal(p.of("abi").avatar_url, undefined);
  assert.equal(await p.load(), false);
  assert.equal(p.of("andrew").avatar_url, "/x.png", "a failed fetch keeps the overrides");
  p.setContacts([{ ...ME, state: "online" }]);   // the claim was released
  assert.equal(p.of("andrew").avatar_url, undefined);
  assert.equal(p.of("andrew").character, undefined);
  assert.deepEqual(b.seen, ["people", "people"]);
  assert.equal(p.of("stranger").initial, "ST", "an unknown member still gets a grey initial");
});

test("People: /people dropping a member drops their override (released while the chat was closed)", async () => {
  let body = { andrew: { character: "Chrollo", avatar_url: "/x.png" } };
  const p = new People({ fetch: async () => ({ ok: true, json: async () => body }), bus: bus(), user: () => ME });
  await p.load();
  assert.equal(p.of(ME).avatar_url, "/x.png");
  body = {};
  assert.equal(await p.load(), true);
  assert.equal(p.of(ME).avatar_url, undefined);
});

test("the Start menu header draws the member through People: a claim shows there too", async () => {
  const p = new People({ fetch: fetchOf({ andrew: { character: "Chrollo", avatar_url: "/hxh/api/db/images/7/thumb" } }), bus: bus(), user: () => ME });
  const m = new StartMenu({ items: () => [], user: () => p.of(ME) }).mount(document.body);
  m.open();
  assert.equal(m.el.querySelector(".user .avatar img"), null, "before the overrides: initials");
  m.close();
  await p.load();
  m.open();
  assert.equal(m.el.querySelector(".user .avatar img")?.getAttribute("src"), "/hxh/api/db/images/7/thumb");
  assert.equal(m.el.querySelector(".user .name").textContent, "Andrew C", "without a label source the header falls back to the member's own name");
  m.close(); m.unmount();
});

test("People.label: one rule for a member's name on this site — \"Chrollo (Andrew C)\" once claimed, the plain name otherwise; the Start menu header uses it, flat (Andrew, 2026-09-27)", async () => {
  const p = new People({ fetch: fetchOf({ andrew: { character: "Chrollo", avatar_url: "/x.png" } }), bus: bus(), user: () => ME });
  assert.equal(p.label(ME), "Andrew C");
  await p.load();
  assert.equal(p.label(ME), "Chrollo (Andrew C)");
  assert.equal(p.label("andrew"), "Chrollo (Andrew C)", "by username too");
  assert.equal(p.label("stranger"), "stranger");
  const m = new StartMenu({ items: () => [], user: () => p.of(ME), label: () => p.label(ME) }).mount(document.body);
  m.open();
  assert.equal(m.el.querySelector(".user .name").textContent, "Chrollo (Andrew C)");
  m.close(); m.unmount();
});
