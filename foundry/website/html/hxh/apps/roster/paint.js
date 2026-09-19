/* PaintDoc — the picture being edited, with undo / redo done the simple
   way: a list of whole states (width, height, pixels) and a cursor.
   Every operation (a brush stroke, a bucket fill, a canvas expansion, a
   revert) ends with `commit()`, which snapshots the canvas as the next
   state; undo and redo just move the cursor and restore. `clean` marks
   the state that matches what is stored, so `dirty` is "cursor ≠
   clean". Nothing here knows about zoom or the window. */
export const HISTORY = 15;

export class PaintDoc {
  /** canvas: the <canvas>; onChange(doc) after any state change */
  constructor({ canvas, width, height, depth = HISTORY, onChange = null }) {
    this.canvas = canvas;
    this.canvas.width = width; this.canvas.height = height;
    this.ctx = canvas.getContext?.("2d") || null;
    this.W = width; this.H = height;
    this.depth = depth;
    this.onChange = onChange;
    this.states = [];      // [{ w, h, data: ImageData }]
    this.pos = -1;
    this.clean = -1;
    this.source = null;
    this.stroking = false;
  }

  get dirty() { return this.pos !== this.clean; }
  get canUndo() { return this.pos > 0; }
  get canRedo() { return this.pos < this.states.length - 1; }

  /** Draw the stored picture and make that state 0, the clean one. */
  load(img) {
    this.source = img;
    if (this.ctx) { this.ctx.clearRect(0, 0, this.W, this.H); this.ctx.drawImage(img, 0, 0, this.W, this.H); }
    this.states = []; this.pos = -1;
    this.commit({ clean: true });
  }

  snapshot() {
    return { w: this.W, h: this.H, data: this.ctx ? this.ctx.getImageData(0, 0, this.W, this.H) : null };
  }

  /** Record the canvas as the next state (dropping any redo future); clean marks it as what is stored. */
  commit({ clean = false } = {}) {
    this.states.length = this.pos + 1;
    this.states.push(this.snapshot());
    this.pos = this.states.length - 1;
    if (clean) this.clean = this.pos;
    while (this.states.length > this.depth + 1) { this.states.shift(); this.pos--; this.clean--; }
    this.changed();
  }

  restore(st) {
    this.W = st.w; this.H = st.h;
    this.canvas.width = st.w; this.canvas.height = st.h;
    if (this.ctx && st.data) this.ctx.putImageData(st.data, 0, 0);
  }
  undo() { if (!this.canUndo) return false; this.restore(this.states[--this.pos]); this.changed(); return true; }
  redo() { if (!this.canRedo) return false; this.restore(this.states[++this.pos]); this.changed(); return true; }
  /** Back to the stored picture — as a new state, so it can be undone. */
  revert() {
    if (!this.source) return false;
    const st = this.states[0];
    this.restore({ w: st?.w ?? this.W, h: st?.h ?? this.H, data: null });
    if (this.ctx) { this.ctx.clearRect(0, 0, this.W, this.H); this.ctx.drawImage(this.source, 0, 0, this.W, this.H); }
    this.commit({ clean: true });
    return true;
  }
  changed() { this.onChange?.(this); }

  /* ---------- operations ---------- */
  /** A stroke: dots and segments between pointer events, committed once at the end. */
  beginStroke(p, color, radius) {
    this.stroking = true;
    this.dot(p, color, radius);
  }
  dot(p, color, radius) {
    const c = this.ctx;
    if (!c) return;
    c.fillStyle = color;
    c.beginPath(); c.arc(p.x, p.y, radius, 0, Math.PI * 2); c.fill();
  }
  segment(a, b, color, radius) {
    const c = this.ctx;
    if (!c) return;
    c.strokeStyle = color; c.lineWidth = radius * 2; c.lineCap = "round"; c.lineJoin = "round";
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
  }
  endStroke() {
    if (!this.stroking) return;
    this.stroking = false;
    this.commit();
  }

  /** The colour under a point, as #rrggbb. */
  pick(p) {
    if (!this.ctx) return null;
    const d = this.ctx.getImageData(Math.min(this.W - 1, Math.max(0, Math.floor(p.x))), Math.min(this.H - 1, Math.max(0, Math.floor(p.y))), 1, 1).data;
    return "#" + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, "0")).join("");
  }

  /** Bucket: every pixel connected to (x,y) with EXACTLY its colour takes `color`. */
  fill(p, color) {
    const c = this.ctx;
    if (!c) return false;
    const x = Math.floor(p.x), y = Math.floor(p.y), W = this.W, H = this.H;
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const img = c.getImageData(0, 0, W, H);
    const d = new Uint32Array(img.data.buffer);
    const target = d[y * W + x], repl = packRGBA(color);
    if (target === repl) return false;
    const stack = [y * W + x];
    while (stack.length) {
      let i = stack.pop();
      if (d[i] !== target) continue;
      let l = i, r = i;
      while (l % W > 0 && d[l - 1] === target) l--;
      while (r % W < W - 1 && d[r + 1] === target) r++;
      for (let j = l; j <= r; j++) {
        d[j] = repl;
        if (j >= W && d[j - W] === target) stack.push(j - W);
        if (j + W < W * H && d[j + W] === target) stack.push(j + W);
      }
    }
    c.putImageData(img, 0, 0);
    this.commit();
    return true;
  }

  /** Add `px` of white canvas on every side. */
  expand(px = 20) {
    const c = this.ctx;
    const w2 = this.W + 2 * px, h2 = this.H + 2 * px;
    if (c) {
      const keep = c.getImageData(0, 0, this.W, this.H);
      this.canvas.width = w2; this.canvas.height = h2;
      c.fillStyle = "#ffffff"; c.fillRect(0, 0, w2, h2);
      c.putImageData(keep, px, px);
    } else { this.canvas.width = w2; this.canvas.height = h2; }
    this.W = w2; this.H = h2;
    this.commit();
    return { w: w2, h: h2 };
  }
}

/** #rrggbb → the Uint32 a canvas pixel holds on this machine (RGBA bytes in memory order). */
export function packRGBA(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const buf = new Uint8ClampedArray([r, g, b, 255]);
  return new Uint32Array(buf.buffer)[0];
}
