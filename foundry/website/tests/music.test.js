import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { OS } from "../html/hxh/os/os.js";
import { MusicApp, VIDEO, YT_ORIGIN, embedSrc, besideSummons, WIDTH, MIN_W, OVERLAP, DROP } from "../html/hxh/apps/music.js";
import { SummonsApp, SUMMONS_AT, SUMMONS_W } from "../html/hxh/apps/summons.js";
import * as apps from "../html/hxh/apps/index.js";
import { hasIconPair, DESK } from "../html/hxh/os/icons.js";

const ME = { username: "abi", display_name: "Abi", roles: [{ website: "hxh", role: "guest" }] };
let d, os;
function make({ width = 1366 } = {}) {
  d = setupDom({ width });
  os = new OS({ win: d.win, fetch: async () => ({ ok: true, json: async () => ME }), env: { reduced: true, floating: () => true, zoom: () => 1, width, height: 900, wait: () => Promise.resolve() } });
  return os;
}
beforeEach(() => make());

test("Music: an app on the desktop and in Start, with a note icon at both sizes (Andrew, 2026-09-28)", async () => {
  assert.equal(apps.Music, MusicApp);
  await os.start({ apps: [MusicApp], start: true, boot: false });
  assert.ok(hasIconPair("music") && DESK.music, "16-grid and 20-grid");
  assert.ok(os.startItems().some(i => i.label === "Music"));
});

test("the player: the YouTube embed of the one video, autoplaying with sound allowed, looping, no cookies until it plays", async () => {
  await os.start({ apps: [MusicApp], boot: false });
  await os.launch("music");
  const w = os.wm.get("win-music"), f = w.$(".vid iframe");
  assert.equal(w.title, "Music");
  assert.ok(f, "the embed is in the window");
  const u = new URL(f.getAttribute("src"));
  assert.equal(u.origin + u.pathname, `https://www.youtube-nocookie.com/embed/${VIDEO}`);
  assert.equal(VIDEO, "lMmoUqf4Ags");
  assert.equal(u.searchParams.get("autoplay"), "1");
  assert.equal(u.searchParams.get("loop"), "1");
  assert.equal(u.searchParams.get("playlist"), VIDEO, "a single video loops only as its own playlist");
  assert.match(f.getAttribute("allow"), /\bautoplay\b/, "the page's click on the title screen is passed on, so it may play with sound");
  assert.equal(f.getAttribute("referrerpolicy"), "strict-origin-when-cross-origin", "YouTube refuses embeds that send no referrer");
  assert.equal(embedSrc(VIDEO, d.win.location.origin), f.getAttribute("src"));
  assert.equal(new URL(f.getAttribute("src")).searchParams.get("origin"), d.win.location.origin, "the player is told our origin, as YouTube's widget API does");
  assert.equal(w.el.querySelector(".mbar"), null, "no menu bar: a title bar and the video (File › Exit would only repeat the ×)");
});

test("closing the player stops the music (the embed goes); minimizing keeps it playing; launching it again while open does not restart it", async () => {
  await os.start({ apps: [MusicApp], boot: false });
  await os.launch("music");
  const w = os.wm.get("win-music"), f = w.$(".vid iframe");
  await os.launch("music");
  assert.equal(w.$(".vid iframe"), f, "the same embed: the song keeps going");
  os.wm.minimize(w.id);
  assert.equal(w.$(".vid iframe"), f, "minimized: still playing");
  await os.launch("music");
  assert.equal(w.$(".vid iframe"), f);
  os.wm.close(w.id);
  assert.equal(w.$(".vid iframe"), null, "closed: silence");
  await os.launch("music");
  assert.ok(w.$(".vid iframe") && w.$(".vid iframe") !== f, "opened again: a fresh embed, playing from the start");
});

