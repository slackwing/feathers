/* Env — everything the OS needs to know about the host: whether windows
   float (desktop) or stack (phone), the page zoom, reduced-motion, and a
   promise-based wait. Takes the window object so tests can hand in jsdom. */
export class Env {
  constructor(win = globalThis.window) {
    this.win = win;
  }

  match(query) {
    try { return !!this.win.matchMedia?.(query)?.matches; }
    catch { return false; }
  }

  /** Reduced-motion preference: animations and typewriters go instant. */
  get reduced() {
    return this.match("(prefers-reduced-motion: reduce)");
  }

  /** Desktop layout: windows float and drag. Phones stack them in flow. */
  floating() {
    return this.match("(min-width: 900px)") && !this.win.document?.body?.classList.contains("nofloat");
  }

  /** CSS zoom on <body>, if any — pointer/viewport pixels must be divided by it. */
  zoom() {
    try { return parseFloat(this.win.getComputedStyle(this.win.document.body).zoom) || 1; }
    catch { return 1; }
  }

  /** Viewport in layout pixels. */
  get width() { return (this.win.innerWidth || 0) / this.zoom(); }
  get height() { return (this.win.innerHeight || 0) / this.zoom(); }

  wait(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}
