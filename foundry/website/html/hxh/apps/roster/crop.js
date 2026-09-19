/* CropWindow — one picture in a sunken frame, always shown whole (the
   window sizes itself to the picture, scaled down if the desktop is
   smaller), with a Paint-style tool row — marquee, round brush, bucket,
   eyedropper; brush size; the 16 Paint colours plus the browser's own
   picker; undo / redo / revert; expand canvas (20 px of white on every
   side) — and a row of crop ratios. A ratio button starts a centred
   selection you can drag; the status bar reads the selection, or the
   picture size when there is none. Save sends the box to the server
   when the picture is untouched (exact source pixels) and uploads the
   painted pixels otherwise; the app closes the window once the
   database has answered. All edits go through PaintDoc's history. */
import { Window } from "../../os/window.js";
import { icon } from "../../os/icons.js";
import { PaintDoc } from "./paint.js";
import { RATIOS, clamp, roundBox, fromAnchor, refit, fitAround, moveTo, resize, fitZoom, cropCanvas } from "./geometry.js";

export const cropId = imageId => "win-crop-" + imageId;
export const TOOLS = ["marquee", "brush", "bucket", "dropper"];
/* the 16 of MS Paint's default box, near enough */
export const PALETTE = ["#000000", "#808080", "#800000", "#ff0000", "#ff7f27", "#ffff00", "#22b14c", "#008000", "#00ffff", "#0000ff", "#000080", "#800080", "#ff00ff", "#804000", "#c0c0c0", "#ffffff"];
export const EXPAND_PX = 20;
export const PRESET_SHARE = 0.6;   // a ratio button's starting selection: this much of the limiting side
const LABELS = { 1: "1:1 Avatar", [2 / 3]: "2:3 Card" };
const MIN_WIDTH = 720;

export class CropWindow extends Window {
  /** props: image {id,width,height,type}, char {id,name}, src (url), desktop {vw,vh}, ratio, menus */
  constructor(props) {
    const { image, char } = props;
    super({
      id: cropId(image.id), title: `Crop #${image.id} — ${char.name}`, icon: "crop", cls: "roster rcrop", task: true,
      content: `
        <div class="ctools">
          <div class="seg">${TOOLS.map(t => `<button class="btn sm ic" type="button" data-tool="${t}" title="${t[0].toUpperCase() + t.slice(1)}">${icon(t, 16)}</button>`).join("")}</div>
          <label class="radius" title="Brush size"><input type="range" min="1" max="64" value="8"><span class="rv">8</span></label>
          <span class="swatch" title="Colour"><input type="color" value="#000000"></span>
          <div class="palette">${PALETTE.map(c => `<button type="button" data-color="${c}" style="background:${c}" title="${c}"></button>`).join("")}</div>
          <span class="grow"></span>
          <button class="btn sm ic" type="button" data-act="undo" title="Undo" disabled>${icon("undo", 16)}</button>
          <button class="btn sm ic" type="button" data-act="redo" title="Redo" disabled>${icon("redo", 16)}</button>
          <button class="btn sm ic" type="button" data-act="revert" title="Revert" disabled>${icon("revert", 16)}</button>
        </div>
        <div class="ctools">
          <div class="ratios">${RATIOS.map(([l, r]) => `<button class="btn sm" type="button" data-r="${r}">${LABELS[r] || l}</button>`).join("")}</div>
          <span class="grow"></span>
          <button class="btn sm ic" type="button" data-act="expand" title="Expand canvas">${icon("expand", 16)}</button>
        </div>
        <div class="canvas sunken"><div class="wrap"><canvas class="pic"></canvas><i class="cursor" hidden></i><div class="box" hidden><i class="ants"></i>${["n", "s", "e", "w", "ne", "nw", "se", "sw"].map(d => `<b class="hd ${d}" data-h="${d}"></b>`).join("")}</div></div></div>
        <div class="foot">
          <span class="status"><span class="pos"></span><span class="saved"></span></span>
          <button class="btn primary" type="button" data-act="save" disabled>Save</button>
        </div>`,
      ...props,
    });
    this.desktop = props.desktop || { vw: 1366, vh: 900 };
    this.z = 1; this.ratio = props.ratio || 0;
    this.box = null;
    this.drag = null;
    this.tool = "marquee"; this.radius = 8; this.color = "#000000";
    this.doc = null;
  }

