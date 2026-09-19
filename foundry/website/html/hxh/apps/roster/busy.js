/* busy(win, promise) — freeze a window while something is in flight:
   an overlay with an hourglass covers the whole window (title bar
   included, so it cannot be closed or clicked) until the promise
   settles. Nested calls stack; the overlay lifts when the last one
   ends. Use it on every call to the database, however short. */
import { h } from "../../os/dom.js";
import { icon } from "../../os/icons.js";

export function busy(win, promise, label = "Please wait…") {
  const el = win.el;
  if (!el) return promise;
  let ov = el.querySelector(":scope > .busy");
  if (!ov) {
    ov = h("div", { className: "busy" }, h("div", { className: "bbox" }, h("span", { className: "hg", html: icon("hourglass", 16) }), h("span", { className: "bl" })));
    el.append(ov);
  }
  ov.querySelector(".bl").textContent = label;
  ov.hidden = false;
  el.classList.add("frozen");
  win.busyCount = (win.busyCount || 0) + 1;
  const done = () => { if (--win.busyCount <= 0) { win.busyCount = 0; ov.hidden = true; el.classList.remove("frozen"); } };
  return Promise.resolve(promise).then(v => { done(); return v; }, err => { done(); throw err; });
}
