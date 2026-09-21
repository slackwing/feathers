/* CharacterWindow — one character: the avatar and card slots, the
   review box (verdict, version, reason, log, Accept / Reject… / Pending),
   the profile as a 90s dialog form (labels over sunken fields, saved on
   change), and the pictures — a toolbar acting on the selected tile
   (Avatar, Card, Crop, Open, Reject, Delete, Upload) over a sunken
   gallery grouped by type, newest first. Double-click a tile to crop;
   drop files anywhere on the gallery to upload raws. */
import { Window } from "../../os/window.js";
import { h, esc } from "../../os/dom.js";
import { ScrollPane } from "../../os/scrollpane.js";
import { LABEL, TYPES, AVATAR_RATIO, CARD_RATIO } from "./fields.js";

export const NEN = ["enhancement", "transmutation", "conjuration", "emission", "manipulation", "specialization"];
export const ARCS = [["hunter-exam", "Hunter Exam"], ["zoldyck-family", "Zoldyck Family"], ["heavens-arena", "Heavens Arena"],
  ["yorknew-city", "Yorknew City"], ["greed-island", "Greed Island"], ["chimera-ant", "Chimera Ant"], ["chairman-election", "Chairman Election"]];
export const RANKS = ["S", "A", "B", "C"];
export { TYPES };
export { AVATAR_RATIO, CARD_RATIO };
export const RATIO_TOL = 0.02;
export const FIT_MIN = 9 / 16, FIT_MAX = 16 / 9;   // thumbnails inside this range show whole; outside, the short side shows and chevrons mark the cut
export const eligible = (im, ratio) => Math.abs(im.width / im.height - ratio) <= RATIO_TOL;
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : "";
export const slugify = s => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
export const words = s => (String(s || "").trim().match(/\S+/g) || []).length;
export const winId = id => "win-roster-c-" + id;

/**
 * What the reviewer has not judged yet (Andrew, 2026-09-21): the bot's
 * changes above the version of the last human verdict (the baseline).
 * A human's own changes are self-approved and never marked; a character
 * never judged has no baseline and shows nothing. Returns the field
 * names and picture ids to mark, plus the rows for the summary line.
 */
export function freshness(c) {
  const rows = c.baseline ? (c.changes || []).filter(x => x.bot && x.version > c.baseline.version) : [];
  return {
    rows,
    fields: new Set(rows.filter(x => x.kind === "field").map(x => x.field)),
    images: new Set(rows.filter(x => x.kind === "image" && x.image_id && x.action !== "removed").map(x => x.image_id)),
  };
}
const wedge = () => h("i", { className: "new", text: "New", title: "Changed by the bot since the last verdict" });
const fieldName = k => LABEL[k] || { avatar_image_id: "Avatar", card_image_id: "Card" }[k] || k;

const FORM = `
  <div class="frow three">
    <div class="f"><label class="lbl">${LABEL.card_number}</label><input class="field" data-f="card_number" type="number" min="0" step="1"></div>
    <div class="f"><label class="lbl">${LABEL.name}</label><input class="field" data-f="name" maxlength="100"></div>
    <div class="f"><label class="lbl">${LABEL.name_ja}</label><input class="field" data-f="name_ja" maxlength="100" lang="ja"></div>
  </div>
  <div class="frow four">
    <div class="f"><label class="lbl">${LABEL.first}</label><input class="field" data-f="first" maxlength="20"></div>
    <div class="f"><label class="lbl">${LABEL.rank}</label><select class="field" data-f="rank">${RANKS.map(r => `<option>${r}</option>`).join("")}</select></div>
    <div class="f"><label class="lbl">${LABEL.nen_types}</label><div class="pair"><select class="field" data-nen="0"></select><select class="field" data-nen="1"></select></div></div>
    <div class="f"><label class="lbl">${LABEL.affiliation}</label><input class="field" data-f="affiliation" maxlength="60"></div>
  </div>
  <div class="frow">
    <div class="f"><label class="lbl">${LABEL.arcs}</label><div class="checks">${ARCS.map(([s, n]) => `<label class="chk"><input type="checkbox" data-arc="${s}"><span>${n}</span></label>`).join("")}</div></div>
    <div class="f"><label class="lbl">${LABEL.arms}</label><input class="field prose" data-f="arms"></div>
  </div>
  <div class="f"><label class="lbl">${LABEL.description} <span class="count" data-count></span></label><textarea class="field prose" data-f="description"></textarea></div>
  <div class="f"><label class="lbl">${LABEL.card_description} <span class="count" data-count2></span></label><textarea class="field prose short" data-f="card_description"></textarea></div>
  <div class="f"><label class="lbl">${LABEL.notes}</label><textarea class="field prose" data-f="notes"></textarea></div>`;

