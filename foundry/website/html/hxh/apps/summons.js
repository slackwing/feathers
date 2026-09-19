/* Summons — the official notice window: logotype, kana, the typewriter
   notice in a visual-novel box, and the CTA into the Binder. Its menus are
   derived from the app registry: View lists the other apps, Help the
   system ones. Autostarted on the desktop: bare desktop first, then the
   window paints in jankily and the notice types. */
import { App } from "../os/apps.js";
import { Window } from "../os/window.js";
import { type } from "../os/typewriter.js";
import "./summons.css";

export const NOTICE = [
  "By order of Chairman Netero, you are hereby summoned to the ",
  { t: "289th Hunter Exam — Halloween Phase", tag: "b" },
  ".\n\nSite: ", { t: "618 Bushwick Ave", tag: "b" },
  "\nCommences: ", { t: "Oct 31, 2026", tag: "b" }, "\n\n",
  "Applicants must arrive in the guise of a licensed Hunter, a Spider, a Chimera Ant, or any registered persona.",
];

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

  menus(win) {
    const os = this.os;
    return os.appMenus(win, {
      file: () => [{ label: "Log out", onclick: () => os.logout() }],
      view: () => os.appItems("apps", { except: this.id, long: true, icons: false }),
      settings: () => os.systemItems({ icons: false }),
      help: () => os.appItems("system", { long: true, icons: false }),
    });
  }

  window() {
    if (this.win) return this.win;
    const os = this.os;
    this.win = new Window({
      id: "win-summons", title: "Hunter × Halloween", icon: "x", width: 750, cls: "summons",
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

  position() { return this.os.env.floating() ? { x: 145, y: 24 } : null; }

  /** Fill the notice instantly so the window is measured at its final height. */
  prepNotice() {
    type(this.text, NOTICE, { instant: true });
    this.vn.style.minHeight = this.vn.offsetHeight + "px";
  }

  typeNotice() {
    this.vn.classList.remove("done");
    this.notice = type(this.text, NOTICE, { speed: 16, reduced: this.os.env.reduced, onDone: () => this.vn.classList.add("done") });
    return this.notice;
  }

  async launch({ autostart = false } = {}) {
    const os = this.os, win = this.window();
    if (!autostart) return os.wm.open(win.id, win.state.placed ? null : this.position());
    try { await os.doc.fonts?.ready; } catch {}
    this.prepNotice();
    if (!os.env.floating()) os.win.scrollTo?.(0, 0);
    await os.env.wait(420);
    await os.wm.open(win.id, this.position(), { scroll: false, jank: true });
    this.typeNotice();
    return win;
  }
}
