/* Desktop — the surface windows live on, its column of app icons (derived
   from the registry), and the modal backdrop. */
import { Component } from "./component.js";
import { h } from "./dom.js";
import { icon } from "./icons.js";

export class DesktopIcon extends Component {
  /** props: app */
  render() {
    const a = this.props.app;
    return h("button", {
      type: "button", className: "icon", dataset: { act: a.id },
      html: `<span class="ib">${icon(a.icon, 48)}</span><span class="cap"></span>`,
      onclick: () => this.emit("press", a.id),
    }, );
  }
  onMount() { this.el.querySelector(".cap").textContent = this.props.app.name; }
}

export class Desktop extends Component {
  /** props: registry, user: () => account, el (adopt an existing #desktop) */
  render() {
    const el = this.props.el || h("div", { className: "desktop", id: "desktop" });
    this.iconBox = h("div", { className: "icons", id: "icons" });
    this.iconBox.hidden = true;
    el.prepend(this.iconBox);
    this.icons = new Map();
    return el;
  }

  /** Rebuild the icon column from the registry for the current user. */
  refreshIcons() {
    for (const c of [...this.icons.values()]) this.drop(c);
    this.icons.clear();
    const apps = this.props.registry?.visible(this.props.user?.()) || [];
    for (const app of apps) {
      const ic = this.adopt(new DesktopIcon({ app }), this.iconBox);
      ic.on("press", id => this.emit("launch", id));
      this.icons.set(app.id, ic);
    }
    return apps.length;
  }

  showIcons(on = true) { this.iconBox.hidden = !on; }
  center(on = true) { this.el.classList.toggle("center", !!on); }
}

export class Backdrop extends Component {
  render() {
    const el = h("div", { className: "backdrop" });
    el.addEventListener("click", () => this.onClick?.());
    return el;
  }
  show(onClick) { this.onClick = onClick; this.el.classList.add("on"); }
  hide() { this.onClick = null; this.el.classList.remove("on"); }
}
