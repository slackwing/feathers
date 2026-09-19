/* CropWindow — a picture at its own size (or fitted to the desktop) on a
   canvas in a sunken frame, with two rows of tools: the marquee (one
   marching-ants crop box with eight handles), a round brush (radius
   slider, a Paint palette plus the browser's own colour picker), an
   eyedropper, undo / redo, revert — basic MS Paint — and ratio buttons
   for the box. A Paint-style status bar reads the box; "Crop and save"
   sends the box to the server when the picture is untouched (exact
   source pixels) and uploads the painted pixels when it is not. Arrows
   nudge the box (Shift ×10), Enter saves, Escape clears the box. */
import { Window } from "../../os/window.js";
import { h } from "../../os/dom.js";
import { icon } from "../../os/icons.js";
import { RATIOS, clamp, roundBox, fromAnchor, refit, moveTo, resize, fitZoom, cropCanvas } from "./geometry.js";

export const cropId = imageId => "win-crop-" + imageId;
export const TOOLS = ["marquee", "brush", "dropper"];
/* the 16 of MS Paint's default box, near enough */
export const PALETTE = ["#000000", "#808080", "#800000", "#ff0000", "#ff7f27", "#ffff00", "#22b14c", "#008000", "#00ffff", "#0000ff", "#000080", "#800080", "#ff00ff", "#804000", "#c0c0c0", "#ffffff"];
export const UNDO_DEPTH = 15;
const hex = (r, g, b) => "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");

