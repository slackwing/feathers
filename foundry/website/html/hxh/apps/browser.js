/* HunterNet (Andrew, 2026-09-29) — a web browser inside the site, so the
   site can be opened in the site. Everyone signed in, anonymous too.

   A page shows in an <iframe>. Many sites refuse to be framed
   (X-Frame-Options / CSP frame-ancestors) — Fandom, Google, DuckDuckGo,
   YouTube… — and a page cannot tell from outside that a frame was
   refused, so the well-known refusers get HunterNet's own "can't be shown
   here" page with an Open in new window button instead of a blank frame.
   Fandom wikis refuse frames too, but their API is open to browsers
   (CORS), so a fandom.com/wiki/ page is shown in READER VIEW: HunterNet
   fetches the parsed article and draws it itself in a frame sandboxed
   WITHOUT scripts (nothing of Fandom's runs), cleaned of scripts, embeds
   and forms; wiki links stay in HunterNet (and its history), others open
   a new window. That is how Home is Hunterpedia (Andrew, 2026-09-29).
   Words that are not an address search Wikipedia.

   History is HunterNet's own (a framed site's history is not ours to
   read): the addresses it opened, plus — for pages of this site, which it
   CAN read — the links followed inside them.

   Only http(s) addresses ever reach the frame: a javascript: URL in an
   iframe runs as THIS site. The frame is sandboxed without top
   navigation, so no framed page can navigate the OS away. */
import { App } from "../os/apps.js";
import { Window } from "../os/window.js";
import { h } from "../os/dom.js";
import "./browser.css";

export const HOME = "https://hunterxhunter.fandom.com/wiki/Hunterpedia";
export const SEARCH = "https://en.wikipedia.org/w/index.php?search=";
/** Sites known to refuse being framed (a host or any subdomain of it). */
export const REFUSERS = ["fandom.com", "google.com", "youtube.com", "duckduckgo.com", "bing.com", "github.com", "x.com", "twitter.com", "facebook.com", "instagram.com", "reddit.com", "amazon.com", "linkedin.com"];

