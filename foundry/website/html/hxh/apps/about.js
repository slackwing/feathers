/* About — the version popup. A "system" app: listed under Help / after
   the system items in the Start menu. */
import { App } from "../os/apps.js";
import { Window } from "../os/window.js";

export const VERSION = "v2.0";

export class AboutApp extends App {
  static id = "about";
  static name = "About";
  static longName = "About Hunter Website";
  static icon = "question";
  static group = "system";
  static order = 90;

  window() {
    if (this.win) return this.win;
    this.win = new Window({
      id: "win-about", title: "About Hunter Website", icon: "question", width: 475, popup: true,
      content: `
        <p><b>HUNTER × HALLOWEEN</b> ${VERSION}</p>
        <p>An unofficial fan party. No affiliation with the Hunter Association (or Shueisha).</p>
        <div class="actions"><button class="btn" type="button" data-act="ok">OK</button></div>`,
    });
    this.os.wm.add(this.win);
    this.win.$('[data-act="ok"]').addEventListener("click", () => this.win.close());
    return this.win;
  }

  launch() { return this.os.wm.open(this.window().id); }
}