test("besideSummons: the player's left edge tucked OVERLAP px under the Summons' right edge and a little lower; a narrower desktop narrows it first, then tucks more of it under", () => {
  const edge = SUMMONS_AT.x + SUMMONS_W;
  assert.deepEqual(besideSummons(1366), { x: edge - OVERLAP, y: SUMMONS_AT.y + DROP, w: WIDTH }, "Andrew's 1366: the whole player, 38 px of it under the Summons");
  assert.deepEqual(besideSummons(2560), besideSummons(1366), "a wide screen keeps it beside the Summons, not off in a corner");
  const mid = besideSummons(1280);
  assert.equal(mid.x, edge - OVERLAP);
  assert.ok(mid.w < WIDTH && mid.w >= MIN_W && mid.x + mid.w <= 1280, "narrower, still fully on screen");
  assert.ok(OVERLAP / mid.w < 0.15, "most of the video in sight");
  const tight = besideSummons(1100);
  assert.equal(tight.w, MIN_W);
  assert.ok(tight.x + tight.w <= 1100 && tight.x < edge - OVERLAP, "no narrower than MIN_W: tucked further under instead");
});

test("a first visit: the player opens and plays first, then the Summons lands on top, active, overlapping only the player's left edge (Andrew, 2026-09-28)", async () => {
  const order = [];
  os.bus.on("window:open", ({ id }) => order.push(id));
  await os.start({ apps: [SummonsApp, MusicApp], autostart: ["music", "summons"], boot: false });
  assert.deepEqual(order.filter(id => id === "win-music" || id === "win-summons"), ["win-music", "win-summons"], "the player first");
  const m = os.wm.get("win-music"), s = os.wm.get("win-summons");
  assert.ok(m.$(".vid iframe"), "playing");
  assert.equal(os.wm.active, s, "the Summons is the active window");
  assert.ok(+s.el.style.zIndex > +m.el.style.zIndex, "and on top");
  const at = besideSummons(1366);
  assert.deepEqual([m.el.style.left, m.el.style.top, m.el.style.width], [`${at.x}px`, `${at.y}px`, `${at.w}px`]);
  assert.equal(parseInt(s.el.style.left) + parseInt(s.el.style.width) - parseInt(m.el.style.left), OVERLAP, "the Summons covers only a strip of the player");
});

test("the index page autostarts BeetleChat, the player, then the Summons (Andrew, 2026-09-29)", async () => {
  const fs = await import("node:fs");
  const html = fs.readFileSync(new URL("../html/hxh/index.html", import.meta.url), "utf8");
  assert.match(html, /autostart: \["chat", "music", "summons"\]/);
  assert.match(html, /HxH\.apps\.Music\b/);
});

test("a refused autoplay starts on the first tap anywhere; once it has played, a pause is the listener's — taps elsewhere never restart it (Andrew, 2026-09-28)", async () => {
  await os.start({ apps: [MusicApp], boot: false });
  await os.launch("music");
  const app = os.registry.get("music"), said = [];
  app.say = m => said.push(m.func || m.event);
  const player = app.frame.contentWindow;
  const report = (state, origin = YT_ORIGIN) => d.win.dispatchEvent(new d.win.MessageEvent("message", { source: player, origin, data: JSON.stringify({ event: "onStateChange", info: state }) }));
  const tap = () => d.doc.body.dispatchEvent(new d.win.Event("pointerdown", { bubbles: true }));
  report(-1);   // unstarted: the browser refused
  tap();
  assert.deepEqual(said, ["playVideo"], "the first tap starts it");
  report(1); report(2);   // it played, then the listener paused it
  tap(); tap();
  assert.deepEqual(said, ["playVideo"], "paused by the listener: a tap elsewhere leaves it paused");
});

test("music talks only to YouTube: commands go to its origin alone, and a message from any other origin is ignored (review, 2026-09-28)", async () => {
  await os.start({ apps: [MusicApp], boot: false });
  await os.launch("music");
  const app = os.registry.get("music"), player = app.frame.contentWindow, sent = [];
  player.postMessage = (msg, target) => sent.push([JSON.parse(msg).event || JSON.parse(msg).func, target]);
  app.listen();
  assert.deepEqual(sent[0], ["listening", YT_ORIGIN], "the handshake, to YouTube only");
  d.win.dispatchEvent(new d.win.MessageEvent("message", { source: player, origin: "https://evil.example", data: JSON.stringify({ event: "onStateChange", info: 1 }) }));
  assert.equal(app.started, false, "another origin cannot say it is playing");
  d.win.dispatchEvent(new d.win.MessageEvent("message", { source: player, origin: YT_ORIGIN, data: JSON.stringify({ event: "onStateChange", info: 1 }) }));
  assert.ok(app.started && app.heard, "the player can");
  os.wm.close("win-music");
});
