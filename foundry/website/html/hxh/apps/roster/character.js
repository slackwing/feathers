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

export const NEN = ["enhancement", "transmutation", "conjuration", "emission", "manipulation", "specialization"];
export const ARCS = [["hunter-exam", "Hunter Exam"], ["zoldyck-family", "Zoldyck Family"], ["heavens-arena", "Heavens Arena"],
  ["yorknew-city", "Yorknew City"], ["greed-island", "Greed Island"], ["chimera-ant", "Chimera Ant"], ["chairman-election", "Chairman Election"]];
export const RANKS = ["S", "A", "B", "C"];
export const TYPES = [["raw", "Raw"], ["cropped", "Cropped"], ["pixelated", "Pixel art"], ["upscaled", "Upscaled"], ["transparent", "Transparent"]];
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : "";
export const slugify = s => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
export const words = s => (String(s || "").trim().match(/\S+/g) || []).length;
export const winId = id => "win-roster-c-" + id;
export const TILE_RATIO = 3 / 2;   // the thumbnail box

const FORM = `
  <div class="frow">
    <div class="f"><label class="lbl">Name</label><input class="field" data-f="name" maxlength="100"></div>
    <div class="f"><label class="lbl">Japanese</label><input class="field" data-f="name_ja" maxlength="100" lang="ja"></div>
  </div>
  <div class="frow four">
    <div class="f"><label class="lbl">Short</label><input class="field" data-f="first" maxlength="20"></div>
    <div class="f"><label class="lbl">Rank</label><select class="field" data-f="rank">${RANKS.map(r => `<option>${r}</option>`).join("")}</select></div>
    <div class="f"><label class="lbl">Nen</label><div class="pair"><select class="field" data-nen="0"></select><select class="field" data-nen="1"></select></div></div>
    <div class="f"><label class="lbl">Affiliation</label><input class="field" data-f="affiliation" maxlength="60"></div>
  </div>
  <div class="frow">
    <div class="f"><label class="lbl">Arcs</label><div class="checks">${ARCS.map(([s, n]) => `<label class="chk"><input type="checkbox" data-arc="${s}"><span>${n}</span></label>`).join("")}</div></div>
    <div class="f"><label class="lbl">Arms</label><input class="field prose" data-f="arms"></div>
  </div>
  <div class="f"><label class="lbl">Description <span class="count" data-count></span></label><textarea class="field prose" data-f="description"></textarea></div>
  <div class="f"><label class="lbl">Notes</label><textarea class="field prose" data-f="notes"></textarea></div>`;

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
            <div class="verdict"><i class="st"></i><span class="ver"></span><span class="by"></span></div>
            <div class="reason"></div>
            <div class="rbtns">
              <button class="btn" type="button" data-review="accepted">Accept</button>
              <button class="btn" type="button" data-review="rejected">Reject…</button>
              <button class="btn" type="button" data-review="pending">Pending</button>
            </div>
            <div class="log"></div>
          </fieldset>
        </div>
        <fieldset class="group profile"><legend>Profile</legend><div class="form">${FORM}</div></fieldset>
        <fieldset class="group pics"><legend>Pictures</legend>
          <div class="gtools">
            <button class="btn sm" type="button" data-img="avatar" disabled>Avatar</button>
            <button class="btn sm" type="button" data-img="card" disabled>Card</button>
            <button class="btn sm" type="button" data-img="crop" disabled>Crop</button>
            <button class="btn sm" type="button" data-img="open" disabled>Open</button>
            <button class="btn sm" type="button" data-img="reject" disabled>Reject</button>
            <button class="btn sm" type="button" data-img="delete" disabled>Delete</button>
            <span class="grow"></span>
            <label class="chk"><input type="checkbox" data-show-rejected><span>Rejected</span></label>
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
    this.showRejected = false;
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
    });
    // form: save on change
    const form = el.querySelector(".form");
    form.addEventListener("input", e => { if (e.target.dataset.f === "description") this.updateCount(); });
    form.addEventListener("change", e => {
      const t = e.target;
      if (t.dataset.f) {
        let v = t.value;
        if (t.dataset.f === "arms") v = v.split(",").map(slugify).filter(Boolean);
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
    el.querySelector("[data-show-rejected]").addEventListener("change", e => { this.showRejected = e.target.checked; this.renderGallery(); });
    this.file.addEventListener("change", () => { if (this.file.files.length) this.emit("upload", { files: [...this.file.files] }); this.file.value = ""; });
    const gbox = this.pane.el;
    gbox.addEventListener("dragover", e => { e.preventDefault(); gbox.classList.add("drop"); });
    gbox.addEventListener("dragleave", () => gbox.classList.remove("drop"));
    gbox.addEventListener("drop", e => { e.preventDefault(); gbox.classList.remove("drop"); const files = [...(e.dataTransfer?.files || [])]; if (files.length) this.emit("upload", { files }); });
    el.addEventListener("keydown", e => { if (e.key === "Escape" && this.selected) { e.stopPropagation(); this.select(null); } });
    void body;
    return el;
  }

  say(msg, err = false) { this.msgEl.textContent = msg; this.msgEl.classList.toggle("err", !!err); }

  /** Everything from the character: title, slots, review, form (unless a field has focus), gallery. */
  setChar(c, { form = true } = {}) {
    this.char = c;
    this.setTitle(`#${c.id} ${c.name}`);
    this.renderSlots();
    this.renderReview();
    if (form) this.fillForm();
    this.renderGallery();
  }

  renderSlots() {
    const c = this.char;
    for (const slot of this.el.querySelectorAll(".slot")) {
      const id = c[slot.dataset.slot];
      slot.classList.toggle("set", !!id);
      slot.replaceChildren(h("i", { className: "lab", text: slot.dataset.slot === "avatar_image_id" ? "Avatar" : "Card" }));
      if (id) slot.append(h("img", { alt: "", src: this.props.thumbURL?.(id) || "" }), h("button", { className: "tbtn clear", type: "button", title: "Clear", text: "×" }));
    }
  }

  renderReview() {
    const c = this.char, el = this.el;
    const st = el.querySelector(".verdict .st");
    st.textContent = cap(c.review_status);
    st.className = "st " + c.review_status;
    el.querySelector(".verdict .ver").textContent = "v" + c.version;
    const last = (c.reviews || [])[0];
    el.querySelector(".verdict .by").textContent = last && last.status === c.review_status ? `by ${last.reviewer}` : "";
    el.querySelector(".reason").textContent = c.review_status === "rejected" ? c.review_reason : "";
    for (const b of el.querySelectorAll("[data-review]")) b.disabled = b.dataset.review === c.review_status;
    const log = el.querySelector(".log");
    log.replaceChildren(...(c.reviews || []).slice(0, 6).map(r => h("div", { className: "lrow" },
      h("b", { text: `v${r.version} ${r.status}` }), ` ${r.reviewer}`, r.reason ? h("span", { className: "why", text: " — " + r.reason }) : null,
      h("span", { className: "when", text: this.when(r.created_at) }))));
  }

  when(iso) {
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  fillForm() {
    const c = this.char, f = this.el.querySelector(".form");
    for (const k of ["name", "name_ja", "first", "rank", "affiliation", "description", "notes"]) f.querySelector(`[data-f="${k}"]`).value = c[k] || (k === "rank" ? "C" : "");
    f.querySelector('[data-f="arms"]').value = (c.arms || []).join(", ");
    f.querySelectorAll("[data-nen]").forEach((s, i) => { s.value = (c.nen_types || [])[i] || ""; });
    for (const [s] of ARCS) f.querySelector(`[data-arc="${s}"]`).checked = (c.arcs || []).includes(s);
    this.updateCount();
  }

  updateCount() {
    const n = words(this.el.querySelector('[data-f="description"]').value), el = this.el.querySelector("[data-count]");
    el.textContent = n ? `${n} words` : "";
    el.classList.toggle("bad", n > 0 && (n < 45 || n > 75));
  }

  renderGallery() {
    const c = this.char, byType = {};
    for (const im of c.images || []) (byType[im.type] ||= []).push(im);
    this.gallery.replaceChildren(...TYPES.flatMap(([t, label]) => {
      const all = byType[t] || [];
      const shown = all.filter(i => this.showRejected || i.status !== "rejected");
      if (!all.length && t !== "raw") return [];
      const sec = h("div", { className: "sec", dataset: { type: t } },
        h("div", { className: "sech" }, h("b", { text: label }), h("span", { className: "n", text: String(all.filter(i => i.status !== "rejected").length) })),
        h("div", { className: "tiles" }, shown.length ? shown.map(im => this.tile(im)) : h("div", { className: "empty", text: t === "raw" ? "Drop pictures here." : "" })));
      return [sec];
    }));
    if (this.selected && !(c.images || []).some(i => i.id === this.selected)) this.selected = null;
    this.markSel();
    this.pane.update();
  }

  tile(im) {
    const c = this.char;
    const roles = [c.avatar_image_id === im.id && "avatar", c.card_image_id === im.id && "card"].filter(Boolean).join(" · ");
    const from = im.source_image_id ? `from #${im.source_image_id}` : "";
    // the thumbnail fills its 3:2 box; whichever edge is longer is cut equally on both sides, and chevrons say so
    const cut = im.width / im.height > TILE_RATIO + 0.01 ? " cut-x" : im.width / im.height < TILE_RATIO - 0.01 ? " cut-y" : "";
    return h("figure", { className: `tile ${im.status}${["pixelated", "transparent"].includes(im.type) ? " pixel" : ""}`, dataset: { id: String(im.id) }, title: im.caption || "" },
      h("div", { className: "pic" + cut }, h("img", { alt: "", src: this.props.thumbURL?.(im.id) || "", loading: "lazy" })),
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
      tools.querySelector('[data-img="reject"]').textContent = im.status === "rejected" ? "Restore" : "Reject";
      tools.querySelector('[data-img="reject"]').disabled = im.type !== "raw";
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
