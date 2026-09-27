/* Report a Bug (Andrew, 2026-09-27) — any member tells us what went wrong:
   the text and at most one picture, in BeetleChat's own compose box (the
   shared Composer, with its Paste, Image and Emoji tools and the same
   Insert Image dialog). Sending also records a snapshot of their screen
   (context: page, browser, viewport, zoom, theme, sky, open windows,
   bundle) so a report can be reproduced. Reports are saved by the server
   (hobby-server internal/hxh/bugs.go) as pending.

   Admins get a tray icon: a bug with a red count of pending reports,
   lit while any wait; it opens the Bug Reports list, where a report is
   resolved (or reopened). The count is re-read every minute and after
   every report sent from this page. Claude reads and resolves them with
   hxh-roster/roster.py (bugs, bug-resolve). */
import { App } from "../../os/apps.js";
import { Window } from "../../os/window.js";
import { ChatAPI } from "../chat/client.js";
import { Composer } from "../chat/composer.js";
import { PictureDialog } from "../chat/picture.js";
import { BugListWindow } from "./list.js";
import "./bugs.css";

export const BUGS_API = "/hxh/api/bugs";
export const POLL_MS = 60000;

/** What the reporter's screen looked like: enough to reproduce a bug, nothing private. */
export function bugContext(os) {
  const w = os.win || globalThis.window, doc = os.doc || globalThis.document;
  const script = [...(doc?.scripts || [])].map(s => s.src).find(s => /hxh\.js/.test(s)) || "";
  return {
    url: w?.location?.href || "",
    ua: w?.navigator?.userAgent || "",
    viewport: [w?.innerWidth || 0, w?.innerHeight || 0],
    dpr: w?.devicePixelRatio || 1,
    zoom: os.env?.zoom?.() ?? 1,
    bundle: (script.match(/[?&]v=(\d+)/) || [])[1] || "",
    theme: os.theme, sky: os.sky,
    windows: (os.wm?.appWindows?.() || []).filter(x => x.state.open).map(x => x.id + (x.state.minimized ? " (min)" : "")),
    at: new Date().toISOString(),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

export class BugReportApp extends App {
  static id = "bugs";
  static name = "Report a Bug";
  static icon = "bug";
  static order = 90;

  constructor(os, options = {}) {
    super(os, options);
    this.fetch = options.fetch || ((...a) => os.fetch(...a));
    this.api = new ChatAPI({ fetch: this.fetch });
    this.pending = 0;
  }

  get admin() { return !!this.os.isAdmin?.(); }

  /* ---------- reporting ---------- */
  window() {
    if (this.win) return this.win;
    const os = this.os;
    this.win = new Window({ id: "win-bugs", title: "Report a Bug", icon: "bug", width: 460, cls: "bugs", menus: w => os.appMenus(w) });
    os.wm.add(this.win);
    this.composer = this.win.adopt(new Composer({ clipboard: this.options.clipboard, rows: 5, label: "What went wrong?", placeholder: "What went wrong?" }), this.win.body);
    this.composer.on("send", p => this.submit(p));
    this.composer.on("image-file", ({ file }) => this.attach(file));
    this.composer.on("image-dialog", () => this.pictureDialog());
    this.composer.on("clip-fail", () => os.toast.show("Nothing to paste."));
    return this.win;
  }

  async launch() {
    const win = this.window();
    await this.os.wm.open(win.id);
    this.composer.focusInput();
    return win;
  }

  async attach(file) {
    try {
      const ref = await this.api.uploadImage(file);
      this.composer.attachImage({ ...ref, url: this.api.imageURL(ref.id) });
    } catch { this.os.toast.show("That picture didn't take."); }
  }

  async pictureDialog() {
    if (!this.pictureWin) {
      this.pictureWin = new PictureDialog({ id: "win-bug-picture", objectURL: this.options.objectURL, revoke: this.options.revokeURL });
      this.os.wm.add(this.pictureWin);
      this.pictureWin.on("insert", ({ file }) => this.attach(file));
    }
    this.pictureWin.setClipboard(await this.clipboardImage());
    this.os.wm.open(this.pictureWin.id);
  }

  async clipboardImage() {
    const cb = this.options.clipboard || this.os.win?.navigator?.clipboard;
    try {
      for (const item of await cb.read()) {
        const type = item.types.find(t => t.startsWith("image/"));
        if (type) return await item.getType(type);
      }
    } catch {}
    return null;
  }

  /** Send the report; on success the box empties, the window closes and a toast thanks them. */
  async submit({ body, image }) {
    const os = this.os;
    try {
      const r = await this.fetch(BUGS_API, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, image_id: image?.id || 0, context: bugContext(os) }) });
      if (!r.ok) { let why = ""; try { why = (await r.json()).error || ""; } catch {} throw new Error(why || "HTTP " + r.status); }
      os.toast.show("Thanks! Your report is in.");
      os.wm.close(this.win.id);
      if (this.admin) this.poll();
      return true;
    } catch (err) {
      this.composer.input.value = body;   // keep what they wrote
      if (image) this.composer.attachImage(image);
      os.toast.show(`The report didn't go through${err.message ? ": " + err.message : ""}.`);
      return false;
    }
  }

  /* ---------- the admins' tray alert ---------- */
  tray() {
    if (!this.admin) return null;
    this.startPolling();
    return {
      icon: "bug",
      title: () => this.pending ? `Bug reports: ${this.pending} pending` : "Bug reports",
      on: () => this.pending > 0,
      badge: () => this.pending,
      onClick: () => this.openList(),
    };
  }

  startPolling() {
    if (this.timer) return;
    this.poll();
    const st = this.options.setInterval || ((f, ms) => setInterval(f, ms));
    this.timer = st(() => this.poll(), POLL_MS);
    this.timer?.unref?.();
  }

  async poll() {
    try {
      const r = await this.fetch(BUGS_API + "/count", { credentials: "same-origin", cache: "no-store" });
      if (!r.ok) return this.pending;
      const { pending } = await r.json();
      if (pending !== this.pending) { this.pending = pending; this.os.bus.emit("tray:refresh", { id: this.id }); }
    } catch {}
    return this.pending;
  }

  async openList() {
    const os = this.os;
    if (!this.listWin) {
      this.listWin = new BugListWindow({ fetch: this.fetch, api: BUGS_API, imageURL: id => this.api.imageURL(id), people: os.people, menus: w => os.appMenus(w),
        onChange: () => this.poll(), toast: m => os.toast.show(m) });
      os.wm.add(this.listWin);
    }
    await os.wm.open(this.listWin.id);
    await this.listWin.load();
  }

  owns(id) { return id === "win-bugs" || id === "win-bug-list"; }
  async reopen(id) {
    if (id === "win-bugs") { await this.launch(); return true; }
    if (id === "win-bug-list" && this.admin) { await this.openList(); return true; }
    return false;
  }
}