  get W() { return this.doc ? this.doc.W : this.props.image.width; }
  get H() { return this.doc ? this.doc.H : this.props.image.height; }
  get dirty() { return !!this.doc?.dirty; }

  render() {
    const el = super.render();
    this.canvas = el.querySelector(".canvas"); this.wrap = el.querySelector(".wrap");
    this.pic = el.querySelector("canvas.pic"); this.boxEl = el.querySelector(".box"); this.cursorEl = el.querySelector(".cursor");
    this.posEl = el.querySelector(".pos"); this.savedEl = el.querySelector(".saved");
    this.saveBtn = el.querySelector('[data-act="save"]');
    this.rangeEl = el.querySelector(".radius input"); this.colorEl = el.querySelector(".swatch input");
    this.wrap.classList.toggle("pixel", ["pixelated", "transparent"].includes(this.props.image.type));
    this.doc = new PaintDoc({ canvas: this.pic, width: this.props.image.width, height: this.props.image.height, onChange: () => this.onDocChange() });
    el.querySelector(".ratios").addEventListener("click", e => { const b = e.target.closest("[data-r]"); if (b) this.setRatio(+b.dataset.r); });
    el.querySelectorAll("button[data-tool]").forEach(b => b.addEventListener("click", () => this.setTool(b.dataset.tool)));
    el.querySelector(".palette").addEventListener("click", e => { const b = e.target.closest("[data-color]"); if (b) this.setColor(b.dataset.color); });
    this.colorEl.addEventListener("input", () => this.setColor(this.colorEl.value, { fromInput: true }));
    this.rangeEl.addEventListener("input", () => this.setRadius(+this.rangeEl.value));
    el.querySelector('[data-act="undo"]').addEventListener("click", () => this.doc.undo());
    el.querySelector('[data-act="redo"]').addEventListener("click", () => this.doc.redo());
    el.querySelector('[data-act="revert"]').addEventListener("click", () => this.emit("revert"));
    el.querySelector('[data-act="expand"]').addEventListener("click", () => this.expand());
    this.saveBtn.addEventListener("click", () => this.save());
    this.wrap.addEventListener("pointerdown", e => this.down(e));
    this.wrap.addEventListener("pointermove", e => this.move(e));
    this.wrap.addEventListener("pointerup", () => this.up());
    this.wrap.addEventListener("pointercancel", () => this.up());
    this.wrap.addEventListener("pointerleave", () => { this.cursorEl.hidden = true; });
    el.addEventListener("keydown", e => this.key(e));
    el.tabIndex = -1;
    this.loadPicture();
    return el;
  }

  /** The element exists only after render, so sizing waits for the mount. */
  onMount() { this.layout(); this.markRatio(); this.setTool(this.tool); this.setColor(this.color); this.setRadius(this.radius); this.syncHistory(); }

  /** Paint the stored picture onto the canvas (same origin, so pixels stay readable). */
  loadPicture() {
    if (!this.props.src || typeof Image === "undefined") return;
    const img = new Image();
    img.onload = () => this.doc.load(img);
    img.src = this.props.src;
  }

  /** After any history move: the picture may have changed size. */
  onDocChange() {
    if (this.box && (this.box.x + this.box.w > this.W || this.box.y + this.box.h > this.H)) this.box = null;
    if (this.el) { this.layout(); this.syncHistory(); }
  }

