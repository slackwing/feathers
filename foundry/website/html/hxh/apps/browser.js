/* HunterNet (Andrew, 2026-09-29) — a web browser inside the site, so the
   site can be opened in the site. Admins only while it is polished.

   A page shows in an <iframe>. Many sites refuse to be framed
   (X-Frame-Options / CSP frame-ancestors) — Fandom, Google, DuckDuckGo,
   YouTube… — and a page cannot tell from outside that a frame was
   refused, so the well-known refusers get HunterNet's own "can't be shown
   here" page with an Open in new window button instead of a blank frame.
   Home is Wikipedia's Hunter × Hunter article (Hunterpedia, the Fandom
   wiki Andrew asked for, is one of the refusers). Words that are not an
   address search Wikipedia.

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

export const HOME = "https://en.wikipedia.org/wiki/Hunter_%C3%97_Hunter";
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

  visible(user) { return !!user && (user.roles || []).some(r => r.website === "hxh" && r.role === "admin"); }   // admins, while it is polished

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

  /** A page finished loading. One of this site's pages can be read: a link followed inside it becomes a history entry. */
  loaded() {
    this.status("Done");
    let href = null;
    try { href = this.frame?.contentWindow?.location?.href; } catch { return; }   // another site's page: not ours to read
    if (!href || href === "about:blank" || href === this.current) return;
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push(href);
    this.index = this.entries.length - 1;
    this.addr.value = href;
    this.win.$('[data-act="back"]').disabled = false;
    this.win.$('[data-act="forward"]').disabled = true;
  }

  status(text) { if (this.statusEl) this.statusEl.textContent = text; }
}
