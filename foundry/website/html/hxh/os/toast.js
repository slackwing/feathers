/* Toast — a mini window that slides up from the taskbar corner. */
import { Component } from "./component.js";
import { h } from "./dom.js";
import { TitleBar } from "./window.js";

export class Toast extends Component {
  render() {
    const el = h("div", { className: "win toast", id: "toast" });
    this.adopt(new TitleBar({ title: this.props.title || "Hunter Website", icon: "x", buttons: [] }), el);
    this.body = h("div", { className: "body" });
    el.append(this.body);
    return el;
  }
  show(msg, ms = 2800) {
    this.body.textContent = msg;
    this.el.classList.add("show");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.el.classList.remove("show"), ms);
  }
  get visible() { return this.el.classList.contains("show"); }
  onUnmount() { clearTimeout(this.timer); }
}
