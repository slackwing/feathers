import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupDom, fakeFetch, tick } from "./dom.js";
import { OS } from "../html/hxh/os/os.js";
import { App } from "../html/hxh/os/apps.js";
import { Window } from "../html/hxh/os/window.js";
import { WARM_KEY, Nav } from "../html/hxh/os/session.js";

const ME = { username: "andrew", display_name: "Andrew", initial: "AC", color: "#d914e3", roles: [{ website: "hxh", role: "admin" }] };
let d;
beforeEach(() => { d = setupDom(); });

class Hello extends App {
  static id = "hello"; static name = "Hello"; static icon = "card"; static order = 10;
  launch(opts) { this.launched = (this.launched || 0) + 1; this.lastOpts = opts; if (!this.win) { this.win = new Window({ id: "win-hello", title: "Hello" }); this.os.wm.add(this.win); } return this.os.wm.open("win-hello"); }
}
class Sys extends App { static id = "sys"; static name = "Sys"; static group = "system"; static order = 90; launch() {} }
class Tray extends App { static id = "tr"; static name = "Tr"; static desktop = false; static menuable = false; tray() { return { title: "Tray thing", on: true }; } visible(u) { return !!u; } }
class AdminOnly extends App { static id = "adm"; static name = "Adm"; visible(u) { return (u?.roles || []).some(r => r.role === "admin"); } launch() {} }

function make({ me = ME, warm = false, loc = { href: "" } } = {}) {
  if (warm) d.win.sessionStorage.setItem(WARM_KEY, "1");
  const log = [];
  const fetch = fakeFetch({ "GET /admin/api/me": me ? [200, me] : [401, {}], "POST /admin/api/login": [200, ME] }, log);
  const win = d.win;
  const nav = new Nav({ storage: win.sessionStorage, location: loc });
  const os = new OS({ win, fetch, nav, env: { reduced: true, floating: () => true, zoom: () => 1, width: 1366, height: 900, wait: () => Promise.resolve() } });
  return { os, log, loc };
}

test("a logged-in cold load: boots, builds the chrome, desktop, tray, autostarts", async () => {
  const { os, log } = make();
  const events = [];
  for (const ev of ["os:ready", "session:user", "app:launch", "tray:add"]) os.bus.on(ev, p => events.push(ev + ":" + (p?.id ?? p?.user?.username ?? "")));
  const r = await os.start({ apps: [Hello, Sys, Tray, AdminOnly], autostart: ["hello"], start: true, wallpaper: true });
  assert.equal(r, os);
  assert.equal(os.ready, true);
  assert.equal(log[0].path, "/admin/api/me");
  assert.equal(os.user.username, "andrew");
  assert.equal(os.isAdmin(), true);
  assert.equal(document.getElementById("desktop"), os.desktop.el);
  assert.equal(os.taskbar.el.hidden, false);
  assert.ok(os.startMenu && os.taskbar.startButton);
  assert.ok(os.toast && os.boot && os.backdrop);
  assert.equal(document.querySelector("canvas.wall"), os.wallpaper.el);
  assert.equal(document.documentElement.style.getPropertyValue("--zoom"), "1");   // 1366 wide → zoom 1
  assert.equal(document.querySelector(".os-badge"), null);
  assert.equal(os.desktop.iconBox.hidden, false);
  assert.deepEqual([...os.desktop.iconBox.children].map(b => b.dataset.act), ["hello", "sys", "adm"]);
  assert.ok(os.taskbar.tray.has("settings") && os.taskbar.tray.has("tr"));
  assert.ok(!os.taskbar.tray.has("crt"));   // the scanlines icon gave way to the Settings gear
  assert.equal(os.taskbar.tray.get("tr").btn.title, "Tray thing");
  const hello = os.registry.get("hello");
  assert.equal(hello.launched, 1);
  assert.deepEqual(hello.lastOpts, { autostart: true });
  assert.equal(os.wm.get("win-hello").state.open, true);
  assert.equal(os.taskbar.buttons.size, 1);
  assert.deepEqual(events.slice(0, 2), ["session:user:andrew", "tray:add:tr"]);   // user first, then the tray follows
  assert.ok(events.includes("os:ready:andrew") && events.includes("app:launch:hello"));
});

