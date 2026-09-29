/* Summons — the official notice window: logotype, kana, the typewriter
   notice in a visual-novel box, and the CTA into the Binder. Its menus are
   derived from the app registry: View lists the other apps, Help the
   system ones. Autostarted on the desktop: bare desktop first, then the
   window paints in jankily and the notice types. */
import { App } from "../os/apps.js";
import { anonymous } from "../os/roles.js";
import { Window } from "../os/window.js";
import { type } from "../os/typewriter.js";
import "./summons.css";

/** Where the Summons opens on the desktop, and how wide — the Music player lines itself up against it (apps/music.js). */
export const SUMMONS_AT = { x: 145, y: 24 }, SUMMONS_W = 750;

/** The private details (hxh_private, members only): the party's address is NEVER in this public bundle (security review, 2026-09-28). */
export const PRIVATE_URL = "/hxh/api/db/private";
/** What stands in for a detail the server did not give (offline, or not a member). */
export const UNKNOWN = "—";

export const NOTICE = [
  "By order of Chairman Netero, you are hereby summoned to the ",
  { t: "289th Hunter Exam — Halloween Phase", tag: "b" },
  ".\n\nSite: ", { key: "site", tag: "b" },   // from the server: the address

  "\nCommences: ", { t: "Oct 31, 2026", tag: "b" },
  "\nTime: ", { t: "TBD", tag: "b" }, "\n\n",   // Andrew, 2026-09-27
  "Applicants must arrive in the guise of a licensed Hunter, a Spider, a Chimera Ant, or any registered persona.",
];

/** The notice with the server's private details filled in. */
export function noticeFor(details = {}) {
  return NOTICE.map(r => (r && typeof r === "object" && r.key ? { ...r, t: details[r.key] || UNKNOWN } : r));
}

const CONTENT = `
  <div class="assoc">Hunter Association · Official Summons</div>
  <h1 class="logo">HUNTER<span class="x">×</span><br><span class="hallow">HALLOWEEN</span></h1>
  <div class="kana">ハンター×ハロウィン</div>
  <div class="vn" id="vn" title="Skip"><span class="tag">Hunter Association</span><p id="vn-text"></p><span class="more">▼</span></div>
  <div class="actions"><button class="btn primary" type="button" data-act="binder">▶ Choose your persona</button></div>`;

export class SummonsApp extends App {
  static id = "summons";
  static name = "Summons";
  static icon = "envelope";
  static order = 10;

  visible(user) { return !anonymous(user); }

  /** The private details, fetched once (a slow or failed answer leaves "—" rather than holding the window). */
  async loadDetails() {
    if (this.details) return this.details;
    const fetch = this.options.fetch || ((...a) => this.os.fetch(...a));
    const ask = (async () => {
      try { const r = await fetch(PRIVATE_URL, { credentials: "same-origin" }); return r.ok ? await r.json() : null; } catch { return null; }
    })();
    let timer;
    const got = await Promise.race([ask, new Promise(res => { timer = setTimeout(res, 3000, null); })]);
    clearTimeout(timer);
    if (got && typeof got === "object") this.details = got;
    return this.details || {};
  }   // the invitation is for invitees: not shown to an anonymous viewer (Andrew, 2026-09-28)

  /** File › Exit, and nothing else (Andrew, 2026-09-27): the notice is a poster, not a workbench. */
  menus(win) {
    return this.os.appMenus(win);
  }

  window() {
    if (this.win) return this.win;
    const os = this.os;
    this.win = new Window({
      id: "win-summons", title: "Hunter × Halloween", icon: "x", width: SUMMONS_W, cls: "summons",
      menus: w => this.menus(w), content: CONTENT,
    });
    os.wm.add(this.win);
    this.vn = this.win.$("#vn");
    this.text = this.win.$("#vn-text");
    this.vn.addEventListener("click", () => this.notice?.skip());
    this.win.body.addEventListener("click", e => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act && os.registry.has(act)) os.launch(act);
    });
    return this.win;
  }

  position() { return this.os.env.floating() ? { ...SUMMONS_AT } : null; }

  /** Fill the notice instantly so the window is measured at its final height. */
  prepNotice() {
    type(this.text, noticeFor(this.details), { instant: true });
    this.vn.style.minHeight = this.vn.offsetHeight + "px";
  }

  typeNotice() {
    this.vn.classList.remove("done");
    this.notice = type(this.text, noticeFor(this.details), { speed: 16, reduced: this.os.env.reduced, onDone: () => this.vn.classList.add("done") });
    return this.notice;
  }

  /**
   * `autostart` is the boot arrival: wait for the fonts, measure the
   * notice at its full height, then open with the jank and type it out.
   * Otherwise (the desktop icon, the Start menu, or `restore: true` from
   * the saved desktop) the window opens at once — but it must still be
   * FILLED: a restored Summons used to come back with an empty notice and
   * stay that way, since only the autostart path ever typed (Andrew,
   * 2026-09-27: "the summons broke, i see no text… the text doesn't start
   * typing"; his saved desktop restored the window on every load, so a
   * hard reload never helped).
   */
  async launch({ autostart = false, restore = false } = {}) {
    const os = this.os, win = this.window();
    await this.loadDetails();
    if (!autostart) {
      const opened = await os.wm.open(win.id, win.state.placed ? null : this.position());
      if (!this.notice || this.notice.done) { this.prepNotice(); this.typeNotice(); }   // every opening types it out again (Andrew, 2026-09-28); one still typing carries on
      void restore;
      return opened;
    }
    try { await os.doc.fonts?.ready; } catch {}
    this.prepNotice();
    if (!os.env.floating()) os.win.scrollTo?.(0, 0);
    await os.env.wait(420);
    await os.wm.open(win.id, this.position(), { scroll: false, jank: true });
    this.typeNotice();
    return win;
  }
}
