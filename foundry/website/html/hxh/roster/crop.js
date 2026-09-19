/* Crop tool. Shows image ?image=ID at native resolution (or fitted), lets
   you draw / move / resize one crop box — freeform or locked to a ratio —
   and POSTs the box to the server, which cuts the exact source pixels
   into a new "cropped" image of the same character. */
(() => {
  const API = "/hxh/api/db";
  const $ = s => document.querySelector(s);
  const id = +new URLSearchParams(location.search).get("image");
  const RATIOS = [["Free", 0], ["1:1", 1], ["2:3", 2 / 3], ["3:2", 3 / 2], ["4:5", 4 / 5], ["5:4", 5 / 4], ["16:9", 16 / 9], ["9:16", 9 / 16]];
  const st = { W: 0, H: 0, z: 1, fit: false, ratio: 0, box: null, meta: null };
  try { st.fit = localStorage.getItem("crop.fit") === "1"; st.ratio = +localStorage.getItem("crop.ratio") || 0; } catch {}

  const img = $("#img"), wrap = $("#wrap"), box = $("#box"), stage = $("#stage");
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round = b => ({ x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) });

  async function load() {
    if (!id) { $("#err").textContent = "No image."; return; }
    const r = await fetch(`${API}/images/${id}/meta`, { credentials: "same-origin" });
    if (r.status === 401 || r.status === 403) { $("#denied").classList.remove("hidden"); return; }
    if (!r.ok) { $("#err").textContent = "Cannot load #" + id + "."; return; }
    st.meta = await r.json();
    const im = st.meta.image, c = st.meta.char;
    document.title = `#${im.id} · ${c.name} · Crop`;
    $("#title").innerHTML = `${esc(c.name)} <span class="dim">#${im.id} · ${im.type} · ${im.width}×${im.height}</span>`;
    wrap.classList.toggle("pixel", im.type === "pixelated" || im.type === "transparent");
    img.onload = () => {
      st.W = img.naturalWidth; st.H = img.naturalHeight;
      wrap.hidden = false;
      layout();
    };
    img.src = `${API}/images/${id}`;
  }
  const esc = s => String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

  function layout() {
    const avail = { w: stage.clientWidth - 2, h: stage.clientHeight - 2 };
    st.z = st.fit ? Math.min(1, avail.w / st.W, avail.h / st.H) : 1;
    wrap.style.width = st.W * st.z + "px";
    wrap.style.height = st.H * st.z + "px";
    $("#fit").classList.toggle("on", st.fit);
    $("#fit").textContent = st.fit ? `Fit ${Math.round(st.z * 100)}%` : "Fit";
    drawBox();
  }
  window.addEventListener("resize", () => { if (st.fit) layout(); });
  $("#fit").addEventListener("click", () => { st.fit = !st.fit; try { localStorage.setItem("crop.fit", st.fit ? "1" : "0"); } catch {} layout(); });

  $("#ratios").innerHTML = RATIOS.map(([l, r]) => `<button type="button" data-r="${r}">${l}</button>`).join("");
  function markRatio() {
    for (const b of $("#ratios").children) b.classList.toggle("on", +b.dataset.r === st.ratio);
  }
  $("#ratios").addEventListener("click", e => {
    const b = e.target.closest("[data-r]");
    if (!b) return;
    st.ratio = +b.dataset.r;
    try { localStorage.setItem("crop.ratio", String(st.ratio)); } catch {}
    markRatio();
    if (st.box && st.ratio) {
      // keep the centre, refit to the new ratio at the largest size that fits
      const cx = st.box.x + st.box.w / 2, cy = st.box.y + st.box.h / 2;
      let w = st.box.w, h = w / st.ratio;
      if (h > st.box.h) { h = st.box.h; w = h * st.ratio; }
      st.box = fitAround(cx, cy, w, h);
      drawBox();
    }
  });
  markRatio();

  // largest box of size (w,h) centred at (cx,cy) that stays inside the picture
  function fitAround(cx, cy, w, h) {
    w = Math.min(w, st.W); h = Math.min(h, st.H);
    if (st.ratio) { if (w / h > st.ratio) w = h * st.ratio; else h = w / st.ratio; }
    const x = clamp(cx - w / 2, 0, st.W - w), y = clamp(cy - h / 2, 0, st.H - h);
    return { x, y, w, h };
  }

  function drawBox() {
    if (!st.box) { box.hidden = true; $("#readout").textContent = ""; $("#save").disabled = true; return; }
    const b = round(st.box), z = st.z;
    box.hidden = false;
    box.style.left = b.x * z + "px"; box.style.top = b.y * z + "px";
    box.style.width = b.w * z + "px"; box.style.height = b.h * z + "px";
    $("#readout").textContent = `${b.x}, ${b.y}  ·  ${b.w} × ${b.h}  ·  ${(b.w / b.h).toFixed(3)}`;
    $("#save").disabled = b.w < 1 || b.h < 1;
  }

  // ---- pointer interaction ----
  let drag = null;
  const pt = e => {
    const r = wrap.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / st.z, 0, st.W), y: clamp((e.clientY - r.top) / st.z, 0, st.H) };
  };
  // a box from an anchor corner towards a point, honouring the ratio and the edges
  function fromAnchor(ax, ay, px, py) {
    let dx = px - ax, dy = py - ay;
    const sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
    let w = Math.abs(dx), h = Math.abs(dy);
    const maxW = sx > 0 ? st.W - ax : ax, maxH = sy > 0 ? st.H - ay : ay;
    if (st.ratio) {
      if (w / st.ratio >= h) h = w / st.ratio; else w = h * st.ratio;
      if (w > maxW) { w = maxW; h = w / st.ratio; }
      if (h > maxH) { h = maxH; w = h * st.ratio; }
    } else { w = Math.min(w, maxW); h = Math.min(h, maxH); }
    return { x: sx > 0 ? ax : ax - w, y: sy > 0 ? ay : ay - h, w, h };
  }
  wrap.addEventListener("pointerdown", e => {
    if (e.button !== 0) return;
    e.preventDefault();
    wrap.setPointerCapture(e.pointerId);
    const p = pt(e), h = e.target.closest(".h");
    if (h && st.box) {
      const b = st.box, d = h.dataset.h;
      // anchor = the side/corner opposite the handle
      drag = { kind: "resize", d, ax: d.includes("w") ? b.x + b.w : b.x, ay: d.includes("n") ? b.y + b.h : b.y, start: { ...b } };
    } else if (e.target === box || e.target.closest("#box")) {
      drag = { kind: "move", ox: p.x - st.box.x, oy: p.y - st.box.y };
    } else {
      drag = { kind: "draw", ax: p.x, ay: p.y };
      st.box = null; drawBox();
    }
  });
  wrap.addEventListener("pointermove", e => {
    if (!drag) return;
    const p = pt(e);
    if (drag.kind === "draw") {
      st.box = fromAnchor(drag.ax, drag.ay, p.x, p.y);
    } else if (drag.kind === "move") {
      st.box = { ...st.box, x: clamp(p.x - drag.ox, 0, st.W - st.box.w), y: clamp(p.y - drag.oy, 0, st.H - st.box.h) };
    } else if (drag.kind === "resize") {
      const { d, ax, ay, start } = drag;
      const corner = d.length === 2;
      if (corner) {
        st.box = fromAnchor(ax, ay, p.x, p.y);
      } else if (d === "e" || d === "w") {
        let w = Math.abs(p.x - ax);
        if (st.ratio) {
          let h = w / st.ratio;
          const cy = start.y + start.h / 2;
          h = Math.min(h, st.H, 2 * cy, 2 * (st.H - cy)); w = h * st.ratio;
          w = Math.min(w, d === "e" ? st.W - ax : ax); h = w / st.ratio;
          st.box = { x: d === "e" ? ax : ax - w, y: cy - h / 2, w, h };
        } else {
          w = Math.min(w, d === "e" ? st.W - ax : ax);
          st.box = { ...start, x: d === "e" ? ax : ax - w, w };
        }
      } else {
        let h = Math.abs(p.y - ay);
        if (st.ratio) {
          let w = h * st.ratio;
          const cx = start.x + start.w / 2;
          w = Math.min(w, st.W, 2 * cx, 2 * (st.W - cx)); h = w / st.ratio;
          h = Math.min(h, d === "s" ? st.H - ay : ay); w = h * st.ratio;
          st.box = { x: cx - w / 2, y: d === "s" ? ay : ay - h, w, h };
        } else {
          h = Math.min(h, d === "s" ? st.H - ay : ay);
          st.box = { ...start, y: d === "s" ? ay : ay - h, h };
        }
      }
    }
    drawBox();
  });
  const end = () => {
    if (!drag) return;
    drag = null;
    if (st.box && (st.box.w < 1 || st.box.h < 1)) st.box = null;
    if (st.box) st.box = round(st.box);
    drawBox();
  };
  wrap.addEventListener("pointerup", end);
  wrap.addEventListener("pointercancel", end);

  document.addEventListener("keydown", e => {
    if (e.target.tagName === "INPUT") return;
    if (e.key === "Escape") { st.box = null; drawBox(); return; }
    if (e.key === "Enter" && st.box) { save(); return; }
    if (!st.box || !/^Arrow/.test(e.key)) return;
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1, b = st.box;
    const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
    const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
    st.box = { ...b, x: clamp(b.x + dx, 0, st.W - b.w), y: clamp(b.y + dy, 0, st.H - b.h) };
    drawBox();
  });

  async function save() {
    if (!st.box) return;
    const b = round(st.box);
    $("#save").disabled = true; $("#err").textContent = ""; $("#saved").textContent = "";
    try {
      const r = await fetch(`${API}/images/${id}/crop`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || r.statusText);
      const im = body.image;
      $("#saved").innerHTML = `${body.created ? "Saved" : "Already saved as"} <b>#${im.id}</b> ${im.width}×${im.height}<a href="${API}/images/${im.id}" target="_blank">open</a>`;
      $("#saved").className = "msg ok";
      new BroadcastChannel("hxh-roster").postMessage({ kind: "image", char_id: im.char_id, image_id: im.id });
    } catch (err) { $("#err").textContent = err.message; }
    $("#save").disabled = false;
  }
  $("#save").addEventListener("click", save);

  load();
})();
