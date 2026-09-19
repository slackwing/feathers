/* SetPassword — the hxh skin for the shared set-password pages (_invite/
   and _reset/): one static dialog on the bare desktop, wired to the
   machinery in /admin/assets/setpw.js (global `SetPassword`), which owns
   the code lookup, the submit and the state switching; this app only
   supplies the look and the words (its options). Not on the desktop or
   in menus — the page autostarts it.

   THEME: this skin borrows the OS chrome wholesale, so a chrome change
   shows up here automatically — but re-screenshot both pages whenever the
   chrome changes, and keep _email/_layout.html in step (see the note at
   the top of os/os.css). */
import { App } from "../os/apps.js";
import { Window } from "../os/window.js";
import { esc } from "../os/dom.js";

export class SetPasswordApp extends App {
  static id = "setpw";
  static name = "Set password";
  static icon = "x";
  static desktop = false;
  static menuable = false;

  /** options: title, heading, submit, done ("{name}" = the display name), nocode, invalid, machinery (SetPassword) */
  window() {
    if (this.win) return this.win;
    const o = this.options;
    this.win = new Window({
      id: "win-pw", title: o.title, icon: "x", chrome: "static", closable: false, task: false, width: 525,
      content: `
        <h1 class="dialog-h">${esc(o.heading)}</h1>
        <form data-pw="form">
          <div class="msg err" data-pw="nocode" hidden>${esc(o.nocode)}</div>
          <label class="lbl" for="u">Applicant</label>
          <input class="field" id="u" data-pw="username" autocomplete="username" readonly>
          <label class="lbl" for="p">Password</label>
          <input class="field" id="p" data-pw="password" type="password" autocomplete="new-password" minlength="8" required>
          <div class="actions"><button class="btn primary wide" type="submit" data-pw="submit">${esc(o.submit)}</button></div>
          <div class="msg err" data-pw="msg"></div>
        </form>
        <div data-pw="done" hidden>
          <p class="ok">${esc(o.done).replace("{name}", '<b data-pw="name"></b>')}</p>
          <div class="actions"><a class="btn primary" href="/hxh/" data-pw="enter">Enter the exam site</a></div>
        </div>
        <p class="err" data-pw="invalid" hidden>${esc(o.invalid)}</p>`,
    });
    this.os.wm.add(this.win);
    return this.win;
  }

  async launch() {
    const os = this.os, win = this.window();
    // /admin/assets/setpw.js declares `const SetPassword` — a global lexical
    // binding, not a window property — so it is reached as a free identifier.
    const machinery = this.options.machinery || (typeof SetPassword !== "undefined" ? SetPassword : null);
    os.desktop.center(true);
    const st = machinery ? await machinery.mount(win.el) : { state: "nocode" };
    this.state = st;
    // Into the site without rebooting — this page already booted.
    win.$('[data-pw="enter"]').addEventListener("click", e => { e.preventDefault(); os.go(e.currentTarget.getAttribute("href")); });
    await os.wm.open(win.id, null, { scroll: false, jank: true });
    if (st.state === "ok") win.$('[data-pw="password"]').focus();
    return win;
  }
}
