import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupDom, fakeFetch, tick } from "./dom.js";
import { OS, FONTS_URL } from "../html/hxh/os/os.js";
import { Blimp } from "../html/hxh/os/blimp.js";
import { hasIconPair } from "../html/hxh/os/icons.js";
import { HeavensArenaApp } from "../html/hxh/apps/arena.js";
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

function make({ me = ME, warm = false, loc = { href: "" }, reduced = true } = {}) {
  if (warm) d.win.sessionStorage.setItem(WARM_KEY, "1");
  const log = [];
  const fetch = fakeFetch({ "GET /admin/api/me": me ? [200, me] : [401, {}], "POST /admin/api/login": [200, ME] }, log);
  const win = d.win;
  const nav = new Nav({ storage: win.sessionStorage, location: loc });
  const os = new OS({ win, fetch, nav, env: { reduced, floating: () => true, zoom: () => 1, width: 1366, height: 900, wait: () => Promise.resolve() } });
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
  assert.equal(os.wallpaper.el.nextSibling, os.blimp.el);   // the blimp flies above the wallpaper, below everything else
  assert.equal(os.wallpaper.props.sky(), "hypergradient");   // the default sky
  const repaints = []; os.bus.on("sky", p => repaints.push(p.name));
  os.applySky("gradual");
  assert.equal(os.wallpaper.props.sky(), "gradual");   // the wallpaper asks the OS which sky to paint, on every `sky` event
  assert.deepEqual(repaints, ["gradual"]);
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

test("a cold load with splash: after the boot screen the title screen holds everything until clicked; a warm navigation skips it (Andrew, 2026-09-27)", async () => {
  const { os } = make();
  let ready = false;
  const started = os.start({ apps: [Hello], autostart: ["hello"], start: true, splash: true }).then(() => { ready = true; });
  await new Promise(r => setTimeout(r, 40));
  const el = document.querySelector(".splashscreen");
  assert.ok(el && !el.hidden, "the splash is up");
  assert.equal(el.dataset.style, "summons", "always the Summons: the site's anchor (Andrew, 2026-09-27)");
  assert.match(el.textContent, /Click to start/);
  assert.equal(ready, false, "and the desktop waits for it");
  assert.equal(os.wm.get("win-hello")?.state.open ?? false, false);
  el.click();
  await started;
  assert.equal(ready, true);
  assert.equal(os.wm.get("win-hello").state.open, true, "then the desktop comes up as before");
  const warm = make({ warm: true }).os;
  await warm.start({ apps: [Hello], start: true, splash: true });   // no boot, no splash: resolves without a click
  assert.ok(!warm.splash || warm.splash.el.hidden);
});

test("logged out: the boot screen, then the splash, and only on clicking to start the logon (Andrew, 2026-09-28: \"show the splash first, and on clicking to start, show the login\")", async () => {
  const { os } = make({ me: null });
  let ready = false;
  const p = os.start({ apps: [Hello], autostart: ["hello"], start: true, splash: true }).then(() => { ready = true; });
  await new Promise(r => setTimeout(r, 40));
  const sp = () => document.querySelector(".splashscreen");
  assert.ok(sp() && !sp().hidden, "the splash first");
  assert.equal(os.wm.get("win-logon")?.state.open ?? false, false, "no logon behind it yet");
  sp().click();
  await new Promise(r => setTimeout(r, 40));
  const dlg = os.wm.get("win-logon");
  assert.ok(dlg && dlg.state.open, "clicking to start brings the logon");
  assert.ok(sp().hidden);
  dlg.el.querySelector("#lg-u").value = "andrew"; dlg.el.querySelector("#lg-p").value = "x";
  d.fire(dlg.el.querySelector("#logon-form"), "submit");
  await p;
  assert.equal(ready, true, "signed in: straight to the desktop, no second splash");
  assert.ok(sp().hidden);
  assert.equal(os.wm.get("win-hello").state.open, true);
});

test("every page loads the OS's one font list: the account pages cannot fall behind the desktop's <head>", async () => {
  const { os } = make();
  await os.start({ apps: [Hello], boot: false });
  const links = [...document.head.querySelectorAll("link[data-os-fonts]")];
  assert.equal(links.length, 1);
  assert.equal(links[0].getAttribute("href"), FONTS_URL);
  for (const face of ["Press+Start+2P", "Alfa+Slab+One", "Special+Elite", "DotGothic16", "Pixelify+Sans"]) assert.ok(FONTS_URL.includes(face), face);
  await make().os.start({ apps: [Hello], boot: false });
  assert.equal(document.head.querySelectorAll("link[data-os-fonts]").length, 1, "once");
});

test("Heavens Arena: a desktop icon and Start entry after the Binder; opening it covers the screen with Player Select saying COMING SOON, and a click closes it — silently (Andrew, 2026-09-27)", async () => {
  const played = [];
  const { os } = make({ reduced: false });
  os.sounds.play = n => { played.push(n); return true; };
  await os.start({ apps: [Hello, HeavensArenaApp], start: true });
  const app = os.registry.get("arena");
  assert.ok(app && hasIconPair(HeavensArenaApp.icon), "a 16×16 tower icon");
  assert.ok(os.startItems().some(i => i.label === "Heavens Arena"), "in the Start menu");
  assert.ok(document.querySelector('.icons [data-act="arena"]'), "on the desktop");
  const done = os.launch("arena");
  const el = document.querySelector(".splashscreen");
  assert.ok(el && !el.hidden && el.dataset.style === "select");
  assert.match(el.textContent, /COMING SOON/);
  assert.doesNotMatch(el.textContent, /CLICK TO START/i);
  assert.equal(el.getAttribute("aria-label"), "COMING SOON");
  el.click();
  await done;
  assert.equal(el.hidden, true, "a click closes it, back to the desktop");
  assert.deepEqual(played, [], "no startup chime for a placeholder");
  assert.equal(await app.reopen("win-arena"), false, "nothing for the saved desktop to bring back");
});

test("Heavens Arena is one splash: Settings › Other › Splash screen › Heavens Arena says COMING SOON and closes silently too, just like the app (Andrew, 2026-09-27: \"they should be a unified asset\")", async () => {
  const played = [];
  const { os } = make({ reduced: false });
  os.sounds.play = n => { played.push(n); return true; };
  await os.start({ apps: [Hello, HeavensArenaApp], start: true });
  const entry = os.settingsItems().find(i => i.label === "Other").items().find(i => i.label === "Splash screen").items().find(i => i.label === "Heavens Arena");
  const shown = [];
  for (const open of [() => entry.onclick(), () => os.launch("arena")]) {
    const done = open();
    const el = document.querySelector(".splashscreen");
    shown.push([el.dataset.style, el.querySelector(".sp-start").textContent, el.getAttribute("aria-label")]);
    el.click();
    await done;
  }
  assert.deepEqual(shown[0], ["select", "COMING SOON", "COMING SOON"], "from the systray");
  assert.deepEqual(shown[1], shown[0], "the same from the app");
  assert.deepEqual(played, [], "neither chimes");
});

test("Settings › Other ▸ (last): Fly the blimp and Splash screen ▸ Summons / Player Select / Night — the blimp item greys while a ship is up and is absent under reduced motion; a splash covers the desktop until clicked (Andrew, 2026-09-27)", async () => {
  const { os } = make({ reduced: false });
  await os.start({ apps: [Hello], start: true });
  os.blimp = new Blimp({ reduced: true, random: () => 0.5, duration: 100000 }).mount(document.body);   // the blimp the wallpaper would have mounted (no schedule, no canvas here)
  const tree = os.settingsItems();
  assert.deepEqual(tree.map(i => i.label), ["Display", "Sounds", "Windows", "Other"]);
  assert.ok(tree.every(i => i.icon && hasIconPair(i.icon)), "each submenu has a 16×16 icon: " + tree.map(i => i.icon));
  assert.deepEqual(tree[0].items().map(i => i === "sep" ? "-" : i.label), ["Theme", "Sky", "Scanlines"], "the blimp left Display");
  const other = () => os.settingsItems()[3].items();
  assert.deepEqual(other().map(i => i.label), ["Fly the blimp", "Splash screen"]);
  assert.equal(other()[0].disabled, false);
  other()[0].onclick();
  assert.equal(os.blimp.flying, true);
  assert.equal(other()[0].disabled, true, "one is up: the item greys until it has crossed");
  os.blimp.el.querySelector(".blimp").dispatchEvent(new d.win.Event("animationend"));
  assert.equal(other()[0].disabled, false);
  os.blimp.unmount();
  const splashes = other()[1].items();
  assert.deepEqual(splashes.map(i => i.label), ["Summons", "Heavens Arena", "Night"]);
  splashes[2].onclick();   // Night, over the desktop (Heavens Arena says COMING SOON: its own test below)
  const el = document.querySelector(".splashscreen");
  assert.ok(el && !el.hidden && el.classList.contains("sp-night"));
  assert.match(el.textContent, /click to start/i);
  el.click();
  assert.equal(el.hidden, true, "a click returns to the desktop");
  const quiet = make({ reduced: true }).os;
  await quiet.start({ apps: [Hello], start: true });
  assert.deepEqual(quiet.settingsItems().map(i => i.label), ["Display", "Sounds", "Windows", "Other"]);
  assert.deepEqual(quiet.settingsItems()[3].items().map(i => i.label), ["Splash screen"], "reduced motion: no blimp, the splashes stay (they are stills)");
});

test("Settings › Windows ▸ Show all / Hide all / Close all act on the desktop's app windows, each greyed when there is nothing to do (Andrew, 2026-09-27)", async () => {
  const { os } = make({ reduced: false });
  await os.start({ apps: [Hello, Sys], start: true });
  const wm = os.wm;
  const mk = (id, extra = {}) => { const w = new Window({ id, title: id, ...extra }); wm.add(w); return w; };
  const a = mk("win-wa"), b = mk("win-wb"), c = mk("win-wc"), dlg = mk("win-dlg", { chrome: "static" });
  for (const w of [a, b, c, dlg]) await wm.open(w.id);
  const menu = () => Object.fromEntries(os.settingsItems().find(i => i.label === "Windows").items().map(i => [i.label, i]));
  assert.deepEqual(Object.keys(menu()), ["Show all windows", "Hide all windows", "Close all windows"]);
  const open = () => wm.appWindows().filter(w => w.state.open && !w.state.minimized).map(w => w.id).sort();
  const before = open();
  assert.ok(before.includes("win-wa") && before.includes("win-wc"));
  assert.equal(menu()["Show all windows"].disabled, true, "nothing minimized yet");
  // Hide all: every visible app window to the taskbar; the static dialog is not an app window
  wm.focus("win-wb");
  menu()["Hide all windows"].onclick();
  assert.deepEqual(open(), []);
  assert.ok([a, b, c].every(w => w.state.open && w.state.minimized && w.el.hidden));
  assert.equal(dlg.state.minimized, false, "static dialogs are left alone");
  assert.equal(menu()["Hide all windows"].disabled, true, "everything is already hidden");
  // Show all: back where they were, the one on top still on top
  const placeB = b.el.style.left + "," + b.el.style.top;
  menu()["Show all windows"].onclick();
  assert.deepEqual(open(), before);
  assert.equal(b.el.style.left + "," + b.el.style.top, placeB, "restored in place");
  assert.equal(wm.activeId, "win-wb", "the window that was on top comes back on top");
  assert.equal(menu()["Show all windows"].disabled, true);
  // Close all: minimized ones too, through the manager's close (onClose hooks run)
  let closed = 0; a.props.onClose = () => closed++;
  wm.minimize("win-wa");
  menu()["Close all windows"].onclick();
  assert.equal(closed, 1, "the minimized window's own close hook ran");
  assert.deepEqual(wm.appWindows().filter(w => w.state.open).map(w => w.id), []);
  assert.equal(dlg.state.open, true, "static dialogs are left alone");
  const m = menu();
  assert.ok(m["Show all windows"].disabled && m["Hide all windows"].disabled && m["Close all windows"].disabled, "nothing left to act on");
});

test("the Start menu lists apps, Settings ▸, system apps and Log out; the Settings tree is one source for Start, tray and windows", async () => {
  const { os } = make();
  await os.start({ apps: [Hello, Sys, Tray, AdminOnly], start: true });
  const items = os.startItems();
  assert.deepEqual(items.map(i => i === "sep" ? "-" : i.label), ["Hello", "Adm", "-", "Settings", "Sys", "-", "Log out"]);
  const labels = list => list.map(i => i.label);
  const tree = items[3].items();
  assert.deepEqual(labels(tree), ["Display", "Sounds", "Windows", "Other"]);   // Other last (Andrew, 2026-09-27)
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
  assert.deepEqual(themes.map(t => t.check()), [false, false, true, false]);   // Sea Pumpkin by default (Andrew, 2026-09-21)
  assert.equal(document.documentElement.dataset.theme, "seapumpkin");
  const seen = [];
  os.bus.on("theme", p => seen.push("theme:" + p.name)); os.bus.on("sky", p => seen.push("sky:" + p.name));
  themes[1].onclick(); skies[2].onclick();
  assert.deepEqual(themes.map(t => t.check()), [false, true, false, false]);
  assert.equal(document.documentElement.dataset.theme, "tropical");
  assert.equal(d.win.localStorage.getItem("hxh.u.andrew:hxh.set.theme"), "tropical", "in andrew's profile");
  assert.equal(os.sky, "noisy-gradual");
  assert.deepEqual(seen, ["theme:tropical", "sky:noisy-gradual"]);
  // the tray gear pops the same tree; window menus get it without icons
  assert.deepEqual(labels(os.taskbar.tray.get("settings").props.menu()), ["Display", "Sounds", "Windows", "Other"]);
  const bare = os.settingsItems({ icons: false });
  assert.deepEqual(labels(bare), ["Display", "Sounds", "Windows", "Other"]);
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

test("signed in with no role on hxh: \"No role assigned. Contact system administrator.\" and Log out — never the desktop (Andrew, 2026-09-28)", async () => {
  const { os } = make({ me: { username: "test", display_name: "Test User", roles: [{ website: "bap", role: "player" }] } });
  await os.start({ apps: [Hello], autostart: ["hello"], start: true });
  const dlg = os.wm.get("win-norole");
  assert.ok(dlg && dlg.state.open);
  assert.match(dlg.el.textContent, /No role assigned\. Contact system administrator\./);
  assert.equal(os.wm.get("win-hello")?.state.open ?? false, false, "no autostart");
  assert.equal(os.user, null, "never set as the user");
  let out = 0; os.logout = () => { out++; };
  d.click(dlg.el.querySelector('[data-act="logout"]'));
  assert.equal(out, 1);
  assert.equal(os.member({ roles: [{ website: "hxh", role: "guest" }] }), true, "any hxh role is enough");
});

test("View site anonymously: the logon's blue link, a warning to confirm, then in as the shared anonymous account — no Summons, no Report a Bug (Andrew, 2026-09-28)", async () => {
  const { SummonsApp } = await import("../html/hxh/apps/summons.js");
  const { BugReportApp } = await import("../html/hxh/apps/bugs/app.js");
  const ANON = { username: "anonymous", display_name: "Anonymous", initial: "?", color: "#8a8a8a", roles: [{ website: "hxh", role: "anonymous" }] };
  const log = [];
  const fetch = fakeFetch({ "GET /admin/api/me": [401, {}], "POST /admin/api/login": init => JSON.parse(init.body).username === "anonymous" ? [200, ANON] : [401, {}] }, log);
  const os = new OS({ win: d.win, fetch, nav: new Nav({ storage: d.win.sessionStorage, location: { href: "" } }), env: { reduced: true, floating: () => true, zoom: () => 1, width: 1366, height: 900, wait: () => Promise.resolve() } });
  const started = os.start({ apps: [Hello, SummonsApp, BugReportApp], autostart: ["summons"], start: true });
  await tick();
  const logon = os.wm.get("win-logon");
  const link = logon.el.querySelector("#lg-anon");
  assert.equal(link.textContent, "View site anonymously");
  d.click(link);
  await tick();
  const warn = os.wm.get("win-anon");
  assert.ok(warn?.state.open && !logon.state.open, "the warning replaces the logon");
  assert.match(warn.el.textContent, /You will not be able to interact with other users in this mode\./);
  d.click(warn.el.querySelector('[data-act="back"]'));
  await tick();
  assert.ok(logon.state.open && !os.wm.has("win-anon"), "Back returns to the logon");
  d.click(link); await tick();
  d.click(os.wm.get("win-anon").el.querySelector('[data-act="enter"]'));
  await started;
  assert.deepEqual(log.find(l => l.path === "/admin/api/login").body, { username: "anonymous", password: "anonymous" });
  assert.equal(os.anonymous, true);
  assert.equal(os.wm.get("win-summons")?.state.open ?? false, false, "no Summons, not even at autostart");
  const icons = [...document.querySelectorAll(".icons [data-act]")].map(i => i.dataset.act);
  assert.ok(icons.includes("hello") && !icons.includes("summons") && !icons.includes("bugs"), icons.join());
});

test("the user's saved preferences load as soon as the server says who it is: the splash chime already knows Sounds are off (review, 2026-09-28)", async () => {
  d.win.localStorage.setItem("hxh.u.andrew:hxh.sound", "0");
  const { os } = make();
  const started = os.start({ apps: [Hello], start: true, splash: true });
  await new Promise(r => setTimeout(r, 40));
  assert.ok(document.querySelector(".splashscreen:not([hidden])"), "the splash is up");
  assert.equal(os.sounds.on, false, "andrew's Sounds off, before the click");
  document.querySelector(".splashscreen").click();
  await started;
  d.win.localStorage.removeItem("hxh.u.andrew:hxh.sound");
});

test("arriving from an account page (\"splash\" warmth) skips the boot but shows the splash; plain warmth skips both (Andrew, 2026-09-29)", async () => {
  d.win.sessionStorage.setItem(WARM_KEY, "splash");
  const { os } = make();
  let booted = 0; os.setup(); os.boot.run = () => { booted++; return Promise.resolve(); };
  const started = os.start({ apps: [Hello], start: true, splash: true });
  await new Promise(r => setTimeout(r, 40));
  assert.equal(booted, 0, "no boot");
  const sp = document.querySelector(".splashscreen");
  assert.ok(sp && !sp.hidden, "the splash");
  sp.click(); await started;
});

test("every OS page gets the Start button's pumpkin as its favicon, once (Andrew, 2026-09-29)", async () => {
  const { os } = make();
  await os.start({ apps: [Hello], boot: false });
  await make().os.start({ apps: [Hello], boot: false });
  const links = document.head.querySelectorAll("link[data-os-icon]");
  assert.equal(links.length, 1);
  assert.equal(links[0].getAttribute("rel"), "icon");
  const svg = decodeURIComponent(links[0].getAttribute("href").replace("data:image/svg+xml,", ""));
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.equal(svg.replace(/^<svg [^>]*>/, ""), (await import("../html/hxh/os/icons.js")).icon("pumpkin", 64).replace(/^<svg [^>]*>/, ""), "the Start button's own pumpkin");
});
