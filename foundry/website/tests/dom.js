/* jsdom harness for the OS unit tests. `setupDom()` installs a fresh
   window as the globals the modules read (document, window, storages…)
   and returns knobs: floating (desktop vs phone), reduced motion, size.
   Node runs every test file in its own process, so a file may call it once
   at the top or per test. */
import { JSDOM } from "jsdom";

export function setupDom({ floating = true, reduced = false, width = 1366, height = 900, url = "http://localhost/hxh/", html = "" } = {}) {
  const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>${html}</body></html>`, { url, pretendToBeVisual: true });
  const win = dom.window;
  const media = { floating, reduced };
  win.matchMedia = q => ({
    matches: q.includes("min-width") ? media.floating : q.includes("reduced-motion") ? media.reduced : false,
    media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  });
  Object.defineProperty(win, "innerWidth", { value: width, configurable: true, writable: true });
  Object.defineProperty(win, "innerHeight", { value: height, configurable: true, writable: true });
  if (!floating) win.document.body.classList.add("stacked");
  win.scrollTo = () => {};
  win.HTMLElement.prototype.scrollIntoView = function () { this.dataset.scrolled = "1"; };
  win.HTMLElement.prototype.setPointerCapture = () => {};
  win.HTMLCanvasElement.prototype.getContext = () => null;   // no canvas in jsdom: sprites/wallpaper degrade
  for (const k of ["window", "document", "HTMLElement", "Element", "Node", "Event", "CustomEvent", "KeyboardEvent", "MouseEvent", "getComputedStyle", "localStorage", "sessionStorage", "navigator"]) {
    try { globalThis[k] = win[k]; } catch {}
  }
  const cleanup = () => { dom.window.close(); };
  return { dom, win, doc: win.document, media, cleanup,
    /** fire a DOM event on el */
    fire(el, type, init = {}) { el.dispatchEvent(new win.Event(type, { bubbles: true, cancelable: true, ...init })); },
    click(el) { el.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })); },
    key(el, key) { el.dispatchEvent(new win.KeyboardEvent("keydown", { bubbles: true, cancelable: true, key })); },
  };
}

/** Minimal fake fetch: routes {"GET /admin/api/me": () => [status, body]} */
export function fakeFetch(routes, log = []) {
  return async (url, init = {}) => {
    const method = (init.method || "GET").toUpperCase();
    const path = String(url).replace(/^https?:\/\/[^/]+/, "");
    log.push({ method, path, body: init.body ? JSON.parse(init.body) : null });
    const r = routes[`${method} ${path}`];
    if (!r) return { ok: false, status: 404, json: async () => ({}) };
    const [status, body] = typeof r === "function" ? r(init) : r;
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
}

export const tick = (ms = 0) => new Promise(r => setTimeout(r, ms));
