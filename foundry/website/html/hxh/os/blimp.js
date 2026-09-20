/* Blimp — Chairman Netero's airship, now and then, across the sky, towing
   a flyer that says HUNTER × HALLOWEEN (Andrew, 2026-09-19). A DOM sprite
   (the pixel grid at the desktop icons' 3×) animated by CSS from one edge
   to the other, behind every window and icon, above the wallpaper. Spawns
   at a random interval (4–9 min by default), never under reduced motion;
   `launch()` flies one now (demos, tests). */
import { Component } from "./component.js";
import { h } from "./dom.js";
import { gridSVG } from "./icons.js";

export const BLIMP = [
  "..........kkkkkkkkkkkkkkkkkkkkkkk...........",
  "......kkkkwwwwwwwwwwwwwwwwwwwwwwwkkkk.......",
  "kk..kkwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwkk.....",
  "kwkkwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwkk...",
  "kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk..",
  "kwwwwwwwwrrrrrrrrrrrrrrrrrrrrrrrrrrrrwwwwwk.",
  "kwwwwwwwwrrrrrrrrrrrrrrrrrrrrrrrrrrrrwwwwwwk",
  "kwdddddddddddddddddddddddddddddddddddddddwk.",
  "kwkkdddddddddddddddddddddddddddddddddddkk...",
  "kk..kkdddddddddddddddddddddddddddddddkk.....",
  "......kkkkdddddddddddddddddddddddkkkk.......",
  "..........kkkkkkkkkkkkkkkkkkkkkkk...........",
  "...................kkkkkkkkkkkk.............",
  "...................knbnbnbnbnbk.............",
  "...................kkkkkkkkkkkk.............",
];
export const FLYER_TEXT = "HUNTER × HALLOWEEN";

export class Blimp extends Component {
  /** props: reduced, random, minWait / maxWait (ms), duration (ms), setTimeout/clearTimeout (tests) */
  render() { return h("div", { className: "blimps", id: "blimps" }); }
  onMount() { this.schedule(); }
  onUnmount() { this.props.clearTimeout?.(this.timer) ?? clearTimeout(this.timer); }

  schedule() {
    if (this.props.reduced) return;
    const { minWait = 4 * 60000, maxWait = 9 * 60000, random = Math.random } = this.props;
    const st = this.props.setTimeout || ((f, ms) => setTimeout(f, ms));
    const wait = minWait + random() * (maxWait - minWait);
    this.timer = st(() => { this.launch(); this.schedule(); }, wait);
    this.timer?.unref?.();
    return wait;
  }

  /** Fly one across now. Returns the element. */
  launch({ dir = (this.props.random || Math.random)() < 0.5 ? -1 : 1, top = null } = {}) {
    const { random = Math.random, duration = 90000 } = this.props;
    const el = h("div", { className: "blimp " + (dir < 0 ? "west" : "east") });
    el.style.top = (top ?? 6 + random() * 18) + "%";
    el.style.animationDuration = duration + "ms";
    el.append(
      h("span", { className: "ship", html: gridSVG(BLIMP, 3) }),
      h("span", { className: "rope" }),
      h("span", { className: "flyer", text: FLYER_TEXT }),
    );
    el.addEventListener("animationend", () => el.remove());
    this.el.append(el);
    this.flights = (this.flights || 0) + 1;
    return el;
  }
}