/** What the address bar's text means: an http(s) URL, or null (refused: javascript:, data:, file:, …). */
export function normalize(input, base = globalThis.location?.href) {
  const t = String(input ?? "").trim();
  if (!t) return null;
  const web = u => (u.protocol === "http:" || u.protocol === "https:" ? u.href : null);
  if (/^https?:\/\//i.test(t)) { try { return web(new URL(t)); } catch { return null; } }
  if (t.startsWith("/") && base) { try { return web(new URL(t, base)); } catch { return null; } }   // this site: "/hxh/"
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(t)) return null;                                           // another scheme: never
  if (!/\s/.test(t) && /^[\w-]+(\.[\w-]+)+(:\d+)?([/?#].*)?$/.test(t)) { try { return web(new URL("https://" + t)); } catch { return null; } }
  return SEARCH + encodeURIComponent(t);
}

/** A known refuser (not YouTube's own embed player, which is made to be framed). */
export function refuses(url) {
  try {
    const u = new URL(url);
    if (/(^|\.)youtube(-nocookie)?\.com$/.test(u.hostname) && u.pathname.startsWith("/embed/")) return false;
    return REFUSERS.some(d => u.hostname === d || u.hostname.endsWith("." + d));
  } catch { return false; }
}

const hostOf = url => { try { return new URL(url).hostname; } catch { return url; } };

/** A Fandom wiki article HunterNet can show in reader view: { host, page }, else null. */
export function readerPage(url) {
  try {
    const u = new URL(url);
    if (!/(^|\.)fandom\.com$/.test(u.hostname)) return null;
    const m = u.pathname.match(/^\/wiki\/(.+)$/);
    return m ? { host: u.hostname, page: decodeURIComponent(m[1]).replace(/_/g, " ") } : null;
  } catch { return null; }
}

/** The MediaWiki API call for a reader page (anonymous CORS: origin=*). */
export function readerAPI({ host, page }) {
  const q = new URLSearchParams({ action: "parse", page, format: "json", origin: "*", prop: "text|displaytitle", formatversion: "2", redirects: "1" });
  return `https://${host}/api.php?${q}`;
}

/** Reader view's own look: plain, readable, images kept in bounds. */
const READER_CSS = `
  body { margin: 0; padding: 18px 22px 40px; font: 15px/1.55 Georgia, "Times New Roman", serif; color: #1b1b1b; background: #fff; }
  h1 { font: 700 26px/1.2 Georgia, serif; margin: 0 0 14px; border-bottom: 1px solid #ccc; padding-bottom: 6px; }
  a { color: #1f5fbf; } img { max-width: 100%; height: auto; } table { border-collapse: collapse; max-width: 100%; }
  td, th { vertical-align: top; } .portable-infobox, aside { float: right; width: 270px; margin: 0 0 12px 16px; padding: 8px; border: 1px solid #ddd; background: #fafafa; font-size: 13px; }
  .mw-editsection, .navbox, .toc, .wds-tabs__wrapper { display: none; }
  .fandom-slider__controls { display: none; } svg.wds-icon, .wds-icon { width: 1em; height: 1em; }   /* Fandom's sprite icons have no sprite here: empty 300×150 boxes */
  .ad-slot, .gpt-ad, .top-ads-container, [id^="gpt-"], [class*="advertisement"], [data-ad] { display: none !important; }`;

/** The parsed article as a standalone, script-free document for the reader frame (sandboxed without scripts as well). */
export function readerDoc(parse, host, doc = globalThis.document) {
  const box = doc.createElement("div");
  box.innerHTML = String(parse?.text || "");   // parsed in an inert document fragment: nothing here runs
  for (const el of box.querySelectorAll("script, style, link, meta, iframe, object, embed, form, noscript, base")) el.remove();
  for (const img of box.querySelectorAll("img")) {   // Fandom lazy-loads: the real picture waits in data-src
    img.setAttribute("referrerpolicy", "no-referrer");   // Fandom's image server answers a foreign referrer with a 404 placeholder (hotlink protection)
    const real = img.getAttribute("data-src");
    if (real) { img.setAttribute("src", real); img.removeAttribute("srcset"); }
    // Fandom serves thumbnails scaled down to a width: ask for the width the page shows, not a 300 px one stretched
    const w = parseInt(img.getAttribute("width"), 10), src = img.getAttribute("src") || "";
    if (w > 0 && /\/scale-to-width-down\/\d+/.test(src)) img.setAttribute("src", src.replace(/\/scale-to-width-down\/\d+/, `/scale-to-width-down/${Math.min(1200, w * 2)}`));
  }
  for (const el of box.querySelectorAll("*")) for (const a of [...el.attributes]) if (/^on/i.test(a.name)) el.removeAttribute(a.name);
  const title = doc.createElement("h1");
  title.textContent = (parse?.displaytitle || parse?.title || "").replace(/<[^>]*>/g, "");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><base href="https://${host}/wiki/"><style>${READER_CSS}</style></head><body>${title.outerHTML}${box.innerHTML}</body></html>`;
}

const CONTENT = `
  <div class="navbar">
    <button class="btn nav" type="button" data-act="back" title="Back">←</button>
    <button class="btn nav" type="button" data-act="forward" title="Forward">→</button>
    <button class="btn nav" type="button" data-act="reload" title="Refresh">↻</button>
    <button class="btn nav" type="button" data-act="home" title="Home">⌂</button>
    <form class="addr"><input class="field" name="addr" spellcheck="false" autocomplete="off" aria-label="Address"><button class="btn" type="submit">Go</button></form>
  </div>
  <div class="view sunken"><div class="nope" hidden><p class="why"></p><button class="btn primary" type="button" data-act="open">Open in new window</button></div></div>
  <div class="bstatus"></div>`;

export class BrowserApp extends App {
  static id = "browser";
  static name = "HunterNet";
  static icon = "globe";
  static order = 24;   // after Music

  constructor(os, options = {}) {
    super(os, options);
    this.entries = [];   // the addresses this window has shown
    this.index = -1;
  }

  visible(user) { return !!user; }   // everyone signed in, the anonymous viewer included (Andrew, 2026-09-29)

  window() {
    if (this.win) return this.win;
    this.win = new Window({ id: "win-browser", title: "HunterNet", icon: "globe", width: 900, cls: "browser", menus: w => this.os.appMenus(w), content: CONTENT });
    this.os.wm.add(this.win);
    const w = this.win;
    this.addr = w.$(".addr input");
    this.view = w.$(".view");
    this.nope = w.$(".nope");
    this.statusEl = w.$(".bstatus");
    w.$(".addr").addEventListener("submit", e => { e.preventDefault(); this.go(this.addr.value); });
    w.$(".navbar").addEventListener("click", e => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "back") this.back();
      else if (act === "forward") this.forward();
      else if (act === "reload") this.reload();
      else if (act === "home") this.go(HOME);
    });
    this.nope.querySelector('[data-act="open"]').addEventListener("click", () => this.os.win?.open?.(this.current, "_blank", "noopener"));
    return w;
  }

  get current() { return this.entries[this.index] || null; }

  async launch() {
    const w = this.window();
    await this.os.wm.open(w.id);
    if (!this.current) this.go(HOME);
    return w;
  }

  /** Open what was typed (or a link): a new history entry, the forward ones dropped. */
  go(input) {
    const url = normalize(input, this.os.win?.location?.href);
    if (!url) { this.status("Can't open that address."); this.addr.value = this.current || ""; return false; }
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push(url);
    this.index = this.entries.length - 1;
    this.show();
    return true;
  }

  back() { if (this.index > 0) { this.index--; this.show(); } }
  forward() { if (this.index < this.entries.length - 1) { this.index++; this.show(); } }
  reload() { if (this.current) this.show(); }

  /** Show the current entry: a fresh frame (a refresh reloads even a page whose address has not changed), or the refusal page. */
  show() {
    const url = this.current;
    this.addr.value = url;
    this.win.$('[data-act="back"]').disabled = this.index <= 0;
    this.win.$('[data-act="forward"]').disabled = this.index >= this.entries.length - 1;
    this.frame?.remove();
    this.frame = null;
    this.first = true;   // this entry's first load: a redirect REPLACES the entry, it is not a new page (the forward bug)
    const reader = readerPage(url);
    if (reader) return this.showReader(url, reader);
    if (refuses(url)) {
      this.nope.hidden = false;
      this.nope.querySelector(".why").textContent = `${hostOf(url)} can't be shown inside HunterNet.`;
      this.status("Done");
      return;
    }
    this.nope.hidden = true;
    this.frame = h("iframe", {
      src: url, title: "HunterNet", referrerpolicy: "strict-origin-when-cross-origin", allow: "autoplay; fullscreen",
      sandbox: "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals",   // no allow-top-navigation: a page never takes the OS away
      onload: () => this.loaded(),
    });
    this.view.append(this.frame);
    this.status(`Opening ${hostOf(url)}…`);
  }

  /** Reader view: fetch the article from the wiki's API and draw it in a script-less frame; its links stay in HunterNet. */
  async showReader(url, reader) {
    this.nope.hidden = true;
    const frame = this.frame = h("iframe", { title: "HunterNet", sandbox: "allow-same-origin allow-popups allow-popups-to-escape-sandbox" });   // no allow-scripts: nothing of the page runs
    frame.srcdoc = `<!DOCTYPE html><body style="font:14px Georgia,serif;padding:18px;color:#666">Opening ${reader.page.replace(/[<&]/g, "")}…</body>`;
    this.view.append(frame);
    this.status(`Opening ${reader.host}…`);
    let parse = null;
    try {
      const r = await (this.options.fetch || ((...a) => this.os.win.fetch(...a)))(readerAPI(reader), { credentials: "omit" });
      parse = r.ok ? (await r.json()).parse : null;
    } catch {}
    if (this.frame !== frame) return;   // navigated away meanwhile
    if (!parse) { frame.remove(); this.frame = null; this.nope.hidden = false; this.nope.querySelector(".why").textContent = `${reader.host} didn't answer.`; this.status("Done"); return; }
    frame.addEventListener("load", () => this.readerLoaded(frame, reader.host), { once: true });
    frame.srcdoc = readerDoc(parse, reader.host, this.os.doc);
  }

  /** The article is up: route its clicks — a wiki link opens in HunterNet (a history entry), anything else in a new window. */
  readerLoaded(frame, host) {
    this.status("Done");
    let doc = null;
    try { doc = frame.contentDocument; } catch {}
    doc?.addEventListener("click", e => {
      const a = e.target.closest?.("a[href]");
      if (!a) return;
      e.preventDefault();
      const href = a.href;   // resolved against the article's <base>
      if (href.startsWith("about:srcdoc#") || /^#/.test(a.getAttribute("href"))) { doc.getElementById(decodeURIComponent(a.hash.slice(1)))?.scrollIntoView(); return; }
      if (readerPage(href)) this.go(href);
      else if (normalize(href)) this.os.win?.open?.(href, "_blank", "noopener");
    });
    void host;
  }

  /** A page finished loading. One of this site's pages can be read: a link followed inside it becomes a history entry —
      but the entry's FIRST load only corrects its address (a redirect such as /hxh → /hxh/), keeping the forward pages. */
  loaded() {
    this.status("Done");
    const first = this.first;
    this.first = false;
    let href = null;
    try { href = this.frame?.contentWindow?.location?.href; } catch { return; }   // another site's page: not ours to read
    if (!href || href === "about:blank" || href === this.current) return;
    if (first) { this.entries[this.index] = href; this.addr.value = href; return; }
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push(href);
    this.index = this.entries.length - 1;
    this.addr.value = href;
    this.win.$('[data-act="back"]').disabled = false;
    this.win.$('[data-act="forward"]').disabled = true;
  }

  status(text) { if (this.statusEl) this.statusEl.textContent = text; }
}
