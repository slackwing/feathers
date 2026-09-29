/* SetPassword — the hxh skin for the shared set-password pages (_invite/
   and _reset/): the OS's AccountDialog (os/logon.js — the logon's own
   frame, logo and all) on the bare desktop, wired to the
   machinery in /admin/assets/setpw.js (global `SetPassword`), which owns
   the code lookup, the submit and the state switching; this app only
   supplies the look and the words (its options). Not on the desktop or
   in menus — the page autostarts it.

   THEME: this skin borrows the OS chrome wholesale, so a chrome change
   shows up here automatically — but re-screenshot both pages whenever the
   chrome changes, and keep _email/_layout.html in step (see the note at
   the top of os/os.css). */
import { App } from "../os/apps.js";
import { AccountDialog } from "../os/logon.js";
import { esc } from "../os/dom.js";

/** How every account page (_invite/, _reset/) starts the OS — ONE place, so the two pages cannot drift: boot, the
    Summons splash, then the dialog alone over the splash's embers; no taskbar, no wallpaper, no badge (Andrew,
    2026-09-28). A page passes only its words: HxH.accountPage({ heading, submit, done, invalid, nocode }). */
export const ACCOUNT_PAGE = { autostart: ["setpw"], taskbar: false, wallpaper: false, gate: false, splash: true, badge: false, backdrop: "embers", signOut: true, restore: false };

export class SetPasswordApp extends App {
  static id = "setpw";
  static name = "Set password";
  static icon = "x";
  static desktop = false;
  static menuable = false;

  /** options: heading (title bar and the line under the logo), submit, done ("{name}" = the display name), nocode, invalid, machinery (SetPassword) */
  window() {
    if (this.win) return this.win;
    const o = this.options;
    this.win = new AccountDialog({
      id: "win-pw", subtitle: o.heading,
      lead: `<h2 class="dialog-h">${esc(o.heading)}</h2>`,
      body: `
        <form class="logon-form" data-pw="form">
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
    win.$('[data-pw="enter"]').addEventListener("click", e => { e.preventDefault(); os.go(e.currentTarget.getAttribute("href"), { splash: true }); });   // no reboot, but the splash: its click lets the music play
    await os.wm.open(win.id, null, { scroll: false, jank: true });
    if (st.state === "ok") win.$('[data-pw="password"]').focus();
    return win;
  }
}
