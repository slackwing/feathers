/* WakeWatch — tells the bus when the machine (or the tab) comes back.
   Browsers have no "woke from sleep" event, so this watches the proxies:
   the document becoming visible, the network coming back, the window
   regaining focus, and a heartbeat whose ticks were suspended far longer
   than its interval (timers pause while a laptop sleeps). Emits `wake`
   (debounced) so apps can resync whatever a dead socket missed. */
export class WakeWatch {
  constructor({ win = globalThis.window, bus, now = () => Date.now(), interval = 15000, gap = 45000, debounce = 2000 } = {}) {
    this.win = win; this.bus = bus; this.now = now; this.interval = interval; this.gap = gap; this.debounce = debounce;
    this.last = now(); this.lastEmit = 0; this.timer = null; this.wakes = 0;
  }

  start() {
    const w = this.win, d = w.document;
    this._onVis = () => { if (d.visibilityState === "visible") this.wake("visible"); };
    this._onOnline = () => this.wake("online");
    this._onFocus = () => this.wake("focus");
    d.addEventListener("visibilitychange", this._onVis);
    w.addEventListener("online", this._onOnline);
    w.addEventListener("focus", this._onFocus);
    this.timer = setInterval(() => this.tick(), this.interval);
    this.timer.unref?.();
    return this;
  }

  stop() {
    const w = this.win, d = w.document;
    d.removeEventListener("visibilitychange", this._onVis);
    w.removeEventListener("online", this._onOnline);
    w.removeEventListener("focus", this._onFocus);
    clearInterval(this.timer);
  }

  /** A heartbeat that arrives much later than scheduled means the clock ran
      while we didn't — unless the tab is hidden, where browsers slow timers
      to once a minute on purpose (coming back fires visibilitychange). */
  tick() {
    const t = this.now();
    if (t - this.last > this.gap && this.win.document.visibilityState !== "hidden") this.wake("sleep");
    this.last = t;
  }

  wake(reason) {
    const t = this.now();
    if (t - this.lastEmit < this.debounce) return false;
    this.lastEmit = t; this.wakes++;
    this.bus?.emit("wake", { reason, at: t });
    return true;
  }
}
