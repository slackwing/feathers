/* ScrollPane — wraps a scrolling element with an always-visible,
   bevelled Windows-style scrollbar (▲ track/thumb ▼). Overlay
   scrollbars hide until touched; a 90s list box never did. The native
   scrollbar is hidden and wheel/touch scrolling stays native; the bar
   mirrors it and drives it (arrows, track paging, thumb drag). */
import { Component } from "./component.js";
import { h } from "./dom.js";

export const STEP = 24;

export class ScrollPane extends Component {
  /** props: content (the element that scrolls; it is moved into the pane) */
  render() {
    const el = h("div", { className: "scrollpane" });
    this.content = this.props.content;
    this.content.classList.add("sp-content");
    el.append(this.content);
    this.up = h("button", { type: "button", className: "sp-btn", text: "▲", tabindex: "-1", onclick: () => this.by(-STEP) });
    this.down = h("button", { type: "button", className: "sp-btn", text: "▼", tabindex: "-1", onclick: () => this.by(STEP) });
    this.thumb = h("div", { className: "sp-thumb" });
    this.track = h("div", { className: "sp-track" }, this.thumb);
    el.append(h("div", { className: "sp-bar" }, this.up, this.track, this.down));
    this.content.addEventListener("scroll", () => this.update());
    this.track.addEventListener("mousedown", e => {
      if (e.target === this.thumb) return;
      const r = this.track.getBoundingClientRect();
      this.by((e.clientY < r.top + this.thumb.offsetTop + this.thumb.offsetHeight / 2 ? -1 : 1) * this.content.clientHeight);
    });
    this.thumb.addEventListener("pointerdown", e => {
      e.preventDefault();
      const startY = e.clientY, startTop = this.content.scrollTop;
      const ratio = () => (this.content.scrollHeight - this.content.clientHeight) / Math.max(1, this.track.clientHeight - this.thumb.offsetHeight);
      const move = ev => { this.content.scrollTop = startTop + (ev.clientY - startY) * ratio(); };
      const upH = () => { this.thumb.ownerDocument.removeEventListener("pointermove", move); this.thumb.ownerDocument.removeEventListener("pointerup", upH); };
      this.thumb.ownerDocument.addEventListener("pointermove", move);
      this.thumb.ownerDocument.addEventListener("pointerup", upH);
    });
    return el;
  }

  onMount() {
    if (typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(() => this.update());
      this.ro.observe(this.content);
    }
    this.update();
  }
  onUnmount() { this.ro?.disconnect(); }

  by(px) { this.content.scrollTop += px; this.update(); }

  /** Size and place the thumb from the content's scroll geometry. */
  update() {
    const c = this.content, trackH = this.track.clientHeight || 0;
    const range = c.scrollHeight - c.clientHeight;
    this.el.classList.toggle("sp-none", range <= 0 || !trackH);
    if (range <= 0 || !trackH) return;
    const size = Math.max(20, Math.round(trackH * c.clientHeight / c.scrollHeight));
    const top = Math.round((trackH - size) * (c.scrollTop / range));
    this.thumb.style.height = size + "px";
    this.thumb.style.top = top + "px";
  }

  get scrollable() { return !this.el.classList.contains("sp-none"); }
}