export class CharacterWindow extends Window {
  /** props: id, name, menus (win => spec), thumbURL(id) */
  constructor(props) {
    const { id, name, ...rest } = props;
    super({
      id: winId(id), title: `#${id} ${name || ""}`.trim(), icon: "card", width: 980, cls: "roster rchar",
      content: `
        <div class="top">
          <div class="slots">
            <div class="slot av" data-slot="avatar_image_id" title="Avatar"><i class="lab">Avatar</i></div>
            <div class="slot cd" data-slot="card_image_id" title="Card"><i class="lab">Card</i></div>
          </div>
          <fieldset class="group review">
            <legend>Review</legend>
            <div class="verdict"><i class="st"></i><span class="ver"></span><span class="by"></span><i class="reqs"></i></div>
            <div class="changes"></div>
            <div class="reason"></div>
            <div class="rbtns">
              <button class="btn" type="button" data-review="accepted">Accept</button>
              <button class="btn" type="button" data-review="rejected">Reject…</button>
              <button class="btn" type="button" data-review="pending">Pending</button>
              <span class="gap"></span>
              <span class="rq"><button class="btn" type="button" data-request>Request…</button><button class="link" type="button" data-requests>View Requests</button></span>
            </div>
            <div class="log"></div>
          </fieldset>
        </div>
        <fieldset class="group profile"><legend>Profile</legend><div class="form">${FORM}</div></fieldset>
        <fieldset class="group pics"><legend>Pictures</legend>
          <div class="gtools">
            <button class="btn sm" type="button" data-img="avatar" disabled>Set as Avatar</button>
            <button class="btn sm" type="button" data-img="card" disabled>Set as Card</button>
            <span class="gap"></span>
            <button class="btn sm" type="button" data-img="crop" disabled>Crop</button>
            <button class="btn sm" type="button" data-img="open" disabled>Open in New Tab</button>
            <button class="btn sm" type="button" data-img="delete" disabled>Delete</button>
            <span class="gap"></span>
            <button class="btn sm" type="button" data-img="request" disabled>Request…</button>
            <span class="grow"></span>
            <button class="btn sm" type="button" data-img="upload">Upload…</button>
          </div>
        </fieldset>
        <div class="status"><span class="msg"></span><span class="sel"></span></div>
        <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden>`,
      ...rest,
    });
    this.charId = id;
    this.char = null;
    this.selected = null;
  }