  /** The window holds the whole picture: scale down to what the desktop affords, never up. */
  layout() {
    const { cw, ch } = cropCanvas(this.W, this.H, this.desktop.vw, this.desktop.vh);
    this.z = fitZoom(this.W, this.H, cw, ch);
    const ww = Math.round(this.W * this.z), wh = Math.round(this.H * this.z);
    this.canvas.style.width = ww + "px"; this.canvas.style.height = wh + "px";
    this.wrap.style.width = ww + "px"; this.wrap.style.height = wh + "px";
    this.el.style.width = Math.max(MIN_WIDTH, ww + 44) + "px";
    this.sizeCursor();
    this.draw();
  }

  setRatio(r) {
    this.ratio = r;
    this.emit("ratio", { ratio: r });
    this.markRatio();
    if (!r) { this.draw(); return; }
    if (this.box) this.box = refit(this.W, this.H, r, this.box);
    else {
      // a ratio button starts you off: a centred selection, 60 % of the limiting side
      const w = Math.min(this.W, this.H * r) * PRESET_SHARE;
      this.box = roundBox(fitAround(this.W, this.H, r, this.W / 2, this.H / 2, w, w / r));
    }
    this.draw();
  }
  markRatio() { for (const b of this.el.querySelectorAll("[data-r]")) b.classList.toggle("pressed", +b.dataset.r === this.ratio); }

  /* ---------- tools ---------- */
  setTool(t) {
    if (!TOOLS.includes(t)) return;
    this.tool = t;
    for (const b of this.el.querySelectorAll("button[data-tool]")) b.classList.toggle("pressed", b.dataset.tool === t);
    this.wrap.dataset.tool = t;
    this.cursorEl.hidden = t !== "brush";
    this.emit("tool", { tool: t });
  }
  setColor(c, { fromInput = false } = {}) {
    this.color = c;
    if (!fromInput) this.colorEl.value = c;
    this.el.querySelector(".swatch").style.setProperty("--c", c);
    for (const b of this.el.querySelectorAll("[data-color]")) b.classList.toggle("pressed", b.dataset.color === c);
  }
  setRadius(r) {
    this.radius = clamp(Math.round(r), 1, 64);
    this.rangeEl.value = String(this.radius);
    this.el.querySelector(".rv").textContent = String(this.radius);
    this.sizeCursor();
  }
  sizeCursor(p) {
    const d = this.radius * 2 * this.z;
    Object.assign(this.cursorEl.style, { width: d + "px", height: d + "px" });
    if (p) Object.assign(this.cursorEl.style, { left: p.x * this.z + "px", top: p.y * this.z + "px" });
  }

  /* ---------- history ---------- */
  syncHistory() {
    const d = this.doc;
    this.el.querySelector('[data-act="undo"]').disabled = !d?.canUndo;
    this.el.querySelector('[data-act="redo"]').disabled = !d?.canRedo;
    this.el.querySelector('[data-act="revert"]').disabled = !d?.dirty;
    this.draw();
  }
  /** After the app has confirmed. */
  doRevert() { this.doc.revert(); }
  expand() {
    this.doc.expand(EXPAND_PX);
    if (this.box) this.box = { ...this.box, x: this.box.x + EXPAND_PX, y: this.box.y + EXPAND_PX };
    this.layout();
  }