export class CropWindow extends Window {
  /** props: image {id,width,height,type}, char {id,name}, src (url), canvas {cw,ch}, ratio, fit */
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
          <div class="ratios">${RATIOS.map(([l, r]) => `<button class="btn sm" type="button" data-r="${r}">${l}</button>`).join("")}</div>
          <span class="grow"></span>
          <button class="btn sm" type="button" data-act="fit">Fit</button>
        </div>
        <div class="canvas sunken"><div class="wrap"><canvas class="pic"></canvas><i class="cursor" hidden></i><div class="box" hidden><i class="ants"></i>${["n", "s", "e", "w", "ne", "nw", "se", "sw"].map(d => `<b class="hd ${d}" data-h="${d}"></b>`).join("")}</div></div></div>
        <div class="foot">
          <span class="status"><span class="pos"></span><span class="saved"></span></span>
          <button class="btn primary" type="button" data-act="save" disabled>Crop and save</button>
        </div>`,
      ...props,
    });
    this.W = image.width; this.H = image.height;
    this.z = 1; this.fit = !!props.fit; this.ratio = props.ratio || 0;
    this.box = null;
    this.drag = null;
    this.tool = "marquee"; this.radius = 8; this.color = "#000000";
    this.undoStack = []; this.redoStack = []; this.dirty = false;
    this.ctx = null; this.source = null;
  }

  render() {
    const el = super.render();
    this.canvas = el.querySelector(".canvas"); this.wrap = el.querySelector(".wrap");
    this.pic = el.querySelector("canvas.pic"); this.boxEl = el.querySelector(".box"); this.cursorEl = el.querySelector(".cursor");
    this.posEl = el.querySelector(".pos"); this.savedEl = el.querySelector(".saved");
    this.saveBtn = el.querySelector('[data-act="save"]');
    this.rangeEl = el.querySelector(".radius input"); this.colorEl = el.querySelector(".swatch input");
    this.wrap.classList.toggle("pixel", ["pixelated", "transparent"].includes(this.props.image.type));
    this.pic.width = this.W; this.pic.height = this.H;
    this.ctx = this.pic.getContext?.("2d") || null;
    el.querySelector(".ratios").addEventListener("click", e => { const b = e.target.closest("[data-r]"); if (b) this.setRatio(+b.dataset.r); });
    el.querySelector('[data-act="fit"]').addEventListener("click", () => this.setFit(!this.fit));
    el.querySelectorAll("[data-tool]").forEach(b => b.addEventListener("click", () => this.setTool(b.dataset.tool)));
    el.querySelector(".palette").addEventListener("click", e => { const b = e.target.closest("[data-color]"); if (b) this.setColor(b.dataset.color); });
    this.colorEl.addEventListener("input", () => this.setColor(this.colorEl.value, { fromInput: true }));
    this.rangeEl.addEventListener("input", () => this.setRadius(+this.rangeEl.value));
    el.querySelector('[data-act="undo"]').addEventListener("click", () => this.undo());
    el.querySelector('[data-act="redo"]').addEventListener("click", () => this.redo());
    el.querySelector('[data-act="revert"]').addEventListener("click", () => this.revert());
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
  onMount() { this.layout(); this.markRatio(); this.setTool(this.tool); this.setColor(this.color); this.setRadius(this.radius); }

  /** Paint the source picture onto the canvas (same origin, so the canvas stays clean for reading pixels). */
  loadPicture() {
    if (!this.props.src || typeof Image === "undefined") return;
    const img = new Image();
    img.onload = () => { this.source = img; this.ctx?.drawImage(img, 0, 0, this.W, this.H); };
    img.src = this.props.src;
  }

  /** Size the canvas frame to what the desktop affords and pick the zoom. */
  layout() {
    const { cw, ch } = this.props.canvas || cropCanvas(this.W, this.H, 1366, 900);
    this.z = this.fit ? fitZoom(this.W, this.H, cw, ch) : 1;
    const ww = Math.round(this.W * this.z), wh = Math.round(this.H * this.z);
    this.canvas.style.width = Math.min(cw, ww) + "px";
    this.canvas.style.height = Math.min(ch, wh) + "px";
    this.wrap.style.width = ww + "px"; this.wrap.style.height = wh + "px";
    this.el.style.width = Math.max(640, Math.min(cw, ww) + 44) + "px";
    const fitBtn = this.el.querySelector('[data-act="fit"]');
    fitBtn.classList.toggle("pressed", this.fit);
    fitBtn.textContent = this.fit ? `Fit ${Math.round(this.z * 100)}%` : "Fit";
    this.draw();
  }

  setFit(on) { this.fit = on; this.emit("fit", { fit: on }); this.layout(); }
  setRatio(r) {
    this.ratio = r;
    this.emit("ratio", { ratio: r });
    this.markRatio();
    if (this.box && r) { this.box = refit(this.W, this.H, r, this.box); this.draw(); }
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

  /* ---------- undo / redo / revert ---------- */
  snapshot() {
    if (!this.ctx) return;
    this.undoStack.push(this.ctx.getImageData(0, 0, this.W, this.H));
    while (this.undoStack.length > UNDO_DEPTH) this.undoStack.shift();
    this.redoStack.length = 0;
    this.syncHistory();
  }
  undo() {
    const s = this.undoStack.pop();
    if (!s || !this.ctx) return;
    this.redoStack.push(this.ctx.getImageData(0, 0, this.W, this.H));
    this.ctx.putImageData(s, 0, 0);
    this.dirty = this.undoStack.length > 0 || this.redoStack.length === 0 ? this.dirty : this.dirty;
    this.dirty = this.undoStack.length > 0;
    this.syncHistory();
  }
  redo() {
    const s = this.redoStack.pop();
    if (!s || !this.ctx) return;
    this.undoStack.push(this.ctx.getImageData(0, 0, this.W, this.H));
    this.ctx.putImageData(s, 0, 0);
    this.dirty = true;
    this.syncHistory();
  }
  /** Back to the picture as stored — itself undoable. */
  revert() {
    if (!this.dirty || !this.ctx || !this.source) return;
    this.snapshot();
    this.ctx.clearRect(0, 0, this.W, this.H);
    this.ctx.drawImage(this.source, 0, 0, this.W, this.H);
    this.dirty = false;
    this.syncHistory();
  }
  syncHistory() {
    this.el.querySelector('[data-act="undo"]').disabled = !this.undoStack.length;
    this.el.querySelector('[data-act="redo"]').disabled = !this.redoStack.length;
    this.el.querySelector('[data-act="revert"]').disabled = !this.dirty;
    this.draw();
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
    if (this.tool === "brush") { this.snapshot(); this.drag = { kind: "paint", last: p }; this.dot(p); this.dirty = true; this.syncHistory(); return; }
    if (this.tool === "dropper") { this.pick(p); return; }
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
    if (d.kind === "paint") { this.stroke(d.last, p); d.last = p; return; }
    if (d.kind === "draw") this.box = fromAnchor(this.W, this.H, this.ratio, d.ax, d.ay, p.x, p.y);
    else if (d.kind === "move") this.box = moveTo(this.W, this.H, this.box, p.x - d.ox, p.y - d.oy);
    else this.box = resize(this.W, this.H, this.ratio, d.start, d.dir, p.x, p.y);
    this.draw();
  }
  up() {
    if (!this.drag) return;
    const kind = this.drag.kind;
    this.drag = null;
    if (kind === "paint") return;
    if (this.box && (this.box.w < 1 || this.box.h < 1)) this.box = null;
    if (this.box) this.box = roundBox(this.box);
    this.draw();
  }
  key(e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); this.redo(); return; }
    if (e.key === "Escape" && this.box) { e.stopPropagation(); this.box = null; this.draw(); return; }
    if (e.key === "Enter" && this.box) { e.preventDefault(); this.save(); return; }
    if (!this.box || !/^Arrow/.test(e.key)) return;
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1, b = this.box;
    const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
    const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
    this.box = moveTo(this.W, this.H, b, b.x + dx, b.y + dy);
    this.draw();
  }

  /* ---------- painting ---------- */
  dot(p) {
    const c = this.ctx;
    if (!c) return;
    c.fillStyle = this.color;
    c.beginPath(); c.arc(p.x, p.y, this.radius, 0, Math.PI * 2); c.fill();
  }
  stroke(a, b) {
    const c = this.ctx;
    if (!c) return;
    c.strokeStyle = this.color; c.lineWidth = this.radius * 2; c.lineCap = "round"; c.lineJoin = "round";
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
  }
  pick(p) {
    if (!this.ctx) return;
    const d = this.ctx.getImageData(Math.min(this.W - 1, Math.floor(p.x)), Math.min(this.H - 1, Math.floor(p.y)), 1, 1).data;
    this.setColor(hex(d[0], d[1], d[2]));
    this.setTool("brush");   // Paint goes back to the brush after a pick
  }

  /** Set the box from outside (tests, presets). */
  setBox(b) { this.box = b ? roundBox(b) : null; this.draw(); }

  draw() {
    const b = this.box && roundBox(this.box);
    this.boxEl.hidden = !b;
    this.saveBtn.disabled = !(b && b.w >= 1 && b.h >= 1) && !this.dirty;
    if (!b) { this.posEl.textContent = this.dirty ? "painted" : ""; return; }
    const z = this.z;
    Object.assign(this.boxEl.style, { left: b.x * z + "px", top: b.y * z + "px", width: b.w * z + "px", height: b.h * z + "px" });
    this.posEl.textContent = `${b.x}, ${b.y}  ·  ${b.w} × ${b.h}${this.dirty ? "  ·  painted" : ""}`;
  }

  /** The pixels of rect (or the whole picture) as a PNG blob. */
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
    const rect = this.box ? roundBox(this.box) : { x: 0, y: 0, w: this.W, h: this.H };
    if (rect.w < 1 || rect.h < 1) return;
    this.saveBtn.disabled = true;
    this.savedEl.textContent = "";
    if (!this.dirty) { this.emit("save", { rect }); return; }
    try {
      const blob = await this.exportPNG(rect);
      this.emit("save", { rect, blob });
    } catch (err) { this.failed(err.message); }
  }
  /** Called by the app with the server's answer. */
  saved(image, created = true) {
    this.saveBtn.disabled = !this.box && !this.dirty;
    this.savedEl.textContent = `${created ? "Saved" : "Already"} #${image.id} ${image.width}×${image.height}`;
    this.savedEl.classList.remove("err");
  }
  failed(msg) { this.saveBtn.disabled = !this.box && !this.dirty; this.savedEl.textContent = msg; this.savedEl.classList.add("err"); }
}
