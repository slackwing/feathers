/* RosterWindow — the character list, a 90s "details" view: column
   headers over a sunken list with a real scrollbar, one row per
   character (number, avatar, name, Japanese name, rank, Nen, affiliation,
   pictures, version, verdict), and a status bar counting them. View
   filters by verdict. Double-click (or Enter) opens the character. */
import { Window } from "../../os/window.js";
import { h, esc } from "../../os/dom.js";
import { ScrollPane } from "../../os/scrollpane.js";

export const FILTERS = [["pending", "Pending"], ["accepted", "Accepted"], ["rejected", "Rejected"], ["", "All"]];
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : "";

export class RosterWindow extends Window {
  /** props: menus (win => spec), thumbURL(id) */
  constructor(props = {}) {
    super({
      id: "win-roster", title: "Roster DB", icon: "db", width: 1280, cls: "roster rlist",
      content: `
        <div class="lhead"><span class="c-no">#</span><span class="c-av"></span><span class="c-name">Name</span><span class="c-ja">Japanese</span><span class="c-rank">Card rank</span><span class="c-nen">Nen</span><span class="c-aff">Affiliation</span><span class="c-pics">Pics</span><span class="c-ver">v</span><span class="c-st">Review</span></div>
        <div class="status"><span class="msg"></span><span class="count"></span></div>`,
      ...props,
    });
    this.chars = [];
    this.filter = "pending";
    this.selected = null;
  }

  render() {
    const el = super.render();
    this.rows = h("div", { className: "rows", role: "listbox", tabindex: "0" });
    this.pane = this.adopt(new ScrollPane({ content: this.rows }), el.querySelector(".body"), { before: el.querySelector(".status") });
    this.pane.el.classList.add("sunken", "listbox");
    this.msgEl = el.querySelector(".msg");
    this.countEl = el.querySelector(".count");
    this.rows.addEventListener("click", e => { const r = e.target.closest(".row"); if (r) this.select(+r.dataset.id); });
    this.rows.addEventListener("dblclick", e => { const r = e.target.closest(".row"); if (r) this.emit("open", { id: +r.dataset.id }); });
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

  shown() { return this.chars.filter(c => !this.filter || c.review_status === this.filter); }

  renderRows() {
    const list = this.shown();
    this.rows.replaceChildren(...list.map(c => this.row(c)));
    if (!list.length) this.rows.append(h("div", { className: "empty", text: "None." }));
    this.markSel();
    const pending = this.chars.filter(c => c.review_status === "pending").length;
    this.countEl.textContent = `${this.chars.length} character${this.chars.length === 1 ? "" : "s"} · ${pending} pending`;
    this.pane.update();
  }

  row(c) {
    const av = c.avatar_image_id ? h("img", { className: "av", alt: "", src: this.props.thumbURL?.(c.avatar_image_id) || "" }) : h("i", { className: "av none" });
    return h("div", { className: "row", dataset: { id: String(c.id) }, role: "option" },
      h("span", { className: "c-no", text: String(c.id) }),
      h("span", { className: "c-av" }, av),
      h("span", { className: "c-name", text: c.name }),
      h("span", { className: "c-ja", text: c.name_ja || "" }),
      h("span", { className: "c-rank", text: c.rank || "" }),
      h("span", { className: "c-nen", text: (c.nen_types || []).map(cap).join(" / ") }),
      h("span", { className: "c-aff", text: c.affiliation || "" }),
      h("span", { className: "c-pics", text: String(c.image_count ?? "") }),
      h("span", { className: "c-ver", text: "v" + (c.version || 1) }),
      h("span", { className: "c-st" }, h("i", { className: "verdict " + c.review_status, text: cap(c.review_status) })),
    );
  }

  select(id) { this.selected = id; this.markSel(); }
  markSel() { for (const r of this.rows.querySelectorAll(".row")) r.classList.toggle("sel", +r.dataset.id === this.selected); }

  /** Replace one character's row in place (after an edit elsewhere). */
  update(c) {
    const i = this.chars.findIndex(x => x.id === c.id);
    if (i < 0) this.chars.push(c); else this.chars[i] = { ...this.chars[i], ...c };
    this.renderRows();
  }
  drop(id) { this.chars = this.chars.filter(c => c.id !== id); this.renderRows(); }
}
