/* Live — keep a window's content current without reopening it (Andrew,
   2026-09-21: "every app live-loading"). An app hands over a window, a
   period and a refresh function; the refresh runs on the timer while
   that window is open and the page is visible, and again the moment the
   page comes back into view. Apps with a push channel (BeetleChat's
   socket) do not need this; apps that read a database do. */
export class Live {
  constructor({ doc = null, setInterval: si = globalThis.setInterval.bind(globalThis), clearInterval: ci = globalThis.clearInterval.bind(globalThis) } = {}) {
    this.doc = doc;
    this.si = si;
    this.ci = ci;
    this.jobs = new Set();
    doc?.addEventListener?.("visibilitychange", () => { if (!doc.hidden) this.wake(); });
  }

  /** Run fn every ms while win is open and the page visible. Returns a stop function. */
  every(win, ms, fn) {
    const job = { win, fn, timer: null };
    job.timer = this.si(() => this.run(job), ms);
    job.timer?.unref?.();   // node: a live clock must not keep a test process alive
    this.jobs.add(job);
    return () => { this.ci(job.timer); this.jobs.delete(job); };
  }

  run(job) {
    if (!job.win?.state?.open || this.doc?.hidden) return;
    try { Promise.resolve(job.fn()).catch(() => {}); } catch { /* a refresh that throws must not stop the timer */ }
  }

  /** Every due job at once — the page came back, or a test wants a tick. */
  wake() { for (const job of this.jobs) this.run(job); }
}