test("the Start menu lists apps, Settings ▸, system apps and Log out; the Settings tree is one source for Start, tray and windows", async () => {
  const { os } = make();
  await os.start({ apps: [Hello, Sys, Tray, AdminOnly], start: true });
  const items = os.startItems();
  assert.deepEqual(items.map(i => i === "sep" ? "-" : i.label), ["Hello", "Adm", "-", "Settings", "Sys", "-", "Log out"]);
  const labels = list => list.map(i => i.label);
  const tree = items[3].items();
  assert.deepEqual(labels(tree), ["Display", "Sounds"]);
  const display = tree[0].items(), sounds = tree[1].items();
  assert.deepEqual(labels(display), ["Theme", "Sky", "Scanlines"]);
  assert.deepEqual(labels(sounds), ["Sounds"]);
  assert.equal(display[2].check(), false);   // scanlines OFF by default
  display[2].onclick();
  assert.equal(os.crt.on, true);
  assert.ok(document.body.classList.contains("crt"));
  display[2].onclick();
  assert.equal(sounds[0].check(), true);    // sounds default on
  sounds[0].onclick();
  assert.equal(os.sounds.on, false);
  // radio groups: one check, the choice sticks in localStorage and reaches the page
  const themes = display[0].items(), skies = display[1].items();
  assert.deepEqual(labels(themes), ["Win98", "Whale Island Tropical", "Whale Island Sea Pumpkin", "Whale Island Sea Pumpkin Pastel"]);
  assert.deepEqual(labels(skies), ["Original", "Gradual", "Noisy Gradual", "Hypergradient", "Gradient", "Noisy Gradient"]);
  assert.deepEqual(themes.map(t => t.check()), [true, false, false, false]);
  assert.equal(document.documentElement.dataset.theme, "win98");
  const seen = [];
  os.bus.on("theme", p => seen.push("theme:" + p.name)); os.bus.on("sky", p => seen.push("sky:" + p.name));
  themes[1].onclick(); skies[2].onclick();
  assert.deepEqual(themes.map(t => t.check()), [false, true, false, false]);
  assert.equal(document.documentElement.dataset.theme, "tropical");
  assert.equal(d.win.localStorage.getItem("hxh.set.theme"), "tropical");
  assert.equal(os.sky, "noisy-gradual");
  assert.deepEqual(seen, ["theme:tropical", "sky:noisy-gradual"]);
  // the tray gear pops the same tree; window menus get it without icons
  assert.deepEqual(labels(os.taskbar.tray.get("settings").props.menu()), ["Display", "Sounds"]);
  const bare = os.settingsItems({ icons: false });
  assert.deepEqual(labels(bare), ["Display", "Sounds"]);
  assert.ok(bare.every(i => i.icon === undefined) && bare[0].items().every(i => i.icon === undefined));
  assert.ok(tree.every(i => i.icon));
  os.startMenu.open();
  assert.ok(os.startMenu.el.querySelector(".menu.sub .arr"));   // Settings ▸ renders as a cascading item
  assert.equal(os.startMenu.el.querySelector(".user .name").textContent, "Andrew");
  assert.ok(os.taskbar.startButton.el.classList.contains("pressed"));
  os.startMenu.close();
  assert.ok(!os.taskbar.startButton.el.classList.contains("pressed"));
  assert.deepEqual(os.appItems("apps", { except: "hello" }).map(i => i.label), ["Adm"]);
  assert.deepEqual(os.appItems("system", { long: true }).map(i => i.label), ["Sys"]);
});

test("desktop icons and the Start menu's app entries are one list (the registry); an app must bring a 16×16 icon", async () => {
  const { os } = make();
  await os.start({ apps: [Hello, Sys, Tray, AdminOnly], start: true });
  const onDesktop = [...os.desktop.iconBox.children].map(b => b.querySelector(".cap").textContent);
  const inStart = [...os.appItems("apps"), ...os.appItems("system")].map(i => i.label);
  assert.deepEqual([...inStart].sort(), [...onDesktop].sort());   // same set; the Start menu groups system apps after Settings
  // …and both draw the same grid, at 48 px and 16 px
  const startIcon = os.startMenu; os.startMenu.open();
  assert.match(os.desktop.iconBox.querySelector('[data-act="hello"] svg').outerHTML, /width="48" height="48"/);
  assert.match(startIcon.el.querySelector(".items button svg").outerHTML, /width="16" height="16"/);
  os.startMenu.close();
  class Odd extends App { static id = "odd"; static name = "Odd"; static icon = "pumpkin"; }   // 12×12: only the Start button may
  assert.throws(() => os.registry.register(Odd), /needs a 16×16 icon/);
  class Nope extends App { static id = "nope"; static name = "Nope"; static icon = "no-such-icon"; }
  assert.throws(() => os.registry.register(Nope), /needs a 16×16 icon/);
});