  render() {
    const el = super.render();
    const body = el.querySelector(".body");
    this.gallery = h("div", { className: "gallery" });
    this.pane = this.adopt(new ScrollPane({ content: this.gallery }), el.querySelector(".pics"));
    this.pane.el.classList.add("sunken", "gbox");
    this.msgEl = el.querySelector(".status .msg");
    this.selEl = el.querySelector(".status .sel");
    this.file = el.querySelector('input[type="file"]');
    for (const s of el.querySelectorAll("[data-nen]")) s.innerHTML = `<option value="">—</option>` + NEN.map(n => `<option value="${n}">${cap(n)}</option>`).join("");

    // slots: the × clears
    el.querySelector(".slots").addEventListener("click", e => {
      const x = e.target.closest(".clear");
      if (x) this.emit("slot", { slot: x.closest(".slot").dataset.slot, id: null });
    });
    // review
    el.querySelector(".rbtns").addEventListener("click", e => {
      const b = e.target.closest("[data-review]");
      if (b && !b.disabled) this.emit("review", { status: b.dataset.review });
      if (e.target.closest("[data-request]")) this.emit("request");
      if (e.target.closest("[data-requests]")) this.emit("requests");
    });
    // form: save on change
    const form = el.querySelector(".form");
    form.addEventListener("input", e => { if (e.target.dataset.f === "description" || e.target.dataset.f === "card_description") this.updateCount(); });
    form.addEventListener("change", e => {
      const t = e.target;
      if (t.dataset.f) {
        let v = t.value;
        if (t.dataset.f === "arms") v = v.split(",").map(slugify).filter(Boolean);
        else if (t.dataset.f === "card_number") v = Math.max(0, parseInt(v, 10) || 0);
        else if (t.tagName !== "TEXTAREA") v = v.trim();
        this.emit("patch", { fields: { [t.dataset.f]: v } });
      } else if (t.dataset.nen !== undefined) {
        const vals = [...form.querySelectorAll("[data-nen]")].map(s => s.value).filter(Boolean);
        this.emit("patch", { fields: { nen_types: [...new Set(vals)] } });
      } else if (t.dataset.arc) {
        const arcs = ARCS.map(([s]) => s).filter(s => form.querySelector(`[data-arc="${s}"]`).checked);
        this.emit("patch", { fields: { arcs } });
      }
    });
    // gallery
    this.gallery.addEventListener("click", e => { const t = e.target.closest(".tile"); if (t) this.select(+t.dataset.id === this.selected ? null : +t.dataset.id); });
    this.gallery.addEventListener("dblclick", e => { const t = e.target.closest(".tile"); if (t) this.emit("crop", { id: +t.dataset.id }); });
    el.querySelector(".gtools").addEventListener("click", e => {
      const b = e.target.closest("[data-img]");
      if (!b || b.disabled) return;
      if (b.dataset.img === "upload") { this.file.click(); return; }
      this.emit("image", { act: b.dataset.img, id: this.selected });
    });
    this.file.addEventListener("change", () => { if (this.file.files.length) this.emit("upload", { files: [...this.file.files] }); this.file.value = ""; });
    const gbox = this.pane.el;
    gbox.addEventListener("dragover", e => { e.preventDefault(); gbox.classList.add("drop"); });
    gbox.addEventListener("dragleave", () => gbox.classList.remove("drop"));
    gbox.addEventListener("drop", e => { e.preventDefault(); gbox.classList.remove("drop"); const files = [...(e.dataTransfer?.files || [])]; if (files.length) this.emit("upload", { files }); });
    el.addEventListener("keydown", e => { if (e.key === "Escape" && this.selected) { e.stopPropagation(); this.select(null); } });
    // a click on dead space anywhere in the window drops the picture selection (Andrew, 2026-09-21)
    el.addEventListener("click", e => { if (this.selected && !e.target.closest(".tile, .gtools, button, input, select, textarea, label, a")) this.select(null); });
    void body;
    return el;
  }

  say(msg, err = false) { this.msgEl.textContent = msg; this.msgEl.classList.toggle("err", !!err); }

  /** Everything from the character: title, slots, review, form (unless a field has focus), gallery. */
  setChar(c, { form = true } = {}) {
    this.char = c;
    this.fresh = freshness(c);
    this.setTitle((c.card_number == null ? "" : `No. ${c.card_number} · `) + `${c.name} (id ${c.id})`);
    this.renderSlots();
    this.renderReview();
    if (form) this.fillForm(); else this.syncNumber();   // the number arrives with the first Accept, whatever field has focus
    this.renderWedges();
    this.renderGallery();
  }

  /** The No. field: blank and off until the card is first accepted, then its number. */
  syncNumber() {
    const c = this.char, no = this.el.querySelector('[data-f="card_number"]');
    if (no === this.el.ownerDocument.activeElement) return;
    no.value = c.card_number == null ? "" : String(c.card_number);
    no.disabled = c.card_number == null;
  }

  /** The New wedge on every profile field the bot changed since the last verdict (the slots and tiles draw their own). */
  renderWedges() {
    const f = this.el.querySelector(".form");
    for (const w of f.querySelectorAll(".new")) w.remove();
    for (const k of this.fresh.fields) {
      const ctl = f.querySelector(`[data-f="${k}"]`) || (k === "nen_types" ? f.querySelector("[data-nen]") : k === "arcs" ? f.querySelector("[data-arc]") : null);
      ctl?.closest(".f")?.querySelector(".lbl")?.append(wedge());
    }
  }

