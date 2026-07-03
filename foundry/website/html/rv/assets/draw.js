// Shared free-draw canvas.
//
// Everyone (logged in or not) can draw. The client renders locally in
// real time; on pointerup we POST the stroke to /rv/api/draw/strokes.
// A polling loop pulls newly-committed strokes from other people and
// paints them locally. Strokes are stored server-side and replayed on
// page load so the canvas persists.

(function () {
  const CANVAS_URL = "/rv/api/draw/canvas";
  const STROKES_URL = "/rv/api/draw/strokes";
  const POLL_INTERVAL_MS = 3000;

  const canvas = document.getElementById("draw-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // Inject the red margin line + three hole punches into the wrap
  // as real DOM elements. Chosen over CSS pseudo-elements because
  // old iPad Safari has intermittent issues with `inset: 0` +
  // `::before/::after` on nested absolute containers; plain <div>s
  // are the safest thing you can hand it.
  const wrapEl = document.querySelector(".fun-tile-draw .draw-canvas-wrap");
  if (wrapEl && !wrapEl.querySelector(".draw-margin-line")) {
    const ml = document.createElement("div");
    ml.className = "draw-margin-line";
    wrapEl.insertBefore(ml, wrapEl.firstChild);
    for (const pos of ["top", "middle", "bottom"]) {
      const h = document.createElement("div");
      h.className = "draw-hole draw-hole-" + pos;
      wrapEl.insertBefore(h, wrapEl.firstChild);
    }
  }
  const statusEl = document.getElementById("draw-status");
  const colorInput = document.getElementById("draw-color");
  const eraserBtn = document.getElementById("draw-eraser");
  const radiusBtns = Array.from(document.querySelectorAll(".draw-radius"));

  // ----- State -----
  let W = 800, H = 300;              // logical canvas coordinate space (matches DB)
  let tool = "pen";                   // "pen" | "eraser"
  let color = colorInput.value;
  let radius = 1;
  let currentStroke = null;           // { tool, color, radius, points: [[x,y]...] }
  let sinceMs = 0;                    // cursor for polling
  let localAcked = new Set();         // stroke ids we already own — avoid double-paint on poll

  function setStatus(txt) {
    if (statusEl) statusEl.textContent = txt;
  }

  // ----- Init canvas backing store to match display size at DPR. The
  // logical coordinate space stays fixed at W×H so points are portable
  // between devices; we scale the render context to map logical → CSS
  // pixels × DPR. Returns true if the canvas has laid out (width>0),
  // false if it hasn't yet — the caller should retry once layout
  // completes. -----
  function resizeBacking() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return false;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    // Reset transform, then scale so a "1 unit" draw call = 1 CSS px
    // at the current viewport size × dpr.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale((rect.width * dpr) / W, (rect.height * dpr) / H);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return true;
  }

  // ----- Paint a single stroke onto the current context. Works for
  // both the live-drawing branch and the incremental repaint from
  // polling. -----
  function paintStroke(stroke) {
    if (!stroke || !stroke.points || !stroke.points.length) return;
    ctx.save();
    ctx.globalCompositeOperation =
      stroke.tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = stroke.color || "#000";
    ctx.fillStyle = stroke.color || "#000";
    ctx.lineWidth = Math.max(1, (stroke.radius || 6) * 2);
    const pts = stroke.points;
    if (pts.length === 1) {
      // Single tap = dot.
      ctx.beginPath();
      ctx.arc(pts[0][0], pts[0][1], stroke.radius || 6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i][0], pts[i][1]);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // ----- Pointer → logical coord conversion -----
  function pointerToLogical(evt) {
    const rect = canvas.getBoundingClientRect();
    const x = ((evt.clientX - rect.left) / rect.width) * W;
    const y = ((evt.clientY - rect.top) / rect.height) * H;
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  }

  // ----- Live draw handlers -----
  function beginStroke(evt) {
    if (evt.button != null && evt.button !== 0) return; // ignore right-click
    currentStroke = {
      tool,
      color: tool === "eraser" ? "#000" : color,
      radius,
      points: [pointerToLogical(evt)],
    };
    // Paint the first dot so a tap leaves a mark even without motion.
    paintStroke(currentStroke);
    canvas.setPointerCapture(evt.pointerId);
    evt.preventDefault();
  }
  function extendStroke(evt) {
    if (!currentStroke) return;
    const p = pointerToLogical(evt);
    const last = currentStroke.points[currentStroke.points.length - 1];
    // Skip duplicate points (mouse re-fires at same spot) — keeps the
    // committed JSON small enough for the 16 KB body cap.
    if (last[0] === p[0] && last[1] === p[1]) return;
    currentStroke.points.push(p);
    // Draw the last segment only (not the whole stroke) so we don't
    // burn CPU redrawing long strokes.
    ctx.save();
    ctx.globalCompositeOperation =
      currentStroke.tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = currentStroke.color;
    ctx.lineWidth = Math.max(1, currentStroke.radius * 2);
    ctx.beginPath();
    ctx.moveTo(last[0], last[1]);
    ctx.lineTo(p[0], p[1]);
    ctx.stroke();
    ctx.restore();
    evt.preventDefault();
  }
  async function endStroke(evt) {
    if (!currentStroke) return;
    const stroke = currentStroke;
    currentStroke = null;
    if (evt && canvas.hasPointerCapture(evt.pointerId)) {
      canvas.releasePointerCapture(evt.pointerId);
    }
    // Downsample very dense strokes so the JSON fits comfortably in
    // the 16 KB cap. Rule of thumb: ~500 points is plenty for anything
    // a mouse or finger would produce in one stroke.
    if (stroke.points.length > 500) {
      const step = Math.ceil(stroke.points.length / 500);
      stroke.points = stroke.points.filter((_, i) => i % step === 0 || i === stroke.points.length - 1);
    }
    setStatus("saving…");
    try {
      const r = await fetch(STROKES_URL, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stroke),
      });
      if (r.status === 429) {
        setStatus("slow down! (rate-limited)");
        return;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const created = await r.json();
      localAcked.add(created.id);
      if (created.created_at_ms > sinceMs) sinceMs = created.created_at_ms;
      setStatus("saved.");
      setTimeout(() => setStatus("live"), 900);
    } catch (err) {
      setStatus("save failed");
    }
  }

  // ----- Polling: pull strokes newer than sinceMs and paint any we
  // don't already own locally. -----
  async function pollStrokes() {
    try {
      const r = await fetch(STROKES_URL + "?since=" + sinceMs, { credentials: "include" });
      if (!r.ok) return;
      const data = await r.json();
      const strokes = data.strokes || [];
      for (const s of strokes) {
        if (s.created_at_ms > sinceMs) sinceMs = s.created_at_ms;
        // Keep the full history so device rotations / late layout
        // can repaint from cache. Idempotent on repeat ids.
        strokeHistory.set(s.id, s);
        if (localAcked.has(s.id)) {
          localAcked.delete(s.id); // GC
          continue;
        }
        // `stroke` is a JSON blob from JSONB — could be a string or a
        // parsed object depending on the driver's serialization. Handle
        // both.
        const payload = typeof s.stroke === "string" ? JSON.parse(s.stroke) : s.stroke;
        paintStroke(payload);
      }
    } catch (_) { /* silent — retry next tick */ }
  }

  // Cache of every stroke ever painted, keyed by id. Lets us repaint
  // the full history when the canvas resizes (device rotation, iPad
  // late-layout, etc.) without re-fetching from the server.
  const strokeHistory = new Map();

  function repaintAll() {
    if (!resizeBacking()) return;
    ctx.clearRect(0, 0, W, H);
    const sorted = Array.from(strokeHistory.values())
      .sort((a, b) => (a.created_at_ms || 0) - (b.created_at_ms || 0));
    for (const s of sorted) {
      const payload = typeof s.stroke === "string" ? JSON.parse(s.stroke) : s.stroke;
      paintStroke(payload);
    }
  }

  // ----- Initial load: fetch canvas metadata + full stroke history
  // and paint. Sets sinceMs to the timestamp of the last painted
  // stroke so the polling loop only fetches new work. -----
  async function initialLoad() {
    setStatus("loading…");
    try {
      const cRes = await fetch(CANVAS_URL, { credentials: "include" });
      if (cRes.ok) {
        const meta = await cRes.json();
        W = meta.width || W;
        H = meta.height || H;
        // Set aspect-ratio dynamically so it matches server config
        // (browsers that don't know aspect-ratio will ignore it and
        // fall back to the padding-top: 37.5% hack in CSS).
        canvas.parentElement.style.aspectRatio = `${W} / ${H}`;
      }
      const sRes = await fetch(STROKES_URL + "?since=0", { credentials: "include" });
      if (sRes.ok) {
        const data = await sRes.json();
        const strokes = data.strokes || [];
        for (const s of strokes) {
          if (s.created_at_ms > sinceMs) sinceMs = s.created_at_ms;
          strokeHistory.set(s.id, s);
        }
      }
      // Try to paint. If layout hasn't settled (iPad Safari sometimes
      // fires our script before the wrap has real dimensions), a
      // ResizeObserver picks up the first non-zero size and paints.
      if (!resizeBacking()) {
        const ro = new ResizeObserver((entries) => {
          for (const e of entries) {
            const cr = e.contentRect;
            if (cr.width >= 1 && cr.height >= 1) {
              ro.disconnect();
              repaintAll();
              break;
            }
          }
        });
        ro.observe(canvas.parentElement);
      } else {
        repaintAll();
      }
      setStatus("live");
    } catch (_) {
      setStatus("offline");
    }
  }

  // ----- Wire toolbar -----
  colorInput.addEventListener("input", (e) => {
    color = e.target.value;
    if (tool === "eraser") {
      // Picking a color implicitly switches back to pen.
      tool = "pen";
      eraserBtn.setAttribute("aria-pressed", "false");
    }
  });
  radiusBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      radiusBtns.forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      radius = Number(btn.dataset.radius) || 6;
    });
  });
  eraserBtn.addEventListener("click", () => {
    tool = tool === "eraser" ? "pen" : "eraser";
    eraserBtn.setAttribute("aria-pressed", tool === "eraser" ? "true" : "false");
  });

  // ----- Wire pointer events -----
  canvas.addEventListener("pointerdown", beginStroke);
  canvas.addEventListener("pointermove", extendStroke);
  canvas.addEventListener("pointerup", endStroke);
  canvas.addEventListener("pointercancel", endStroke);
  canvas.addEventListener("pointerleave", (e) => {
    // If the pointer leaves the canvas while a button is down, treat
    // it as a stroke-end. Without this, mobile Safari can leak an
    // in-progress stroke that never commits.
    if (currentStroke) endStroke(e);
  });

  // ----- Resize handling: on window resize (or iPad rotation) repaint
  // the whole board from the in-memory history. That's crisper than
  // blitting a bitmap snapshot and it's free since we already have
  // every stroke cached. -----
  let resizeTO = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTO);
    resizeTO = setTimeout(repaintAll, 150);
  });
  window.addEventListener("orientationchange", () => {
    clearTimeout(resizeTO);
    resizeTO = setTimeout(repaintAll, 200);
  });

  // ----- Kick off -----
  initialLoad().then(() => {
    setInterval(pollStrokes, POLL_INTERVAL_MS);
  });
})();