test("logged out + gate: the logon dialog alone, then the desktop after login", async () => {
  const { os } = make({ me: null });
  const p = os.start({ apps: [Hello, AdminOnly], autostart: ["hello"], start: true, wallpaper: true });
  await tick();
  const dlg = os.wm.get("win-logon");
  assert.ok(dlg && dlg.state.open);
  assert.ok(document.body.classList.contains("logon"));
  assert.ok(os.desktop.el.classList.contains("center"));
  assert.ok(document.querySelector(".os-badge"));
  assert.equal(os.taskbar.el.hidden, true);
  assert.equal(document.querySelector("canvas.wall"), null);
  assert.equal(document.activeElement, dlg.el.querySelector("#lg-u"));
  dlg.el.querySelector("#lg-u").value = "andrew"; dlg.el.querySelector("#lg-p").value = "x";
  d.fire(dlg.el.querySelector("#logon-form"), "submit");
  await p;
  assert.equal(os.wm.has("win-logon"), false);
  assert.ok(!document.body.classList.contains("logon"));
  assert.ok(!os.desktop.el.classList.contains("center"));
  assert.equal(document.querySelector(".os-badge"), null);
  assert.equal(os.user.username, "andrew");
  assert.ok(document.querySelector("canvas.wall"));
  assert.equal(os.wm.get("win-hello").state.open, true);
});

test("a splash page (no taskbar, no gate): badge stays, no icons, no wallpaper", async () => {
  const { os } = make({ me: null });
  await os.start({ apps: [Hello], taskbar: false, gate: false, wallpaper: true });
  assert.equal(os.taskbar, undefined);
  assert.equal(os.user, null);
  assert.ok(document.querySelector(".os-badge"));
  assert.equal(os.desktop.iconBox.hidden, true);
  assert.equal(document.querySelector("canvas.wall"), null);
});

test("boot runs on a cold load and is skipped on a warm one", async () => {
  const cold = make();
  let ran = 0;
  cold.os.setup();
  cold.os.boot.run = () => { ran++; return Promise.resolve(); };
  await cold.os.start({});
  assert.equal(ran, 1);
  d = setupDom();
  const warm = make({ warm: true });
  warm.os.setup();
  warm.os.boot.run = () => { ran++; return Promise.resolve(); };
  await warm.os.start({});
  assert.equal(ran, 1);
  assert.equal(d.win.sessionStorage.getItem(WARM_KEY), null);
  const off = make();
  off.os.setup();
  off.os.boot.run = () => { ran++; return Promise.resolve(); };
  await off.os.start({ boot: false });
  assert.equal(ran, 1);
});

test("go warms the next page; logout posts and cold-loads home", async () => {
  const { os, log, loc } = make();
  await os.start({});
  os.go("/hxh/x/");
  assert.equal(loc.href, "/hxh/x/");
  assert.equal(d.win.sessionStorage.getItem(WARM_KEY), "1");
  await os.logout();
  assert.equal(log.at(-1).path, "/admin/api/logout");
  assert.equal(loc.href, "/hxh/");
});

test("launch by id, apps registered with options, Escape closes popups, resize relayouts", async () => {
  class Opt extends App { static id = "opt"; static name = "Opt"; launch() { return this.options.word; } }
  const { os } = make();
  await os.start({ apps: [[Opt, { word: "yes" }], Hello] });
  assert.equal(os.launch("opt"), "yes");
  await os.launch("hello");
  const pop = os.wm.add(new Window({ id: "pop", popup: true }));
  await os.wm.open("pop");
  d.key(document.body, "Escape");
  assert.equal(pop.state.open, false);
  let resized = 0;
  os.bus.on("resize", () => resized++);
  d.fire(d.win, "resize");
  await tick(150);
  assert.equal(resized, 1);
  os.setup();   // idempotent
  assert.equal(document.querySelectorAll("#taskbar").length, 1);
});

test("an existing #desktop on the page is adopted", async () => {
  d = setupDom({ html: '<div class="desktop center" id="desktop"></div>' });
  const { os } = make();
  await os.start({ taskbar: false, gate: false });
  assert.equal(os.desktop.el, document.getElementById("desktop"));
  assert.equal(document.querySelectorAll("#desktop").length, 1);
});
