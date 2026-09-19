/* RosterWindow — the character list, a 90s "details" view: column
   headers as raised buttons INSIDE the sunken list (sticky at the top,
   so they line up with the rows under the same scrollbar), one row per
   character, a status bar counting them. All verdicts show, pending
   first, then accepted, then rejected; View narrows to one. Column
   names and picture categories come from fields.js. Double-click (or
   Enter) opens the character. */
import { Window } from "../../os/window.js";
import { h } from "../../os/dom.js";
import { ScrollPane } from "../../os/scrollpane.js";
import { LABEL, TYPES, STATUSES, STATUS_ORDER } from "./fields.js";

export const FILTERS = [["", "All"], ...STATUSES];
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : "";
const PICS_TITLE = TYPES.map(([, l]) => l).join(" · ");

export class RosterWindow extends Window {
  /** props: menus (win => spec), thumbURL(id) */
  constructor(props = {}) {
    super({
      id: "win-roster", title: "Roster DB", icon: "db", width: 1280, cls: "roster rlist",
      content: `<div class="status"><span class="msg"></span><span class="count"></span></div>`,
      ...props,
    });
    this.chars = [];
    this.filter = "";
    this.selected = null;
  }

  render() {
    const el = super.render();
    this.rows = h("div", { className: "rows", role: "listbox", tabindex: "0" });
    this.head = h("div", { className: "lhead" },
      h("span", { className: "c-no", text: "#" }), h("span", { className: "c-av" }),
      h("span", { className: "c-name", text: LABEL.name }), h("span", { className: "c-ja", text: LABEL.name_ja }),
      h("span", { className: "c-rank", text: LABEL.rank }), h("span", { className: "c-nen", text: LABEL.nen_types }),
      h("span", { className: "c-aff", text: LABEL.affiliation }), h("span", { className: "c-pics", text: "Pics", title: PICS_TITLE }),
      h("span", { className: "c-ver", text: "v", title: "Version" }), h("span", { className: "c-st", text: "Review" }));
    this.body = h("div", { className: "lbody" });
    this.rows.append(this.head, this.body);
    this.pane = this.adopt(new ScrollPane({ content: this.rows }), el.querySelector(".body"), { before: el.querySelector(".status") });
    this.pane.el.classList.add("sunken", "listbox");
    this.msgEl = el.querySelector(".msg");
    this.countEl = el.querySelector(".count");
    this.body.addEventListener("click", e => { const r = e.target.closest(".row"); if (r) this.select(+r.dataset.id); });
    this.body.addEventListener("dblclick", e => { const r = e.target.closest(".row"); if (r) this.emit("open", { id: +r.dataset.id }); });
    this.rows.addEventListener("keydown", e => {
      if (e.key === "Enter" && this.selected) { e.preventDefault(); this.emit("open", { id: this.selected }); }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const list = this.shown(), i = list.findIndex(c => c.id === this.selected);
        const next = list[Math.max(0, Math.min(list.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))];
        if (next) this.select(next.id);
      }
    });
    return el;
  }

  setChars(list) {
    this.chars = list || [];
    this.renderRows();
  }
  setFilter(f) { this.filter = f; this.renderRows(); }
  say(msg, err = false) { this.msgEl.textContent = msg; this.msgEl.classList.toggle("err", !!err); }

  /** Pending first, then accepted, then rejected; by number within. */
  shown() {
    return this.chars.filter(c => !this.filter || c.review_status === this.filter)
      .sort((a, b) => (STATUS_ORDER[a.review_status] ?? 9) - (STATUS_ORDER[b.review_status] ?? 9) || a.id - b.id);
  }

  renderRows() {
    const list = this.shown();
    this.body.replaceChildren(...list.map(c => this.row(c)));
    if (!list.length) this.body.append(h("div", { className: "empty", text: "None." }));
    this.markSel();
    const pending = this.chars.filter(c => c.review_status === "pending").length;
    this.countEl.textContent = `${this.chars.length} character${this.chars.length === 1 ? "" : "s"} · ${pending} pending`;
    this.pane.update();
  }

  row(c) {
    const av = c.avatar_image_id ? h("img", { className: "av", alt: "", src: this.props.thumbURL?.(c.avatar_image_id) || "" }) : h("i", { className: "av none" });
    const counts = TYPES.map(([t]) => (c.image_counts || {})[t] || 0);
    return h("div", { className: "row", dataset: { id: String(c.id) }, role: "option" },
      h("span", { className: "c-no", text: String(c.id) }),
      h("span", { className: "c-av" }, av),
      h("span", { className: "c-name", text: c.name }),
      h("span", { className: "c-ja", text: c.name_ja || "" }),
      h("span", { className: "c-rank", text: c.rank || "" }),
      h("span", { className: "c-nen", text: (c.nen_types || []).map(cap).join(" / ") }),
      h("span", { className: "c-aff", text: c.affiliation || "" }),
      h("span", { className: "c-pics", title: PICS_TITLE }, ...counts.map((n, i) => h("i", { className: n ? "" : "zero", text: String(n), title: TYPES[i][1] }))),
      h("span", { className: "c-ver", text: String(c.version || 1) }),
      h("span", { className: "c-st" }, h("i", { className: "verdict " + c.review_status, text: cap(c.review_status) })),
    );
  }

  select(id) { this.selected = id; this.markSel(); }
  markSel() { for (const r of this.body.querySelectorAll(".row")) r.classList.toggle("sel", +r.dataset.id === this.selected); }

  /** Replace one character's row in place (after an edit elsewhere). */
  update(c) {
    const i = this.chars.findIndex(x => x.id === c.id);
    if (i < 0) this.chars.push(c); else this.chars[i] = { ...this.chars[i], ...c };
    this.renderRows();
  }
  drop(id) { this.chars = this.chars.filter(c => c.id !== id); this.renderRows(); }
}
