/* Env — everything the OS needs to know about the host: whether windows
   float (desktop) or stack (phone), the page zoom, reduced-motion, and a
   promise-based wait. Takes the window object so tests can hand in jsdom. */
/** The width (CSS px) the desktop was designed at. */
export const DESIGN_WIDTH = 1366;

/* THE WHALE RULE (Andrew, 2026-09-19, third wording): the art is drawn
   at ONE fixed scale — 5 screen px per art px, what a 1366×900 screen
   showed (island 760 px wide) — so a big monitor feels like a big
   desktop: same-sized windows and whale, more ocean and sky around
   them. The island may never take more than 85 % of the width, so on
   narrow views the scale is capped and the whole site shrinks by the
   same factor; it never grows. */
export const WHALE = { artW: 320, artH: 180, span: 152, center: 164, maxShare: 0.85, horizon: 0.62, scale: 5 };

/** Scale (screen px per art px), site zoom, and the canvas columns/rows
    that cover a vw × vh view. */
export function whale(vw = 1366, vh = 900) {
  vw = Math.max(1, vw); vh = Math.max(1, vh);
  const cap = WHALE.maxShare * vw / WHALE.span;
  const scale = Math.min(WHALE.scale, cap);
  return { scale, zoom: scale / WHALE.scale, W: Math.ceil(vw / scale), H: Math.min(1400, Math.ceil(vh / scale)) };
}

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

  /** The zoom the whale rule wants (≤ 1; below 1 only when the island would exceed 85 % of the width). */
  wantedZoom() {
    return whale(this.win.innerWidth || DESIGN_WIDTH, this.win.innerHeight || 900).zoom;
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
