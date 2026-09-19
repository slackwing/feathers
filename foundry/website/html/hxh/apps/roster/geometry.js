/* Crop geometry — pure functions over a picture W×H and a box {x,y,w,h}
   in picture pixels. ratio = w/h to hold, 0 = free. Exported for tests. */
export const RATIOS = [["Free", 0], ["1:1", 1], ["2:3", 2 / 3], ["3:2", 3 / 2], ["4:5", 4 / 5], ["5:4", 5 / 4], ["16:9", 16 / 9], ["9:16", 9 / 16]];

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const roundBox = b => b && ({ x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) });

/** A box from an anchor corner towards a point, honouring the ratio and the picture's edges. */
export function fromAnchor(W, H, ratio, ax, ay, px, py) {
  const dx = px - ax, dy = py - ay;
  const sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
  let w = Math.abs(dx), h = Math.abs(dy);
  const maxW = sx > 0 ? W - ax : ax, maxH = sy > 0 ? H - ay : ay;
  if (ratio) {
    if (w / ratio >= h) h = w / ratio; else w = h * ratio;
    if (w > maxW) { w = maxW; h = w / ratio; }
    if (h > maxH) { h = maxH; w = h * ratio; }
  } else { w = Math.min(w, maxW); h = Math.min(h, maxH); }
  return { x: sx > 0 ? ax : ax - w, y: sy > 0 ? ay : ay - h, w, h };
}

/** The largest box of about (w,h), centred at (cx,cy), that fits the picture (and the ratio). */
export function fitAround(W, H, ratio, cx, cy, w, h) {
  w = Math.min(w, W); h = Math.min(h, H);
  if (ratio) { if (w / h > ratio) w = h * ratio; else h = w / ratio; }
  return { x: clamp(cx - w / 2, 0, W - w), y: clamp(cy - h / 2, 0, H - h), w, h };
}

/** Re-fit an existing box to a new ratio around its centre, shrinking as needed. */
export function refit(W, H, ratio, box) {
  if (!box || !ratio) return box;
  let w = box.w, h = w / ratio;
  if (h > box.h) { h = box.h; w = h * ratio; }
  return fitAround(W, H, ratio, box.x + box.w / 2, box.y + box.h / 2, w, h);
}

/** Move a box so its origin lands at (x,y), kept inside the picture. */
export function moveTo(W, H, box, x, y) {
  return { ...box, x: clamp(x, 0, W - box.w), y: clamp(y, 0, H - box.h) };
}

/** Resize by an edge or corner handle ("n","s","e","w","ne","nw","se","sw") dragged to (px,py). */
export function resize(W, H, ratio, start, dir, px, py) {
  const ax = dir.includes("w") ? start.x + start.w : start.x;
  const ay = dir.includes("n") ? start.y + start.h : start.y;
  if (dir.length === 2) return fromAnchor(W, H, ratio, ax, ay, px, py);
  if (dir === "e" || dir === "w") {
    let w = Math.abs(px - ax);
    if (ratio) {
      const cy = start.y + start.h / 2;
      let h = Math.min(w / ratio, H, 2 * cy, 2 * (H - cy));
      w = Math.min(h * ratio, dir === "e" ? W - ax : ax); h = w / ratio;
      return { x: dir === "e" ? ax : ax - w, y: cy - h / 2, w, h };
    }
    w = Math.min(w, dir === "e" ? W - ax : ax);
    return { ...start, x: dir === "e" ? ax : ax - w, w };
  }
  let h = Math.abs(py - ay);
  if (ratio) {
    const cx = start.x + start.w / 2;
    let w = Math.min(h * ratio, W, 2 * cx, 2 * (W - cx));
    h = Math.min(w / ratio, dir === "s" ? H - ay : ay); w = h * ratio;
    return { x: cx - w / 2, y: dir === "s" ? ay : ay - h, w, h };
  }
  h = Math.min(h, dir === "s" ? H - ay : ay);
  return { ...start, y: dir === "s" ? ay : ay - h, h };
}

/** Zoom to show a W×H picture inside cw×ch: never above 1. */
export const fitZoom = (W, H, cw, ch) => Math.min(1, cw / W, ch / H);

/** The canvas the crop window can afford on a vw×vh desktop, for a W×H
    picture: the window's chrome, toolbar and foot take ~200 px, the
    taskbar 45, and the window sits 24 px down. */
export function cropCanvas(W, H, vw, vh) {
  const cw = Math.max(320, Math.min(W, vw - 90)), ch = Math.max(240, Math.min(H, vh - 280));
  return { cw, ch };
}
