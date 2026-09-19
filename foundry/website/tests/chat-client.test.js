import { test } from "node:test";
import assert from "node:assert/strict";
import { ChatClient, ChatAPI, wsURL } from "../html/hxh/apps/chat/client.js";
import { fakeFetch } from "./dom.js";

/** A scriptable WebSocket: sockets.at(-1) is the newest; open()/close()/push() drive it. */
function fakeWS() {
  const sockets = [];
  class WS {
    constructor(url) { this.url = url; this.sent = []; this.readyState = 0; sockets.push(this); }
    send(d) { if (this.readyState !== 1) throw new Error("not open"); this.sent.push(JSON.parse(d)); }
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
    run(ms) { const end = t + ms; for (;;) { const due = [...timers].filter(([, x]) => x.at <= end).sort((a, b) => a[1].at - b[1].at); if (!due.length) break; const [id, x] = due[0]; timers.delete(id); t = x.at; x.fn(); } t = end; },
    pending: () => timers.size,
  };
}

function make(opts = {}) {
  const { WS, sockets } = fakeWS();
  const c = clock();
  const client = new ChatClient({ url: "ws://x/ws", WebSocket: WS, now: c.now, setTimeout: c.setTimeout, clearTimeout: c.clearTimeout, pingMs: 1000, backoff: [100, 200, 500], ...opts });
  const got = [];
  for (const ev of ["open", "close", "hello", "msg", "typing", "presence", "error", "state"]) client.on(ev, p => got.push([ev, p]));
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
  ws.push({ t: "weird" });
  ws.onmessage({ data: "not json" });
  assert.deepEqual(got.map(g => g[0]), ["open", "state", "hello", "msg", "typing", "presence", "error"]);
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

test("heartbeat pings and drops a socket whose pong is late; reconnects with backoff", () => {
  const { client, sockets, c, got } = make();
  client.connect(); sockets[0].open();
  sockets[0].push({ t: "pong" });
  c.run(1000);
  assert.deepEqual(sockets[0].sent, [{ t: "ping" }]);
  sockets[0].push({ t: "pong" });
  c.run(1000);
  assert.equal(sockets[0].sent.length, 2);
  c.run(1000);   // no pong answered the second ping → still within 2 intervals
  c.run(1000);   // now two intervals late → closed
  assert.equal(sockets[0].readyState, 3);
  assert.equal(client.connected, false);
  assert.ok(got.some(g => g[0] === "close"));
  assert.equal(sockets.length, 1);
  c.run(100);    // first backoff step
  assert.equal(sockets.length, 2);
  sockets[1].close();   // fails before opening: no "close" event, next step is 200
  const closes = got.filter(g => g[0] === "close").length;
  c.run(199);
  assert.equal(sockets.length, 2);
  c.run(1);
  assert.equal(sockets.length, 3);
  assert.equal(got.filter(g => g[0] === "close").length, closes);
  sockets[2].open();
  assert.equal(client.attempts, 0);
  client.close();
  assert.equal(sockets[2].readyState, 3);
  c.run(10000);
  assert.equal(sockets.length, 3);   // stopped: no reconnect
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
