/* Profile "runs" — the styled-text format for AIM-style profiles. A run
   is { t, b, i, u, font, size, color, bg }. It is OUR format, never
   HTML: rendering uses textContent plus an allowlisted style, so a
   profile can't carry markup. Mirrors internal/hxh/chat.go
   (NormalizeRuns) in hobby-server. */
export const LIMIT = 1024;
export const FONTS = {
  dot: '"DotGothic16", "Courier New", monospace',
  px: '"Press Start 2P", "Courier New", monospace',
  serif: 'Georgia, "Times New Roman", serif',
  sans: 'Verdana, Arial, sans-serif',
  mono: '"Courier New", Courier, monospace',
  cursive: '"Comic Sans MS", "Brush Script MT", cursive',
};
export const FONT_LABELS = { dot: "Dot", px: "Pixel", serif: "Serif", sans: "Sans", mono: "Mono", cursive: "Cursive" };
/* <font size="1..7"> → px, index 0 unused */
export const SIZES = [null, 10, 13, 16, 18, 24, 32, 48];
const HEX = /^#[0-9a-f]{6}$/i;
const MAX_RUNS = 500;

const fmtOf = r => `${r.b ? 1 : 0}${r.i ? 1 : 0}${r.u ? 1 : 0}|${r.font || ""}|${r.size || 0}|${r.color || ""}|${r.bg || ""}`;

/** Validate/clean runs the way the server does. Returns { runs, length, error }. */
export function normalizeRuns(input) {
  if (!Array.isArray(input)) return { runs: [], length: 0, error: "runs must be an array" };
  if (input.length > MAX_RUNS) return { runs: [], length: 0, error: `too many runs (max ${MAX_RUNS})` };
  const runs = [];
  let length = 0;
  for (const r of input) {
    if (!r || typeof r.t !== "string" || !r.t) continue;
    const out = { t: r.t };
    if (r.b) out.b = true;
    if (r.i) out.i = true;
    if (r.u) out.u = true;
    if (FONTS[r.font]) out.font = r.font;
    const size = Number(r.size) | 0;
    if (size >= 1 && size <= 7) out.size = size;
    if (HEX.test(r.color || "")) out.color = r.color.toLowerCase();
    if (HEX.test(r.bg || "")) out.bg = r.bg.toLowerCase();
    length += [...r.t].length;
    runs.push(out);
  }
  const error = length > LIMIT ? `profile is ${length} characters; the limit is ${LIMIT}` : null;
  return { runs: mergeRuns(runs), length, error };
}

export const textLength = runs => (runs || []).reduce((n, r) => n + [...(r.t || "")].length, 0);

/** Join neighbours with identical formatting. */
export function mergeRuns(runs) {
  const out = [];
  for (const r of runs) {
    const last = out[out.length - 1];
    if (last && fmtOf(last) === fmtOf(r)) last.t += r.t;
    else out.push({ ...r });
  }
  return out;
}

/** Style an element for a run (allowlisted properties only). */
export function applyRunStyle(el, r) {
  if (r.b) el.style.fontWeight = "bold";
  if (r.i) el.style.fontStyle = "italic";
  if (r.u) el.style.textDecoration = "underline";
  if (r.font && FONTS[r.font]) el.style.fontFamily = FONTS[r.font];
  if (r.size && SIZES[r.size]) el.style.fontSize = SIZES[r.size] + "px";
  if (r.color) el.style.color = r.color;
  if (r.bg) el.style.backgroundColor = r.bg;
}

/** Render runs into a fragment: one span per run, "\n" → <br>. Safe by construction. */
export function renderRuns(runs, doc = document) {
  const frag = doc.createDocumentFragment();
  for (const r of runs || []) {
    const span = doc.createElement("span");
    applyRunStyle(span, r);
    const lines = String(r.t).split("\n");
    lines.forEach((line, i) => {
      if (i) span.append(doc.createElement("br"));
      if (line) span.append(doc.createTextNode(line));
    });
    frag.append(span);
  }
  return frag;
}

