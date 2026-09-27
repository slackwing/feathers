/* Bug Reports — the admins' list (apps/bugs/app.js opens it from the tray):
   Pending / Resolved / All; each report shows who sent it and when, its
   text and picture, the reporter's screen details folded away, and one
   button: Resolve, or Reopen once resolved (with the resolution note). */
import { Window } from "../../os/window.js";
import { h, esc } from "../../os/dom.js";

export const FILTERS = [["pending", "Pending"], ["resolved", "Resolved"], ["all", "All"]];
const when = iso => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); };

export class BugListWindow extends Window {
  /** props: fetch, api (base URL), imageURL(id), people (os.people), onChange(), toast(msg), menus */
  constructor(props) {
    super({ id: "win-bug-list", title: "Bug Reports", icon: "bug", width: 560, cls: "buglist",
      content: `<div class="bfilters">${FILTERS.map(([k, l]) => `<button class="btn" type="button" data-filter="${k}">${l}</button>`).join("")}</div><div class="breports sunken"></div>`,
      ...props });
    this.filter = "pending";
    this.reports = [];
  }

  render() {
    const el = super.render();
    this.listEl = el.querySelector(".breports");
    for (const b of el.querySelectorAll("[data-filter]")) b.addEventListener("click", () => { this.filter = b.dataset.filter; this.load(); });
    this.listEl.addEventListener("click", e => {
      const b = e.target.closest("[data-act]");
      if (b) this.setStatus(+b.dataset.id, b.dataset.act === "resolve" ? "resolved" : "pending");
    });
    return el;
  }

  async load() {
    for (const b of this.el.querySelectorAll("[data-filter]")) b.classList.toggle("on", b.dataset.filter === this.filter);
    try {
      const r = await this.props.fetch(`${this.props.api}?status=${this.filter}`, { credentials: "same-origin", cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      this.reports = await r.json();
    } catch { this.reports = []; this.props.toast?.("The reports could not be read."); }
    this.renderList();
    return this.reports;
  }

  renderList() {
    const people = this.props.people;
    this.listEl.replaceChildren();
    if (!this.reports.length) { this.listEl.append(h("div", { className: "bempty", text: this.filter === "pending" ? "Nothing pending." : "No reports." })); return; }
    for (const b of this.reports) {
      const who = people?.label?.(b.reporter) || b.reporter;
      const row = h("div", { className: `breport ${b.status}`, dataset: { id: String(b.id) } });
      row.innerHTML = `
        <div class="bhead">${people?.avatar?.(b.reporter) || ""}<b>${esc(who)}</b><span class="bwhen">${esc(when(b.created_at))} · #${b.id}</span><span class="bstatus">${esc(b.status)}</span></div>
        ${b.body ? `<div class="bbody">${esc(b.body)}</div>` : ""}
        ${b.image_id ? `<a class="bpic" href="${esc(this.props.imageURL(b.image_id))}" target="_blank" rel="noopener"><img src="${esc(this.props.imageURL(b.image_id))}" alt=""></a>` : ""}
        ${b.note ? `<div class="bnote">${esc(b.note)}</div>` : ""}
        <details class="bctx"><summary>Details</summary><pre>${esc(JSON.stringify(b.context || {}, null, 1))}</pre></details>
        <div class="bacts"><button class="btn${b.status === "pending" ? " primary" : ""}" type="button" data-id="${b.id}" data-act="${b.status === "pending" ? "resolve" : "reopen"}">${b.status === "pending" ? "Resolve" : "Reopen"}</button></div>`;
      this.listEl.append(row);
    }
  }

  async setStatus(id, status) {
    try {
      const r = await this.props.fetch(`${this.props.api}/${id}/status`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!r.ok) throw new Error("HTTP " + r.status);
    } catch { this.props.toast?.("That did not save."); return false; }
    this.props.onChange?.();
    await this.load();
    return true;
  }
}