  /* ---------- pointer ---------- */
  pt(e) {
    const r = this.wrap.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / this.z, 0, this.W), y: clamp((e.clientY - r.top) / this.z, 0, this.H) };
  }
  down(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    this.wrap.setPointerCapture?.(e.pointerId);
    const p = this.pt(e);
    if (this.tool === "brush") { this.doc.beginStroke(p, this.color, this.radius); this.drag = { kind: "paint", last: p }; return; }
    if (this.tool === "bucket") { this.doc.fill(p, this.color); return; }
    if (this.tool === "dropper") { const c = this.doc.pick(p); if (c) this.setColor(c); this.setTool("brush"); return; }
    const hd = e.target.closest?.(".hd");
    if (hd && this.box) this.drag = { kind: "resize", dir: hd.dataset.h, start: { ...this.box } };
    else if (this.box && e.target.closest?.(".box")) this.drag = { kind: "move", ox: p.x - this.box.x, oy: p.y - this.box.y };
    else { this.drag = { kind: "draw", ax: p.x, ay: p.y }; this.box = null; this.draw(); }
  }
  move(e) {
    const p = this.pt(e);
    if (this.tool === "brush") { this.cursorEl.hidden = false; this.sizeCursor(p); }
    if (!this.drag) return;
    const d = this.drag;
    if (d.kind === "paint") { this.doc.segment(d.last, p, this.color, this.radius); d.last = p; return; }
    if (d.kind === "draw") this.box = fromAnchor(this.W, this.H, this.ratio, d.ax, d.ay, p.x, p.y);
    else if (d.kind === "move") this.box = moveTo(this.W, this.H, this.box, p.x - d.ox, p.y - d.oy);
    else this.box = resize(this.W, this.H, this.ratio, d.start, d.dir, p.x, p.y);
    this.draw();
  }
  up() {
    if (!this.drag) return;
    const kind = this.drag.kind;
    this.drag = null;
    if (kind === "paint") { this.doc.endStroke(); return; }
    if (this.box && (this.box.w < 1 || this.box.h < 1)) this.box = null;
    if (this.box) this.box = roundBox(this.box);
    this.draw();
  }
  key(e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? this.doc.redo() : this.doc.undo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); this.doc.redo(); return; }
    if (e.key === "Escape" && this.box) { e.stopPropagation(); this.box = null; this.draw(); return; }
    if (e.key === "Enter") { e.preventDefault(); this.save(); return; }
    if (!this.box || !/^Arrow/.test(e.key)) return;
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1, b = this.box;
    const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
    const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
    this.box = moveTo(this.W, this.H, b, b.x + dx, b.y + dy);
    this.draw();
  }

  /** Set the box from outside (tests, presets). */
  setBox(b) { this.box = b ? roundBox(b) : null; this.draw(); }

  draw() {
    const b = this.box && roundBox(this.box);
    this.boxEl.hidden = !b;
    this.saveBtn.disabled = !(b && b.w >= 1 && b.h >= 1) && !this.dirty;
    const painted = this.dirty ? "  ·  painted" : "";
    if (!b) { this.posEl.textContent = `${this.W} × ${this.H}${painted}`; return; }
    const z = this.z;
    Object.assign(this.boxEl.style, { left: b.x * z + "px", top: b.y * z + "px", width: b.w * z + "px", height: b.h * z + "px" });
    this.posEl.textContent = `${b.x}, ${b.y}  ·  ${b.w} × ${b.h}${painted}`;
  }

  /** The pixels of rect as a PNG blob. */
  exportPNG(rect) {
    return new Promise((res, rej) => {
      const out = this.pic.ownerDocument.createElement("canvas");
      out.width = rect.w; out.height = rect.h;
      const c = out.getContext("2d");
      if (!c) return rej(new Error("no canvas"));
      c.drawImage(this.pic, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
      out.toBlob(b => (b ? res(b) : rej(new Error("no image"))), "image/png");
    });
  }

  async save() {
    const rect = this.box ? roundBox(this.box) : (this.dirty ? { x: 0, y: 0, w: this.W, h: this.H } : null);
    if (!rect || rect.w < 1 || rect.h < 1) return;
    this.saveBtn.disabled = true;
    this.savedEl.textContent = "";
    if (!this.dirty) { this.emit("save", { rect }); return; }
    try {
      const blob = await this.exportPNG(rect);
      this.emit("save", { rect, blob });
    } catch (err) { this.failed(err.message); }
  }
  /** Called by the app with the server's answer (the app then closes the window). */
  saved(image, created = true) {
    this.savedEl.textContent = `${created ? "Saved" : "Already"} #${image.id} ${image.width}×${image.height}`;
    this.savedEl.classList.remove("err");
  }
  failed(msg) { this.saveBtn.disabled = !this.box && !this.dirty; this.savedEl.textContent = msg; this.savedEl.classList.add("err"); }
}
