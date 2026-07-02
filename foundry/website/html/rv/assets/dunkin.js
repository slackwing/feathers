// Dunkin' Donuts sighting bet.
//
// Four participants each guessed a total count for the trip. The
// hero has a small DD button (logged-in users only) that increments
// the running count. The fun-section tile plots each log as a line
// segment on an X = time / Y = count chart, with the current count
// marked by the 🚐 emoji. Each participant's guess is drawn as a
// horizontal target line at their y-value with their avatar/initial
// pinned to the right axis. A dotted extrapolation from the latest
// log to the trip end helps see who's closest.
//
// Public read (anyone can see the chart). Auth POST to increment.

(function () {
  const API_URL = "/rv/api/dunkin";

  // ----- Trip constants (kept local — cheap enough to hard-code) -----
  const TRIP_START = "2026-07-05";
  const TRIP_END = "2026-07-22";

  // Participants — order controls y-axis avatar stacking priority when
  // labels collide. Avatars: real photos for Andrew + Abi, letter
  // circles for Hayoung + Keunwoo until we have photos.
  const PARTICIPANTS = [
    { id: "andrew",  name: "Andrew",  guess: 43, kind: "photo", src: "assets/photos/andrew-avatar.jpg", color: "#FF6720" },
    { id: "abi",     name: "Abi",    guess: 48, kind: "photo", src: "assets/photos/abi-avatar.jpg",     color: "#DA1884" },
    { id: "hayoung", name: "Hayoung", guess: 30, kind: "initial", initial: "H",                          color: "#4a7fa0" },
    { id: "keunwoo", name: "Keunwoo", guess: 85, kind: "initial", initial: "K",                          color: "#2f8a6e" },
  ];

  // ----- DOM refs -----
  const btn = document.getElementById("hero-dunkin-btn");
  const btnCount = document.getElementById("hero-dunkin-count");
  const badge = document.getElementById("dunkin-latest-badge");
  const svg = document.getElementById("dunkin-chart");
  if (!svg) return;

  // ----- Auth-driven button visibility -----
  function applyAuthUI() {
    if (!btn) return;
    btn.hidden = !window.rvAuthUser;
  }
  window.addEventListener("rv:auth-resolved", applyAuthUI);
  window.addEventListener("rv:auth-change", applyAuthUI);
  applyAuthUI();

  // ----- State -----
  let logs = [];  // [{id, count, note, user_id, created_at}, ...] server-sorted ASC

  // ----- Helpers -----
  const MS_PER_DAY = 24 * 3600 * 1000;

  function parseDate(iso) {
    return new Date(iso + (iso.length === 10 ? "T00:00:00Z" : ""));
  }
  const tripStartMs = parseDate(TRIP_START).getTime();
  const tripEndMs   = parseDate(TRIP_END).getTime();

  function fmtShortDate(dt) {
    const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${M[dt.getUTCMonth()]} ${dt.getUTCDate()}`;
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ----- Data fetch -----
  async function loadLogs() {
    try {
      const r = await fetch(API_URL, { credentials: "include" });
      if (!r.ok) return;
      const data = await r.json();
      logs = data.logs || [];
      updateBadge();
      updateHeaderCount();
      renderChart();
    } catch (_) {
      // Non-fatal — chart just stays empty.
    }
  }
  loadLogs();

  // ----- Header button click: increment -----
  if (btn) {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        const r = await fetch(API_URL, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        await loadLogs();
      } catch (err) {
        // Silent; user can retry.
      } finally {
        btn.disabled = false;
      }
    });
  }

  function currentCount() {
    return logs.length ? logs[logs.length - 1].count : 0;
  }
  function updateHeaderCount() {
    if (btnCount) btnCount.textContent = String(currentCount());
  }
  function updateBadge() {
    if (!badge) return;
    badge.textContent = `${currentCount()} so far`;
  }

  // ----- Chart rendering -----
  // Layout (in viewBox 400x260):
  //   left margin 34   right margin 44 (for avatars)
  //   top margin 14    bottom margin 30 (for x-axis dates)
  const M = { top: 14, right: 44, bottom: 30, left: 34 };
  const CHART_W = 400, CHART_H = 260;
  const PLOT_W = CHART_W - M.left - M.right;
  const PLOT_H = CHART_H - M.top - M.bottom;

  function xForDate(ms) {
    const clamped = Math.max(tripStartMs, Math.min(tripEndMs, ms));
    return M.left + PLOT_W * (clamped - tripStartMs) / (tripEndMs - tripStartMs);
  }

  function pickYMax() {
    const maxGuess = Math.max(...PARTICIPANTS.map(p => p.guess));
    const maxLog = currentCount();
    // Extrapolation could exceed maxGuess — include it in the bound.
    const extrap = extrapolationValue();
    return Math.max(maxGuess, maxLog, extrap || 0, 20) + 5;
  }

  function yForCount(count, yMax) {
    return M.top + PLOT_H * (1 - count / yMax);
  }

  function extrapolationValue() {
    // Linear extrapolation from the latest log to trip end using
    // avg-per-day-so-far × days-remaining, added to current count.
    if (!logs.length) return null;
    const first = parseDate(logs[0].created_at).getTime();
    const last  = parseDate(logs[logs.length - 1].created_at).getTime();
    // If all logs occurred before trip start, anchor at trip start.
    const anchor = Math.max(first, tripStartMs);
    const now = last;
    const daysSoFar = Math.max(1, (now - anchor) / MS_PER_DAY);
    const perDay = currentCount() / daysSoFar;
    const daysRemaining = Math.max(0, (tripEndMs - now) / MS_PER_DAY);
    return currentCount() + perDay * daysRemaining;
  }

  function renderChart() {
    const yMax = pickYMax();

    let out = "";

    // ----- Y-axis gridlines every ~20 units (light) -----
    const gridStep = yMax > 80 ? 20 : (yMax > 40 ? 10 : 5);
    for (let v = 0; v <= yMax; v += gridStep) {
      const y = yForCount(v, yMax);
      out += `<line x1="${M.left}" y1="${y.toFixed(1)}" x2="${M.left + PLOT_W}" y2="${y.toFixed(1)}" stroke="#eef1ef" stroke-width="1"/>`;
      out += `<text x="${(M.left - 4).toFixed(1)}" y="${(y + 3).toFixed(1)}" font-size="9" text-anchor="end" fill="#8a9a92" font-family="system-ui,sans-serif">${v}</text>`;
    }

    // ----- X-axis: trip date range with a few tick labels -----
    const tickCount = 5;
    for (let i = 0; i <= tickCount; i++) {
      const t = tripStartMs + (tripEndMs - tripStartMs) * (i / tickCount);
      const x = xForDate(t);
      const dt = new Date(t);
      out += `<line x1="${x.toFixed(1)}" y1="${M.top + PLOT_H}" x2="${x.toFixed(1)}" y2="${(M.top + PLOT_H + 4).toFixed(1)}" stroke="#8a9a92" stroke-width="1"/>`;
      out += `<text x="${x.toFixed(1)}" y="${(M.top + PLOT_H + 16).toFixed(1)}" font-size="9" text-anchor="middle" fill="#8a9a92" font-family="system-ui,sans-serif">${fmtShortDate(dt)}</text>`;
    }

    // ----- Participant guess target lines (each person's y-value) -----
    for (const p of PARTICIPANTS) {
      if (p.guess > yMax) continue;
      const y = yForCount(p.guess, yMax);
      out += `<line x1="${M.left}" y1="${y.toFixed(1)}" x2="${M.left + PLOT_W}" y2="${y.toFixed(1)}" stroke="${p.color}" stroke-opacity="0.45" stroke-width="1" stroke-dasharray="4,3"/>`;
    }

    // ----- Vertical "today" marker -----
    const nowMs = Date.now();
    if (nowMs >= tripStartMs && nowMs <= tripEndMs) {
      const x = xForDate(nowMs);
      out += `<line x1="${x.toFixed(1)}" y1="${M.top}" x2="${x.toFixed(1)}" y2="${M.top + PLOT_H}" stroke="#c9dfd2" stroke-width="1" stroke-dasharray="3,3"/>`;
      out += `<text x="${x.toFixed(1)}" y="${(M.top - 4).toFixed(1)}" font-size="9" text-anchor="middle" fill="#8a9a92" font-family="system-ui,sans-serif">today</text>`;
    }

    // ----- Data line + segments -----
    // Per the user's spec: no dots for historical points, just line
    // segments between logged timestamps. The LATEST point renders
    // as the 🚐 emoji so people see where we are right now.
    if (logs.length > 0) {
      // Anchor a zero-count point at the FIRST log's timestamp — no,
      // actually anchor at trip start (0, 0) so the line reads
      // naturally as "count over the trip so far."
      const pts = [];
      // Only include the trip-start anchor if the first log is inside
      // the trip window; otherwise the first log itself starts the line.
      const first = parseDate(logs[0].created_at).getTime();
      if (first >= tripStartMs) {
        pts.push({ t: tripStartMs, c: 0 });
      }
      for (const l of logs) {
        pts.push({ t: parseDate(l.created_at).getTime(), c: l.count });
      }
      const pathD = pts.map((p, i) => {
        const x = xForDate(p.t);
        const y = yForCount(p.c, yMax);
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(" ");
      out += `<path d="${pathD}" fill="none" stroke="#FF6720" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;

      // ----- Dotted extrapolation from latest point → trip end -----
      const extrap = extrapolationValue();
      if (extrap != null && logs.length >= 1) {
        const lastPt = pts[pts.length - 1];
        const x0 = xForDate(lastPt.t);
        const y0 = yForCount(lastPt.c, yMax);
        const x1 = xForDate(tripEndMs);
        const y1 = yForCount(Math.min(extrap, yMax * 1.1), yMax);
        out += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="#FF6720" stroke-opacity="0.5" stroke-width="2" stroke-dasharray="4,4"/>`;
        // Small label at the extrapolation end: "→ ~N"
        const label = `~${Math.round(extrap)}`;
        out += `<text x="${(x1 - 3).toFixed(1)}" y="${(y1 - 4).toFixed(1)}" font-size="10" text-anchor="end" fill="#FF6720" font-weight="700" font-family="system-ui,sans-serif">${label}</text>`;
      }

      // ----- Latest = 🚐 emoji -----
      const last = pts[pts.length - 1];
      const lx = xForDate(last.t);
      const ly = yForCount(last.c, yMax);
      out += `<text x="${lx.toFixed(1)}" y="${(ly + 6).toFixed(1)}" font-size="18" text-anchor="middle" style="user-select:none;">🚐</text>`;
    }

    // ----- Right-axis avatars at each guess -----
    // Dedupe avatars that overlap by nudging them apart vertically.
    // Simple pass: sort by y ascending; if a later one is closer than
    // 20px, push it down.
    const AV_R = 12;
    const avX = M.left + PLOT_W + 16;
    const placed = PARTICIPANTS
      .filter(p => p.guess <= yMax)
      .map(p => ({ p, y: yForCount(p.guess, yMax) }))
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < placed.length; i++) {
      if (placed[i].y - placed[i-1].y < 2 * AV_R + 1) {
        placed[i].y = placed[i-1].y + 2 * AV_R + 1;
      }
    }
    for (const { p, y } of placed) {
      const tip = `${p.name} guessed ${p.guess}`;
      out += `<g><title>${esc(tip)}</title>`;
      // Connector line from the guess-line's right end to the avatar.
      const guessY = yForCount(p.guess, yMax);
      out += `<line x1="${(M.left + PLOT_W).toFixed(1)}" y1="${guessY.toFixed(1)}" x2="${(avX - AV_R).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${p.color}" stroke-opacity="0.45" stroke-width="1"/>`;
      if (p.kind === "photo") {
        // Circular photo via clip-path.
        const clipId = `dunkin-clip-${p.id}`;
        out += `<defs><clipPath id="${clipId}"><circle cx="${avX}" cy="${y.toFixed(1)}" r="${AV_R}"/></clipPath></defs>`;
        out += `<image href="${esc(p.src)}" x="${(avX - AV_R).toFixed(1)}" y="${(y - AV_R).toFixed(1)}" width="${(AV_R * 2).toFixed(1)}" height="${(AV_R * 2).toFixed(1)}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>`;
        out += `<circle cx="${avX}" cy="${y.toFixed(1)}" r="${AV_R}" fill="none" stroke="${p.color}" stroke-width="2"/>`;
      } else {
        // Colored letter chip.
        out += `<circle cx="${avX}" cy="${y.toFixed(1)}" r="${AV_R}" fill="${p.color}" stroke="white" stroke-width="1.5"/>`;
        out += `<text x="${avX}" y="${(y + 4).toFixed(1)}" font-size="12" text-anchor="middle" fill="white" font-weight="800" font-family="system-ui,sans-serif">${p.initial}</text>`;
      }
      out += `</g>`;
    }

    svg.innerHTML = out;
  }

  // Re-render every minute so the "today" marker + "X ago" extrapolation
  // stay fresh without a page reload. Cheap; the chart is small.
  setInterval(() => { if (logs.length) renderChart(); }, 60 * 1000);
})();