/* ---------- reading runs back out of a contenteditable ---------- */

const BLOCKS = new Set(["DIV", "P", "LI", "H1", "H2", "H3", "H4", "BLOCKQUOTE", "PRE"]);

export function rgbToHex(s) {
  if (!s) return "";
  if (HEX.test(s)) return s.toLowerCase();
  const m = String(s).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return "";
  return "#" + [m[1], m[2], m[3]].map(n => Math.max(0, Math.min(255, +n)).toString(16).padStart(2, "0")).join("");
}

/** Font key for a font-family string (first family wins), or "". */
export function fontKey(family) {
  const first = String(family || "").split(",")[0].replace(/["']/g, "").trim().toLowerCase();
  if (!first) return "";
  for (const [key, list] of Object.entries(FONTS)) {
    if (list.split(",")[0].replace(/["']/g, "").trim().toLowerCase() === first) return key;
  }
  return "";
}

/** 1..7 for a font-size (px string, or a <font size> number), or 0. */
export function sizeKey(v) {
  if (v == null || v === "") return 0;
  const s = String(v).trim();
  if (/^\d$/.test(s)) return Math.min(7, Math.max(1, +s));
  const px = parseFloat(s);
  if (!px) return 0;
  let best = 0, dist = Infinity;
  for (let i = 1; i < SIZES.length; i++) {
    const d = Math.abs(SIZES[i] - px);
    if (d < dist) { dist = d; best = i; }
  }
  return best;
}

function formatFor(el, inherited) {
  const f = { ...inherited };
  const tag = el.tagName;
  const st = el.style || {};
  if (tag === "B" || tag === "STRONG" || /^(bold|[6-9]00)$/.test(st.fontWeight || "")) f.b = true;
  if (tag === "I" || tag === "EM" || st.fontStyle === "italic") f.i = true;
  if (tag === "U" || /underline/.test(st.textDecoration || st.textDecorationLine || "")) f.u = true;
  if (tag === "FONT") {
    const face = el.getAttribute("face"), size = el.getAttribute("size"), color = el.getAttribute("color");
    if (face) { const k = fontKey(face); if (k) f.font = k; }
    if (size) { const k = sizeKey(size); if (k) f.size = k; }
    if (color) { const h = rgbToHex(color); if (h) f.color = h; }
  }
  if (st.fontFamily) { const k = fontKey(st.fontFamily); if (k) f.font = k; }
  if (st.fontSize) { const k = sizeKey(st.fontSize); if (k) f.size = k; }
  if (st.color) { const h = rgbToHex(st.color); if (h) f.color = h; }
  if (st.backgroundColor) { const h = rgbToHex(st.backgroundColor); if (h) f.bg = h; }
  return f;
}

/** Walk an edited DOM and produce runs (blocks and <br> become "\n"). */
export function runsFromNode(root) {
  const runs = [];
  const push = (t, f) => { if (t) runs.push({ t, ...f }); };
  const walk = (node, f) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) { push(child.nodeValue.replace(/ /g, " "), f); continue; }
      if (child.nodeType !== 1) continue;
      if (child.tagName === "BR") { push("\n", f); continue; }
      const cf = formatFor(child, f);
      const block = BLOCKS.has(child.tagName);
      if (block && runs.length && !runs[runs.length - 1].t.endsWith("\n")) push("\n", f);
      walk(child, cf);
      if (block && runs.length && !runs[runs.length - 1].t.endsWith("\n")) push("\n", f);
    }
  };
  walk(root, {});
  const merged = mergeRuns(runs);
  // trim a trailing newline left by the editor's last block
  const last = merged[merged.length - 1];
  if (last && last.t.endsWith("\n")) { last.t = last.t.replace(/\n+$/, ""); if (!last.t) merged.pop(); }
  return normalizeRuns(merged).runs;
}
