/* Env — everything the OS needs to know about the host: whether windows
   float (desktop) or stack (phone), the page zoom, reduced-motion, and a
   promise-based wait. Takes the window object so tests can hand in jsdom. */
/** The width (CSS px) the desktop was designed at: zoom 1 makes the
    island exactly half the view there. */
export const DESIGN_WIDTH = 1366;

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

  /** Desktop layout: windows float and drag. The whole site zooms with the
      viewport instead of stacking on phones (Andrew, 2026-09-19); a page
      can still opt out with body.nofloat / body.stacked. */
  floating() {
    const cl = this.win.document?.body?.classList;
    return !(cl?.contains("nofloat") || cl?.contains("stacked"));
  }

  /** The zoom the whale rule wants: the island is the middle half of the
      view at every width, i.e. everything scales with vw / DESIGN_WIDTH. */
  wantedZoom() {
    return (this.win.innerWidth || DESIGN_WIDTH) / DESIGN_WIDTH;
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
