/* RequestsWindow — every request ever filed on one character, as a
   table: what was asked, the details, whether it is still pending,
   fulfilled by the bot, or withdrawn by a reviewer's own verdict
   (Andrew, 2026-09-21: "View Requests" under Request…). Reads the
   character the app hands it and re-reads when the roster changes. */
import { Window } from "../../os/window.js";
import { h } from "../../os/dom.js";
import { ScrollPane } from "../../os/scrollpane.js";

export const REQUEST_STATUS = { open: "Pending", done: "Fulfilled", withdrawn: "Withdrawn" };
export const requestsId = id => `win-roster-q-${id}`;

export class RequestsWindow extends Window {
  /** props: id (character), name, char (() => the character as last loaded) */
  constructor({ id, name, char, ...rest } = {}) {
    super({ id: requestsId(id), title: `Requests · ${name || "#" + id}`, icon: "db", width: 860, cls: "roster rreq", content: `<div class="status"><span class="msg"></span><span class="count"></span></div>`, ...rest });
    this.charId = id;
    this.char = char;
  }

  render() {
    const el = super.render();
    this.rows = h("div", { className: "rows" });
    this.head = h("div", { className: "lhead" },
      h("span", { className: "q-no", text: "#" }), h("span", { className: "q-kind", text: "Request" }), h("span", { className: "q-pic", text: "Picture" }), h("span", { className: "q-text", text: "Details" }),
      h("span", { className: "q-st", text: "Status" }), h("span", { className: "q-by", text: "By" }), h("span", { className: "q-when", text: "Filed" }), h("span", { className: "q-done", text: "Resolved" }));
    this.body = h("div", { className: "lbody" });
    this.rows.append(this.head, this.body);
    this.pane = this.adopt(new ScrollPane({ content: this.rows }), el.querySelector(".body"), { before: el.querySelector(".status") });
    this.pane.el.classList.add("sunken", "listbox");
    this.countEl = el.querySelector(".count");
    this.update();
    return el;
  }

  when(iso) { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString([], { month: "short", day: "numeric" }); }

  /** Newest first. */
  update() {
    const c = this.char?.() || {};
    const list = [...(c.requests || [])].sort((a, b) => b.id - a.id);
    this.body.replaceChildren(...list.map(q => h("div", { className: "row " + q.status, dataset: { id: String(q.id) } },
      h("span", { className: "q-no", text: String(q.id) }),
      h("span", { className: "q-kind", text: q.label || q.kind }),
      h("span", { className: "q-pic", text: q.image_id ? `#${q.image_id}${(c.images || []).some(im => im.id === q.image_id) ? "" : " (deleted)"}` : "" }),
      h("span", { className: "q-text", text: q.text || "", title: q.text || "" }),
      h("span", { className: "q-st" }, h("i", { className: "verdict rq-" + q.status, text: REQUEST_STATUS[q.status] || q.status })),
      h("span", { className: "q-by", text: q.owner || "" }),
      h("span", { className: "q-when", text: `${this.when(q.created_at)} · v${q.version}` }),
      h("span", { className: "q-done", text: q.resolved_at ? `${this.when(q.resolved_at)}${q.resolved_by ? " · " + q.resolved_by : ""}` : "" }))));
    if (!list.length) this.body.append(h("div", { className: "empty", text: "None." }));
    const open = list.filter(q => q.status === "open").length;
    this.countEl.textContent = `${list.length} request${list.length === 1 ? "" : "s"} · ${open} pending`;
    this.pane.update();
  }
}
