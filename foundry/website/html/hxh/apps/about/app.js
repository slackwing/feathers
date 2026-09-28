/* About (Andrew, 2026-09-27) — how this site was made: a note from Andrew,
   then every prompt he gave to build it, verbatim (typos, lowercase and
   all), numbered, in a long scroll. Small plain Arial rather than the pixel
   type, so more fits on the screen. The prompts live in about/prompts.json
   (a list of strings, in order) and are fetched when the window first
   opens, so the page itself stays light. */
import { App } from "../../os/apps.js";
import { Window } from "../../os/window.js";
import { h } from "../../os/dom.js";
import "./about.css";

export const PROMPTS_URL = "/hxh/about/prompts.json";
export const INTRO = "Yes, this was AI. But it was also a lot of expertise, without which, it would not have been possible to converge to this result in ~18 hours. Here's the full set of prompts. Also, all images were cropped and placed manually by Abi.";

export class AboutApp extends App {
  static id = "about";
  static name = "About";
  static icon = "question";
  static order = 95;   // last, after Report a Bug

  constructor(os, options = {}) {
    super(os, options);
    this.fetch = options.fetch || ((...a) => os.fetch(...a));
  }

  window() {
    if (this.win) return this.win;
    this.win = new Window({ id: "win-about", title: "About", icon: "question", width: 680, cls: "about", menus: w => this.os.appMenus(w),
      content: `<div class="ascroll sunken"><p class="aintro"></p><ol class="aprompts"></ol></div>` });
    this.os.wm.add(this.win);
    this.win.$(".aintro").textContent = INTRO;
    return this.win;
  }

  async launch() {
    const win = this.window();
    await this.os.wm.open(win.id);
    if (!this.loaded) await this.load();
    return win;
  }

  /** Fetch the prompts once and print them, verbatim, one list item each. */
  async load() {
    const list = this.win.$(".aprompts");
    try {
      const r = await this.fetch(PROMPTS_URL, { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const prompts = await r.json();
      list.replaceChildren(...prompts.map(p => h("li", { text: p })));   // text, never HTML: verbatim
      this.loaded = true;
      return prompts.length;
    } catch {
      list.replaceChildren(h("li", { className: "aerr", text: "The prompts could not be loaded." }));
      return 0;
    }
  }

  owns(id) { return id === "win-about"; }
  async reopen(id) { if (id !== "win-about") return false; await this.launch(); return true; }
}
