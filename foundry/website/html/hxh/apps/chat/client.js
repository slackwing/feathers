/* ChatClient — the live channel to the hub (hub.go): one WebSocket,
   JSON frames, a ping every 25 s, reconnect with backoff, a send queue
   while offline, and the client-side courtesies the spec asks for (at
   most 10 messages a second; "typing" at most every 2 s per room).
   Everything injectable (WebSocket class, timers, clock) for tests. */
import { EventBus } from "../../os/bus.js";

export const DEFAULT_BACKOFF = [1000, 2000, 5000, 10000, 30000];

export function wsURL(location) {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/hxh/api/chat/ws`;
}

export class ChatClient {
  constructor({ url, WebSocket: WS, pingMs = 25000, backoff = DEFAULT_BACKOFF, now = () => Date.now(),
    setTimeout: st = (f, ms) => globalThis.setTimeout(f, ms), clearTimeout: ct = id => globalThis.clearTimeout(id),
    typingEvery = 2000, rate = 10 } = {}) {
    this.url = url; this.WS = WS; this.pingMs = pingMs; this.backoff = backoff; this.now = now;
    this.st = st; this.ct = ct; this.typingEvery = typingEvery; this.rate = rate;
    this.events = new EventBus();
    this.ws = null; this.connected = false; this.stopped = false; this.attempts = 0;
    this.queue = []; this.sent = []; this.lastTyping = new Map(); this.lastPong = 0;
    this.pingTimer = null; this.reconnectTimer = null;
  }

  on(ev, fn) { return this.events.on(ev, fn); }
  emit(ev, p) { return this.events.emit(ev, p); }

  connect() {
    if (this.ws || this.stopped || !this.WS) return this;
    let ws;
    try { ws = new this.WS(this.url); } catch (err) { this.emit("error", { code: "connect", err }); this.scheduleReconnect(); return this; }
    this.ws = ws;
    ws.onopen = () => {
      this.connected = true; this.attempts = 0; this.lastPong = this.now();
      this.emit("open"); this.emit("state", { connected: true });
      for (const f of this.queue.splice(0)) this.raw(f);
      this.startPing();
    };
    ws.onmessage = e => this.receive(e.data);
    ws.onerror = () => {};
    ws.onclose = () => {
      const was = this.connected;
      this.ws = null; this.connected = false; this.stopPing();
      if (was) { this.emit("close"); this.emit("state", { connected: false }); }
      if (!this.stopped) this.scheduleReconnect();
    };
    return this;
  }

  scheduleReconnect() {
    if (this.reconnectTimer || this.stopped) return;
    const delay = this.backoff[Math.min(this.attempts, this.backoff.length - 1)];
    this.attempts++;
    this.reconnectTimer = this.st(() => { this.reconnectTimer = null; this.connect(); }, delay);
  }

  startPing() {
    this.stopPing();
    this.pingTimer = this.st(() => this.tick(), this.pingMs);
    this.pingTimer?.unref?.();
  }
  stopPing() { if (this.pingTimer) { this.ct(this.pingTimer); this.pingTimer = null; } }

  /** Ping, and give up on a socket whose pong is two intervals late. */
  tick() {
    if (!this.connected) return;
    if (this.now() - this.lastPong > this.pingMs * 2) { this.ws?.close(); return; }
    this.raw({ t: "ping" });
    this.startPing();
  }

  receive(data) {
    let f;
    try { f = JSON.parse(data); } catch { return; }
    switch (f.t) {
      case "pong": this.lastPong = this.now(); break;
      case "hello": this.emit("hello", f); break;
      case "msg": this.emit("msg", f.msg); break;
      case "typing": this.emit("typing", { room: f.room, user: f.user }); break;
      case "presence": this.emit("presence", { user: f.user, state: f.state, last_seen_at: f.last_seen_at }); break;
      case "error": this.emit("error", { code: f.code, room: f.room }); break;
      default: break;
    }
  }

  raw(frame) {
    try { this.ws.send(JSON.stringify(frame)); return true; } catch { return false; }
  }

  /** Send now, or queue until the socket is back (bounded). */
  send(frame) {
    if (this.connected && this.ws) return this.raw(frame);
    if (this.queue.length < 100) this.queue.push(frame);
    return false;
  }

  /** Rate-limited: at most `rate` messages per second. Returns false when refused. */
  sendMessage(room, body) {
    const t = this.now();
    this.sent = this.sent.filter(x => t - x < 1000);
    if (this.sent.length >= this.rate) return false;
    this.sent.push(t);
    this.send({ t: "msg", room, body });
    return true;
  }

  /** "Is typing" — throttled per room; only while connected. */
  typing(room) {
    if (!this.connected) return false;
    const t = this.now(), last = this.lastTyping.get(room);
    if (last !== undefined && t - last < this.typingEvery) return false;
    this.lastTyping.set(room, t);
    this.raw({ t: "typing", room });
    return true;
  }

  close() {
    this.stopped = true;
    this.stopPing();
    if (this.reconnectTimer) { this.ct(this.reconnectTimer); this.reconnectTimer = null; }
    this.ws?.close();
  }
}

/** The request/response side (chat.go). */
export class ChatAPI {
  constructor({ fetch = globalThis.fetch?.bind(globalThis), base = "/hxh/api/chat" } = {}) {
    this.fetch = fetch; this.base = base;
  }
  async get(path) {
    const r = await this.fetch(this.base + path, { cache: "no-store" });
    if (!r.ok) throw new Error(`${path}: ${r.status}`);
    return r.json();
  }
  contacts() { return this.get("/contacts"); }
  history(room) { return this.get("/history?room=" + encodeURIComponent(room)); }
  profile(username) { return this.get("/profile/" + encodeURIComponent(username)); }
  async saveProfile(runs) {
    const r = await this.fetch(this.base + "/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runs }) });
    if (!r.ok) throw new Error(await r.text().catch(() => r.status));
    return r.json();
  }
}
