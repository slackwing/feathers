import { test } from "node:test";
import assert from "node:assert/strict";
import { ChatClient, ChatAPI, wsURL } from "../html/hxh/apps/chat/client.js";
import { fakeFetch } from "./dom.js";

/** A scriptable WebSocket: sockets.at(-1) is the newest; open()/close()/push() drive it. */
function fakeWS() {
  const sockets = [];
  class WS {
    constructor(url) { this.url = url; this.sent = []; this.readyState = 0; sockets.push(this); }
    send(d) { if (this.readyState !== 1) throw new Error("not open"); const f = JSON.parse(d); this.sent.push(f); if (this.autopong && f.t === "ping") this.push({ t: "pong" }); }
    close() { if (this.readyState === 3) return; this.readyState = 3; this.onclose?.({}); }
    open() { this.readyState = 1; this.onopen?.(); }
    push(obj) { this.onmessage?.({ data: JSON.stringify(obj) }); }
  }
  return { WS, sockets };
}

/** Manual timers: run(ms) advances the clock and fires due timers. */
function clock() {
  let t = 0, seq = 0;
  const timers = new Map();
  return {
    now: () => t,
    setTimeout: (fn, ms) => { const id = ++seq; timers.set(id, { at: t + ms, fn }); return id; },
    clearTimeout: id => timers.delete(id),
    run(ms) { const end = t + ms; for (;;) { const due = [...timers].filter(([, x]) => x.at <= end).sort((a, b) => a[1].at - b[1].at); if (!due.length) break; const [id, x] = due[0]; timers.delete(id); t = Math.max(t, x.at); x.fn(); } t = end; },
    /** the machine slept: the clock moves, no timer fires */
    jump(ms) { t += ms; },
    pending: () => timers.size,
  };
}

function make(opts = {}) {
  const { WS, sockets } = fakeWS();
  const c = clock();
  const client = new ChatClient({ url: "ws://x/ws", WebSocket: WS, now: c.now, setTimeout: c.setTimeout, clearTimeout: c.clearTimeout, pingMs: 1000, backoff: [100, 200, 500], ...opts });
  const got = [];
  for (const ev of ["open", "close", "reconnect", "hello", "msg", "typing", "presence", "error", "state", "read"]) client.on(ev, p => got.push([ev, p]));
  return { client, sockets, c, got };
}

test("wsURL follows the page's scheme", () => {
  assert.equal(wsURL({ protocol: "https:", host: "andrewcheong.com" }), "wss://andrewcheong.com/hxh/api/chat/ws");
  assert.equal(wsURL({ protocol: "http:", host: "127.0.0.1:8767" }), "ws://127.0.0.1:8767/hxh/api/chat/ws");
});

test("connect, hello and routed frames", () => {
  const { client, sockets, got } = make();
  client.connect(); client.connect();   // idempotent
  assert.equal(sockets.length, 1);
  const ws = sockets[0];
  ws.open();
  assert.equal(client.connected, true);
  ws.push({ t: "hello", me: "andrew", contacts: [] });
  ws.push({ t: "msg", msg: { id: 1, room: "global", sender: "abi", body: "hi" } });
  ws.push({ t: "typing", room: "global", user: "abi" });
  ws.push({ t: "presence", user: "abi", state: "away", last_seen_at: null });
  ws.push({ t: "error", code: "rate", room: "global" });
  ws.push({ t: "read", room: "global", id: 7 });
  ws.push({ t: "weird" });
  ws.onmessage({ data: "not json" });
  assert.deepEqual(got.map(g => g[0]), ["open", "state", "hello", "msg", "typing", "presence", "error", "read"]);
  assert.deepEqual(got.at(-1)[1], { room: "global", id: 7 });
  assert.equal(client.read("global", 7), true);
  assert.deepEqual(ws.sent.at(-1), { t: "read", room: "global", id: 7 });
  assert.equal(got[3][1].body, "hi");
  assert.equal(got[5][1].state, "away");
});

test("queues while offline, flushes on open; typing only when connected", () => {
  const { client, sockets } = make();
  client.connect();
  assert.equal(client.send({ t: "ping" }), false);
  assert.equal(client.typing("global"), false);
  sockets[0].open();
  assert.deepEqual(sockets[0].sent, [{ t: "ping" }]);
  assert.equal(client.typing("global"), true);
  assert.equal(client.typing("global"), false);   // throttled for 2 s
  assert.equal(client.typing("dm:a:b"), true);    // per room
});

