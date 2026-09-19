/* Boot — the HunterOS BIOS-style boot screen, and the "a purple square
   production" badge that sits in the lower right during boot and on the
   logon / invite splashes. */
import { Component } from "./component.js";
import { h } from "./dom.js";
import { icon } from "./icons.js";

export const badgeHTML = () => `<div>a purple square<br>production</div>${icon("tee", 72)}`;

export const bootLines = (extra = []) => [
  { text: "HunterOS 99 · Hunter Association Network", pause: 260 },
  { text: "> connecting to hunter.net .........", ok: true, wait: 280, pause: 140 },
  { text: "> verifying license ................", ok: true, wait: 340, pause: 160 },
  ...extra,
];

export class Badge extends Component {
  render() { return h("div", { className: "badge os-badge", html: badgeHTML() }); }
}

export class Boot extends Component {
  /** props: env */
  render() { return h("div", { className: "boot", id: "boot" }); }

  get running() { return !!this._running; }

  /**
   * { badge: html, splash: { html, ms }, lines: [{ text, ok, wait, pause }],
   *   speed, tail } — click anywhere to skip. Resolves when done.
   * Instant under reduced motion.
   */
  run({ badge, splash, lines = [], speed = 12, tail = 600 } = {}) {
    const env = this.props.env;
    const el = this.el;
    if (env?.reduced) return Promise.resolve();
    return new Promise(res => {
      let done = false;
      const finish = () => { if (done) return; done = true; this._running = false; el.classList.remove("on"); el.onclick = null; res(); };
      this._running = true;
      el.classList.add("on"); el.replaceChildren(); el.onclick = finish;
      if (badge) el.append(h("div", { className: "badge", html: badge }));
      (async () => {
        const wait = ms => env.wait(ms);
        if (splash) {
          const sp = h("div", { className: "splash", html: splash.html });
          el.append(sp);
          await wait(splash.ms || 900);
          if (done) return;
          sp.remove();
        }
        for (const l of lines) {
          if (done) return;
          const d = h("div", { className: "cur" });
          el.append(d);
          for (const ch of l.text) { if (done) return; d.textContent += ch; await wait(speed); }
          if (l.ok) { await wait(l.wait || 300); if (done) return; d.textContent += " OK"; }
          d.classList.remove("cur");
          await wait(l.pause || 100);
        }
        el.append(h("div", { className: "cur" }));
        await wait(tail);
        finish();
      })();
    });
  }
}