  renderSlots() {
    const c = this.char;
    for (const slot of this.el.querySelectorAll(".slot")) {
      const id = c[slot.dataset.slot];
      slot.classList.toggle("set", !!id);
      slot.replaceChildren(h("i", { className: "lab", text: slot.dataset.slot === "avatar_image_id" ? "Avatar" : "Card" }));
      if (id) slot.append(h("img", { alt: "", src: this.props.thumbURL?.(id) || "" }), h("button", { className: "tbtn clear", type: "button", title: "Clear", text: "×" }));
      if (this.fresh?.fields.has(slot.dataset.slot)) slot.append(wedge());
    }
  }

  /** One line under the verdict: what the bot changed since the last verdict, e.g. "Since v35 (accepted by abi), claude: Description, Notes · 3 pictures added". */
  renderChanges() {
    const c = this.char, box = this.el.querySelector(".changes"), rows = this.fresh.rows;
    box.replaceChildren();
    if (!rows.length) return;
    const fields = [...new Set(rows.filter(x => x.kind === "field").map(x => x.field))].map(fieldName);
    const count = (act, word) => { const n = rows.filter(x => x.kind === "image" && x.action === act).length; return n ? `${n} picture${n === 1 ? "" : "s"} ${word}` : ""; };
    const parts = [fields.join(", "), count("added", "added"), count("removed", "removed"), count("edited", "edited")].filter(Boolean);
    const who = [...new Set(rows.map(x => x.owner))].join(", ");
    box.append(h("span", { className: "since", text: `Since v${c.baseline.version} (${c.baseline.status} by ${c.baseline.owner}), ${who}: ` }), h("span", { text: parts.join(" · ") }));
  }

  renderReview() {
    const c = this.char, el = this.el;
    const st = el.querySelector(".verdict .st");
    st.textContent = cap(c.review_status);
    st.className = "st " + c.review_status;
    el.querySelector(".verdict .ver").textContent = "v" + c.version;
    const last = (c.reviews || [])[0];
    el.querySelector(".verdict .by").textContent = last && last.status === c.review_status ? `by ${last.owner}` : "";
    const open = (c.requests || []).filter(q => q.status === "open").length;
    const reqs = el.querySelector(".verdict .reqs");
    reqs.textContent = open ? `${open} request${open === 1 ? "" : "s"} open` : "";
    reqs.hidden = !open;
    this.renderChanges();
    const reason = el.querySelector(".reason");
    reason.textContent = c.review_status === "rejected" && c.review_reason ? "Rejected: " + c.review_reason
      : c.review_status === "skipped" ? "Skipped" + (c.review_reason ? ": " + c.review_reason : "") : "";
    reason.classList.toggle("rejected", c.review_status === "rejected");
    reason.classList.toggle("skipped", c.review_status === "skipped");
    // a skipped stub is frozen: no verdict, no request, no edit, no picture, until the bot resurrects it (Andrew, 2026-09-21)
    const frozen = c.review_status === "skipped";
    for (const b of el.querySelectorAll("[data-review]")) b.disabled = frozen || b.dataset.review === c.review_status;
    el.querySelector("[data-request]").disabled = frozen;
    el.querySelector('[data-img="upload"]').disabled = frozen;
    for (const f of el.querySelectorAll(".form input, .form select, .form textarea")) { if (f.dataset.f !== "card_number") f.disabled = frozen; }
    el.classList.toggle("frozen-skipped", frozen);
    const log = el.querySelector(".log");
    log.replaceChildren(...(c.reviews || []).slice(0, 6).map(r => h("div", { className: "lrow" },
      h("b", { text: `v${r.version} ${r.status}` }), ` ${r.owner}`, r.reason ? h("span", { className: "why", text: " — " + r.reason }) : null,
      h("span", { className: "when", text: this.when(r.created_at) }))));
  }

