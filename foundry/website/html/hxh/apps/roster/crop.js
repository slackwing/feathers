/* CropWindow — a picture at its own size (or fitted to the desktop) in
   a sunken canvas, a ratio toolbar, one marching-ants selection with
   eight handles, a Paint-style status bar (x, y · w × h) and "Crop and
   save". The server cuts the exact source pixels; the box is kept in
   picture pixels and only drawn at the zoom. Arrows nudge (Shift ×10),
   Enter saves, Escape clears. */
import { Window } from "../../os/window.js";
import { h } from "../../os/dom.js";
import { RATIOS, clamp, roundBox, fromAnchor, refit, moveTo, resize, fitZoom, cropCanvas } from "./geometry.js";

export const cropId = imageId => "win-crop-" + imageId;

export class CropWindow extends Window {
  /** props: image {id,width,height,type}, char {id,name}, src (url), canvas {cw,ch}, ratio, fit */
  constructor(props) {
    const { image, char } = props;
    super({
      id: cropId(image.id), title: `Crop #${image.id} — ${char.name}`, icon: "crop", cls: "roster rcrop", task: true,
      content: `
        <div class="ctools">
          <div class="ratios">${RATIOS.map(([l, r]) => `<button class="btn sm" type="button" data-r="${r}">${l}</button>`).join("")}</div>
          <span class="grow"></span>
          <button class="btn sm" type="button" data-act="fit">Fit</button>
        </div>
        <div class="canvas sunken"><div class="wrap"><img alt="" draggable="false"><div class="box" hidden><i class="ants"></i>${["n", "s", "e", "w", "ne", "nw", "se", "sw"].map(d => `<b class="hd ${d}" data-h="${d}"></b>`).join("")}</div></div></div>
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
  }

  render() {
    const el = super.render();
    this.canvas = el.querySelector(".canvas"); this.wrap = el.querySelector(".wrap");
    this.img = el.querySelector("img"); this.boxEl = el.querySelector(".box");
    this.posEl = el.querySelector(".pos"); this.savedEl = el.querySelector(".saved");
    this.saveBtn = el.querySelector('[data-act="save"]');
    this.wrap.classList.toggle("pixel", ["pixelated", "transparent"].includes(this.props.image.type));
    this.img.src = this.props.src || "";
    el.querySelector(".ratios").addEventListener("click", e => { const b = e.target.closest("[data-r]"); if (b) this.setRatio(+b.dataset.r); });
    el.querySelector('[data-act="fit"]').addEventListener("click", () => this.setFit(!this.fit));
    this.saveBtn.addEventListener("click", () => this.save());
    this.wrap.addEventListener("pointerdown", e => this.down(e));
    this.wrap.addEventListener("pointermove", e => this.move(e));
    this.wrap.addEventListener("pointerup", () => this.up());
    this.wrap.addEventListener("pointercancel", () => this.up());
    el.addEventListener("keydown", e => this.key(e));
    el.tabIndex = -1;
    return el;
  }

  /** The element exists only after render, so sizing waits for the mount. */
  onMount() { this.layout(); this.markRatio(); }

  /** Size the canvas to what the desktop affords and pick the zoom. */
  layout() {
    const { cw, ch } = this.props.canvas || cropCanvas(this.W, this.H, 1366, 900);
    this.z = this.fit ? fitZoom(this.W, this.H, cw, ch) : 1;
    const ww = Math.round(this.W * this.z), wh = Math.round(this.H * this.z);
    this.canvas.style.width = Math.min(cw, ww) + "px";
    this.canvas.style.height = Math.min(ch, wh) + "px";
    this.wrap.style.width = ww + "px"; this.wrap.style.height = wh + "px";
    this.el.style.width = (Math.min(cw, ww) + 44) + "px";
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

  pt(e) {
    const r = this.wrap.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / this.z, 0, this.W), y: clamp((e.clientY - r.top) / this.z, 0, this.H) };
  }

  down(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    this.wrap.setPointerCapture?.(e.pointerId);
    const p = this.pt(e), hd = e.target.closest?.(".hd");
    if (hd && this.box) this.drag = { kind: "resize", dir: hd.dataset.h, start: { ...this.box } };
    else if (this.box && e.target.closest?.(".box")) this.drag = { kind: "move", ox: p.x - this.box.x, oy: p.y - this.box.y };
    else { this.drag = { kind: "draw", ax: p.x, ay: p.y }; this.box = null; this.draw(); }
  }
  move(e) {
    if (!this.drag) return;
    const p = this.pt(e), d = this.drag;
    if (d.kind === "draw") this.box = fromAnchor(this.W, this.H, this.ratio, d.ax, d.ay, p.x, p.y);
    else if (d.kind === "move") this.box = moveTo(this.W, this.H, this.box, p.x - d.ox, p.y - d.oy);
    else this.box = resize(this.W, this.H, this.ratio, d.start, d.dir, p.x, p.y);
    this.draw();
  }
  up() {
    if (!this.drag) return;
    this.drag = null;
    if (this.box && (this.box.w < 1 || this.box.h < 1)) this.box = null;
    if (this.box) this.box = roundBox(this.box);
    this.draw();
  }
  key(e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
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

  /** Set the box from outside (tests, presets). */
  setBox(b) { this.box = b ? roundBox(b) : null; this.draw(); }

  draw() {
    const b = this.box && roundBox(this.box);
    this.boxEl.hidden = !b;
    this.saveBtn.disabled = !b || b.w < 1 || b.h < 1;
    if (!b) { this.posEl.textContent = ""; return; }
    const z = this.z;
    Object.assign(this.boxEl.style, { left: b.x * z + "px", top: b.y * z + "px", width: b.w * z + "px", height: b.h * z + "px" });
    this.posEl.textContent = `${b.x}, ${b.y}  ·  ${b.w} × ${b.h}`;
  }

  save() {
    if (!this.box) return;
    this.saveBtn.disabled = true;
    this.savedEl.textContent = "";
    this.emit("save", { rect: roundBox(this.box) });
  }
  /** Called by the app with the server's answer. */
  saved(image, created = true) {
    this.saveBtn.disabled = !this.box;
    this.savedEl.textContent = `${created ? "Saved" : "Already"} #${image.id} ${image.width}×${image.height}`;
    this.savedEl.classList.remove("err");
  }
  failed(msg) { this.saveBtn.disabled = !this.box; this.savedEl.textContent = msg; this.savedEl.classList.add("err"); }
}
