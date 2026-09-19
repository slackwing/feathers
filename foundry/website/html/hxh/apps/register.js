/* Registration — "OPENS SOON": the stamp and a progress bar permanently
   stuck at 35%. Lands to the right of the summons on wide screens, below
   it otherwise. */
import { App } from "../os/apps.js";
import { Window } from "../os/window.js";
import "./register.css";

export const BARS = 20, BARS_ON = 7;

export class RegisterApp extends App {
  static id = "register";
  static name = "Register";
  static longName = "Registration";
  static icon = "hourglass";
  static order = 30;

  window() {
    if (this.win) return this.win;
    this.win = new Window({
      id: "win-register", title: "Registration", icon: "hourglass", width: 450, cls: "register",
      content: `
        <div class="stamp">OPENS SOON</div>
        <p>Applicant intake is being prepared by the exam committee.
        Check back shortly to lock in your character — claims will be
        first come, first served.</p>
        <div class="prog" id="prog">${Array.from({ length: BARS }, (_, i) => `<i class="${i < BARS_ON ? "on" : ""}"></i>`).join("")}</div>`,
    });
    this.os.wm.add(this.win);
    return this.win;
  }

  /** Beside the summons when there is room (145 + 750 + 30 + 450 + 30), else under it. */
  position() {
    const os = this.os;
    if (!os.env.floating()) return null;
    const vw = os.desktop.el.clientWidth || os.env.width;
    const s = os.wm.get("win-summons")?.el;
    if (vw >= 145 + 750 + 30 + 450 + 30 || !s) return { x: 925, y: 24 };
    return { x: 200, y: s.offsetTop + s.offsetHeight + 12 };
  }

  launch() {
    const win = this.window();
    return this.os.wm.open(win.id, win.state.placed ? null : this.position());
  }
}