  when(iso) {
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  fillForm() {
    const c = this.char, f = this.el.querySelector(".form");
    for (const k of ["name", "name_ja", "first", "rank", "affiliation", "description", "card_description", "notes"]) f.querySelector(`[data-f="${k}"]`).value = c[k] || (k === "rank" ? "C" : "");
    this.syncNumber();
    f.querySelector('[data-f="arms"]').value = (c.arms || []).join(", ");
    f.querySelectorAll("[data-nen]").forEach((s, i) => { s.value = (c.nen_types || [])[i] || ""; });
    for (const [s] of ARCS) f.querySelector(`[data-arc="${s}"]`).checked = (c.arcs || []).includes(s);
    this.updateCount();
  }

  updateCount() {
    const n = words(this.el.querySelector('[data-f="description"]').value), el = this.el.querySelector("[data-count]");
    el.textContent = n ? `${n} words` : "";
    el.classList.toggle("bad", n > 0 && (n < 45 || n > 75));
    const m = words(this.el.querySelector('[data-f="card_description"]').value), el2 = this.el.querySelector("[data-count2]");
    el2.textContent = m ? `${m} words` : "";
    el2.classList.toggle("bad", m > 40);
  }

  renderGallery() {
    const c = this.char, byType = {};
    for (const im of c.images || []) (byType[im.type] ||= []).push(im);
    // every category shows, empty ones with a 0 — a hint of what else can exist
    this.gallery.replaceChildren(...TYPES.map(([t, label]) => {
      const all = byType[t] || [];
      return h("div", { className: "sec" + (all.length ? "" : " none"), dataset: { type: t } },
        h("div", { className: "sech" }, h("b", { text: label }), h("span", { className: "n", text: String(all.length) })),
        all.length ? h("div", { className: "tiles" }, all.map(im => this.tile(im))) : null);
    }));
    if (this.selected && !(c.images || []).some(i => i.id === this.selected)) this.selected = null;
    this.markSel();
    this.pane.update();
  }

  tile(im) {
    const c = this.char;
    const roles = [c.avatar_image_id === im.id && "avatar", c.card_image_id === im.id && "card"].filter(Boolean).join(" · ");
    const from = im.source_image_id ? `from #${im.source_image_id}` : "";
    // a square slot per picture, pictures centred in it: between 2:3 and 3:2 the whole picture shows at its own
    // proportion; beyond that the short side shows in full and chevrons mark the long side that was cut
    const r = im.width / im.height;
    const fit = r > FIT_MAX ? "cut-x" : r < FIT_MIN ? "cut-y" : "fit";
    return h("figure", { className: `tile${["pixelated", "transparent"].includes(im.type) ? " pixel" : ""}`, dataset: { id: String(im.id) }, title: im.caption || "" },
      h("div", { className: "pic " + fit }, h("img", { alt: "", src: this.props.thumbURL?.(im.id) || "", loading: "lazy" }), this.fresh?.images.has(im.id) ? wedge() : null,
        (c.requests || []).some(q => q.status === "open" && q.image_id === im.id) ? h("i", { className: "asked", text: "Request made", title: "An open request is on this picture" }) : null),
      h("figcaption", {},
        h("div", { className: "l1" }, h("b", { text: "#" + im.id }), h("span", { text: `${im.width}×${im.height}` }), h("span", { className: "role", text: roles })),
        h("div", { className: "l2", text: [from, im.caption].filter(Boolean).join(" · ") })));
  }

  select(id) {
    this.selected = id;
    this.markSel();
    const im = id && (this.char.images || []).find(i => i.id === id);
    const tools = this.el.querySelector(".gtools");
    for (const b of tools.querySelectorAll("[data-img]")) if (b.dataset.img !== "upload") b.disabled = !im;
    if (im) {
      // only a picture of the right proportion can be the avatar (1:1) or the card (2:3)
      tools.querySelector('[data-img="avatar"]').disabled = !eligible(im, AVATAR_RATIO);
      tools.querySelector('[data-img="card"]').disabled = !eligible(im, CARD_RATIO);
      tools.querySelector('[data-img="avatar"]').classList.toggle("pressed", this.char.avatar_image_id === id);
      tools.querySelector('[data-img="card"]').classList.toggle("pressed", this.char.card_image_id === id);
      this.selEl.textContent = `#${im.id} · ${im.type} · ${im.width}×${im.height} · ${Math.round(im.bytes / 1024)} KB`;
    } else {
      this.selEl.textContent = "";
      for (const b of tools.querySelectorAll(".pressed")) b.classList.remove("pressed");
    }
  }
  markSel() { for (const t of this.gallery.querySelectorAll(".tile")) t.classList.toggle("sel", +t.dataset.id === this.selected); }
}
