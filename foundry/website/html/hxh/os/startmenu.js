/* StartMenu — the Windows-style menu off the Start button: a user header
   (initials avatar + name), the vertical band, and an item list rendered
   by the shared menu renderer. Items come from the OS (the app registry
   + system items), the user from the session. */
import { Component } from "./component.js";
import { h, esc } from "./dom.js";
import { avatar } from "./icons.js";
import { Menus, renderItems } from "./menu.js";

export class StartMenu extends Component {
  /** props: items: () => items, user: () => account | null, band = "HUNTER×HALLOWEEN" */
  render() {
    const el = h("div", { className: "startmenu", id: "startmenu" });
    el.addEventListener("click", e => e.stopPropagation());
    return el;
  }

  refresh() {
    const user = this.props.user?.();
    const band = this.props.band ?? "HUNTER×HALLOWEEN";
    this.el.replaceChildren();
    if (user) {
      this.el.append(h("div", { className: "user", html: `${avatar(user, "lg")}<span class="name">${esc(user.display_name || user.username || "")}</span>` }));
    }
    const row = h("div", { className: "row" }, h("div", { className: "band", text: band }));
    const box = h("div", { className: "items" });
    for (const s of this.subs || []) s.unmount();
    this.subs = renderItems(this.props.items?.() || [], box, () => this.close(), this);
    row.append(box);
    this.el.append(row);
  }

  get isOpen() { return this.el.classList.contains("open"); }

  open() {
    Menus.closeAll(this);
    this.refresh();
    this.el.classList.add("open");
    Menus.track(this);
    this.emit("open");
  }

  close() {
    if (!this.isOpen) return;
    for (const s of this.subs || []) s.close();
    this.el.classList.remove("open");
    Menus.untrack(this);
    this.emit("close");
  }

  toggle() { this.isOpen ? this.close() : this.open(); }

  onUnmount() { for (const s of this.subs || []) s.unmount(); Menus.untrack(this); }
}