test("rate limit: ten messages a second, then refused until the window passes", () => {
  const { client, sockets, c } = make();
  client.connect(); sockets[0].open();
  for (let i = 0; i < 10; i++) assert.equal(client.sendMessage("global", "m" + i), true);
  assert.equal(client.sendMessage("global", "eleven"), false);
  assert.equal(sockets[0].sent.filter(f => f.t === "msg").length, 10);
  c.run(1000);
  assert.equal(client.sendMessage("global", "later"), true);
});

test("heartbeat pings and drops a socket whose ping goes unanswered; reconnects with backoff", () => {
  const { client, sockets, c, got } = make();
  client.connect(); sockets[0].open();
  assert.deepEqual(got.at(-2), ["open", { reconnect: false }]);
  sockets[0].push({ t: "pong" });
  c.run(1000);
  assert.deepEqual(sockets[0].sent, [{ t: "ping" }]);
  sockets[0].push({ t: "pong" });
  c.run(1000);
  assert.equal(sockets[0].sent.length, 2);   // answered: pinged again
  c.run(1000);   // that ping went unanswered for a whole interval → dead: dropped and replaced at once
  assert.equal(sockets[0].readyState, 3);
  assert.equal(sockets[0].onclose, null);   // the corpse cannot disturb the new socket
  assert.equal(client.connected, false);
  assert.ok(got.some(g => g[0] === "close"));
  assert.equal(sockets.length, 2);   // no backoff for a socket we know is dead
  sockets[1].close();   // fails before opening: no "close" event, next step is the first backoff
  const closes = got.filter(g => g[0] === "close").length;
  c.run(99);
  assert.equal(sockets.length, 2);
  c.run(1);
  assert.equal(sockets.length, 3);
  assert.equal(got.filter(g => g[0] === "close").length, closes);
  sockets[2].open();
  assert.deepEqual(got.at(-3), ["open", { reconnect: true }]);
  assert.equal(got.at(-1)[0], "reconnect");   // after open + state, so hello handlers are wired
  assert.equal(client.attempts, 0);
  client.close();
  assert.equal(sockets[2].readyState, 3);
  c.run(10000);
  assert.equal(sockets.length, 3);   // stopped: no reconnect
});

test("a slow hidden tab is not mistaken for a dead link: staleness counts from the ping", () => {
  const { client, sockets, c } = make();
  client.connect(); sockets[0].open();
  for (let i = 0; i < 5; i++) {
    c.jump(59000);   // the browser held the heartbeat tick for a minute…
    c.run(0);        // …then let it fire: it pings
    assert.equal(client.stale(), false);
    sockets[0].push({ t: "pong" });   // answered promptly, as a live link does
  }
  assert.equal(sockets[0].sent.length, 5);
  assert.equal(sockets.length, 1);
  assert.equal(client.connected, true);
});

test("a probe condemns a socket that looks fine but never answers", () => {
  const { client, sockets, c, got } = make({ pingMs: 100000 });
  client.connect(); sockets[0].open();
  c.jump(8 * 3600 * 1000);                        // asleep; nothing was pending when the lid closed
  assert.equal(client.stale(), false);
  assert.equal(client.nudge(), false);            // so it is probed…
  assert.deepEqual(sockets[0].sent, [{ t: "ping" }]);
  c.run(2999);
  assert.equal(sockets.length, 1);
  c.run(1);                                       // …and three seconds of silence condemn it
  assert.equal(sockets.length, 2);
  assert.equal(sockets[0].readyState, 3);
  assert.equal(client.connected, false);
  assert.ok(got.some(g => g[0] === "close"));
  sockets[1].open();
  assert.equal(got.at(-1)[0], "reconnect");
});

