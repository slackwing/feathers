/* RosterWindow — the character list, a 90s "details" view: column
   headers as raised buttons INSIDE the sunken list (sticky at the top,
   so they line up with the rows under the same scrollbar), one row per
   character, a status bar counting them. All verdicts show, sorted by
   status (pending, accepted, rejected) then by card number; View
   narrows to one status, or to the characters with open requests. Column names and picture categories come
   from fields.js. Double-click (or Enter) opens the character. Rows
   drag: dropping one between two others is ONE renumbering on the
   server (Andrew, 2026-09-21), shown under the busy overlay. */
import { Window } from "../../os/window.js";
import { h } from "../../os/dom.js";
import { ScrollPane } from "../../os/scrollpane.js";
import { LABEL, TYPES, STATUSES, STATUS_ORDER } from "./fields.js";

export const FILTERS = [["", "All"], ...STATUSES, ["requests", "With requests"]];
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : "";
const PICS_TITLE = TYPES.map(([, l]) => l).join(" · ");
/* a card's number, or null until it is first accepted (Andrew, 2026-09-21: pending and rejected numbers were confusing) */
export const number = c => (c.card_number == null ? null : c.card_number);

/**
 * Where a dragged row would land: the row above the insertion point,
 * as { after: its id (0 for the top), y: where to draw the line } — or
 * null when the drop would leave the order as it is. rows are the row
 * elements in their visual order; y is the pointer's clientY.
 */
export function dropTarget(rows, y, id) {
  rows = rows.filter(r => r.dataset.no);   // only numbered cards take part
  const others = rows.filter(r => +r.dataset.id !== id);
  const before = others.find(r => { const b = r.getBoundingClientRect(); return y < b.top + b.height / 2; });
  const i = before ? others.indexOf(before) : others.length;
  const after = i === 0 ? 0 : +others[i - 1].dataset.id;
  const cur = rows.findIndex(r => +r.dataset.id === id);
  if (after === (cur > 0 ? +rows[cur - 1].dataset.id : 0)) return null;
  const last = others[others.length - 1];
  return { after, y: before ? before.offsetTop : last ? last.offsetTop + last.offsetHeight : 0 };
}

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
      h("span", { className: "c-no", text: LABEL.card_number, title: "Card number" }), h("span", { className: "c-av" }),
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
    this.body.addEventListener("mousedown", e => this.dragStart(e));
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

  /** By status (pending, requested, accepted, rejected), then by card number, then by id. */
  shown() {
    return this.chars.filter(c => !this.filter ? c.review_status !== "skipped" : this.filter === "requests" ? c.open_requests > 0 : c.review_status === this.filter)
      .sort((a, b) => (STATUS_ORDER[a.review_status] ?? 9) - (STATUS_ORDER[b.review_status] ?? 9) || (number(a) ?? Infinity) - (number(b) ?? Infinity) || a.id - b.id);
  }

  /* A row drags once the mouse has moved a few pixels (a plain click still selects); a line shows where it would land. */
  dragStart(e) {
    if (e.button !== 0) return;
    const row = e.target.closest(".row");
    if (!row || !row.dataset.no) return;   // an unnumbered card has no place to drag to
    const id = +row.dataset.id, doc = row.ownerDocument;
    const st = { on: false, after: null, line: null, x0: e.clientX, y0: e.clientY };
    const move = ev => {
      if (!st.on) {
        if (Math.abs(ev.clientX - st.x0) + Math.abs(ev.clientY - st.y0) < 4) return;
        st.on = true;
        row.classList.add("dragging"); this.rows.classList.add("dragging");
        st.line = h("div", { className: "drop-line" });
        this.body.append(st.line);
      }
      ev.preventDefault();
      const t = dropTarget([...this.body.querySelectorAll(".row")], ev.clientY, id);
      st.after = t ? t.after : null;
      st.line.hidden = !t;
      if (t) st.line.style.top = t.y + "px";
    };
    const end = ev => {
      doc.removeEventListener("mousemove", move); doc.removeEventListener("mouseup", end); doc.removeEventListener("keydown", key);
      if (!st.on) return;
      row.classList.remove("dragging"); this.rows.classList.remove("dragging"); st.line.remove();
      if (ev && st.after !== null) this.emit("move", { id, after: st.after });
    };
    const key = ev => { if (ev.key === "Escape") end(null); };
    doc.addEventListener("mousemove", move); doc.addEventListener("mouseup", end); doc.addEventListener("keydown", key);
  }

  renderRows() {
    const list = this.shown();
    this.body.replaceChildren(...list.map(c => this.row(c)));
    if (!list.length) this.body.append(h("div", { className: "empty", text: "None." }));
    this.markSel();
    const pending = this.chars.filter(c => c.review_status === "pending").length;
    const asked = this.chars.filter(c => c.open_requests > 0).length;
    const skipped = this.chars.filter(c => c.review_status === "skipped").length;
    const n = this.chars.length - skipped;
    this.countEl.textContent = `${n} character${n === 1 ? "" : "s"} · ${pending} pending` + (asked ? ` · ${asked} with requests` : "") + (skipped ? ` · ${skipped} skipped` : "");
    this.pane.update();
  }

  row(c) {
    const av = c.avatar_image_id ? h("img", { className: "av", alt: "", src: this.props.thumbURL?.(c.avatar_image_id) || "" }) : h("i", { className: "av none" });
    const counts = TYPES.map(([t]) => (c.image_counts || {})[t] || 0);
    const no = number(c);
    return h("div", { className: "row", dataset: { id: String(c.id), ...(no == null ? {} : { no: String(no) }) }, role: "option" },
      h("span", { className: "c-no", text: no == null ? "" : String(no), title: "id " + c.id }),
      h("span", { className: "c-av" }, av),
      h("span", { className: "c-name", text: c.name }),
      h("span", { className: "c-ja", text: c.name_ja || "" }),
      h("span", { className: "c-rank", text: c.rank || "" }),
      h("span", { className: "c-nen", text: (c.nen_types || []).map(cap).join(" / ") }),
      h("span", { className: "c-aff", text: c.affiliation || "" }),
      h("span", { className: "c-pics", title: PICS_TITLE }, ...counts.map((n, i) => h("i", { className: n ? "" : "zero", text: String(n), title: TYPES[i][1] }))),
      h("span", { className: "c-ver", text: String(c.version || 1) }),
      h("span", { className: "c-st" }, h("i", { className: "verdict " + c.review_status, text: cap(c.review_status) }),
        c.open_requests > 0 ? h("i", { className: "reqs", text: String(c.open_requests), title: `${c.open_requests} open request${c.open_requests === 1 ? "" : "s"}` }) : null),
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
