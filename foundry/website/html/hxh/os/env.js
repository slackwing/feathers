/* Env — everything the OS needs to know about the host: whether windows
   float (desktop) or stack (phone), the page zoom, reduced-motion, and a
   promise-based wait. Takes the window object so tests can hand in jsdom. */
/** The width (CSS px) the desktop was designed at. */
export const DESIGN_WIDTH = 1366;

/* THE WHALE RULE (Andrew, 2026-09-19, second wording): the wallpaper
   scales as it naturally wants — the 320×180 art covering the view —
   but the island may never take more than 85 % of the width, so a phone
   still shows ocean on both sides. When the cap bites, the whole site
   shrinks by the same factor; otherwise the site is at its natural
   zoom of 1. */
export const WHALE = { artW: 320, artH: 180, span: 152, center: 164, maxShare: 0.85, horizon: 0.62 };

/** Scale (screen px per art px), site zoom, and the canvas columns/rows
    that cover a vw × vh view. */
export function whale(vw = 1366, vh = 900) {
  vw = Math.max(1, vw); vh = Math.max(1, vh);
  const natural = Math.max(vw / WHALE.artW, vh / WHALE.artH);   // object-fit: cover
  const cap = WHALE.maxShare * vw / WHALE.span;
  const scale = Math.min(natural, cap);
  return { scale, zoom: scale / natural, W: Math.ceil(vw / scale), H: Math.min(1400, Math.ceil(vh / scale)) };
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
