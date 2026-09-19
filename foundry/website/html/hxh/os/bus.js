/* EventBus — the OS's nervous system. Every cross-component message goes
   through one of these (the OS bus for app/taskbar/tray traffic, a private
   one per Component for its own events). Handlers are isolated: one
   throwing never stops the others. `on` returns an unsubscribe. */
export class EventBus {
  constructor() {
    this.handlers = new Map();
  }

  on(event, fn) {
    if (typeof fn !== "function") throw new TypeError(`handler for "${event}" must be a function`);
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(fn);
    return () => this.off(event, fn);
  }

  once(event, fn) {
    const off = this.on(event, payload => { off(); fn(payload); });
    return off;
  }

  off(event, fn) {
    const set = this.handlers.get(event);
    if (!set) return;
    set.delete(fn);
    if (!set.size) this.handlers.delete(event);
  }

  /** Emit to every handler; returns how many ran. */
  emit(event, payload) {
    const set = this.handlers.get(event);
    if (!set) return 0;
    let n = 0;
    for (const fn of [...set]) {
      try { fn(payload); n++; }
      catch (err) { (globalThis.console || {}).error?.(`[bus] handler for "${event}" threw`, err); }
    }
    return n;
  }

  count(event) {
    return this.handlers.get(event)?.size ?? 0;
  }

  clear() {
    this.handlers.clear();
  }
}