test("nudge after a sleep: a stale socket is replaced now, a backoff is skipped, a healthy one is probed", () => {
  const { client, sockets, c, got } = make();
  client.connect(); sockets[0].open(); sockets[0].autopong = true;
  // healthy: a probe ping goes out, the pong keeps the socket
  assert.equal(client.nudge(), false);
  assert.deepEqual(sockets[0].sent, [{ t: "ping" }]);
  assert.equal(client.nudge(), false);           // one probe at a time
  assert.equal(sockets[0].sent.length, 1);
  c.run(3000);                                   // heartbeats answered, the probe deadline passes quietly
  assert.equal(sockets.length, 1);
  // the machine sleeps for eight hours; the socket died in its sleep without a close event
  sockets[0].autopong = false;
  c.jump(8 * 3600 * 1000);
  assert.equal(client.stale(), false);            // nothing was pending: by the book it looks fine
  assert.equal(client.nudge(), false);            // so it is probed…
  c.run(3000);                                    // …and silence condemns it
  assert.equal(sockets.length, 2);
  assert.equal(sockets[0].readyState, 3);
  assert.ok(got.some(g => g[0] === "close"));
  sockets[1].open();
  assert.equal(got.at(-1)[0], "reconnect");
  // a ping already out and unanswered: dropped on the spot
  c.run(1000);                                    // tick pings
  c.jump(60000);
  assert.equal(client.stale(), true);
  assert.equal(client.nudge(), true);
  assert.equal(sockets.length, 3);
  // waiting out a backoff when the network returns: reconnect now
  sockets[2].close();                             // failed before opening → backoff 100
  assert.equal(client.reconnectTimer !== null, true);
  assert.equal(client.nudge(), true);
  assert.equal(sockets.length, 4);
  assert.equal(client.reconnectTimer, null);
  c.run(1000);
  assert.equal(sockets.length, 4);                // the cancelled backoff did not double up
  sockets[3].open();
  client.close();
  assert.equal(client.nudge(), false);
  assert.equal(sockets.length, 4);
});

test("a ping says whether this tab is focused — a background tab's heartbeat carries no focus", () => {
  let focused = true;
  const { client, sockets, c } = make({ focus: () => focused });
  client.connect(); sockets[0].open();
  c.run(1000);
  assert.deepEqual(sockets[0].sent.at(-1), { t: "ping", focus: true });
  sockets[0].push({ t: "pong" });
  focused = false;
  c.run(1000);
  assert.deepEqual(sockets[0].sent.at(-1), { t: "ping" });
});

test("a message can carry a picture id; pictures upload as raw bytes and are addressed by id", async () => {
  const { client, sockets } = make();
  client.connect(); sockets[0].open();
  assert.equal(client.sendMessage("global", "look", 9), true);
  assert.deepEqual(sockets[0].sent.at(-1), { t: "msg", room: "global", body: "look", image_id: 9 });
  client.sendMessage("global", "plain");
  assert.deepEqual(sockets[0].sent.at(-1), { t: "msg", room: "global", body: "plain" });   // no image_id key when there is none
  const log = [];
  const api = new ChatAPI({ fetch: fakeFetch({ "POST /hxh/api/chat/image": init => [200, { id: 9, width: 300, height: 200 }] }, log) });
  const blob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
  assert.deepEqual(await api.uploadImage(blob), { id: 9, width: 300, height: 200 });
  assert.equal(log[0].method, "POST");
  assert.equal(log[0].headers["Content-Type"], "image/png");
  assert.equal(log[0].body, blob);   // the bytes themselves, not JSON
  assert.equal(api.imageURL(9), "/hxh/api/chat/image/9");
});

test("a host without WebSocket stays quiet", () => {
  const client = new ChatClient({ url: "ws://x", WebSocket: undefined });
  client.connect();
  assert.equal(client.connected, false);
});

test("ChatAPI calls the endpoints", async () => {
  const log = [];
  const api = new ChatAPI({ fetch: fakeFetch({
    "GET /hxh/api/chat/contacts": [200, { me: "a", contacts: [] }],
    "GET /hxh/api/chat/history?room=dm%3Aa%3Ab": [200, { room: "dm:a:b", messages: [] }],
    "GET /hxh/api/chat/profile/abi": [200, { username: "abi", runs: [] }],
    "PUT /hxh/api/chat/profile": [200, { username: "a", runs: [{ t: "x" }] }],
  }, log) });
  assert.deepEqual(await api.contacts(), { me: "a", contacts: [] });
  assert.deepEqual((await api.history("dm:a:b")).messages, []);
  assert.equal((await api.profile("abi")).username, "abi");
  assert.deepEqual((await api.saveProfile([{ t: "x" }])).runs, [{ t: "x" }]);
  assert.deepEqual(log[3].body, { runs: [{ t: "x" }] });
  await assert.rejects(() => api.history("nope"), /404/);
});
