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
    // Extrapolations could exceed maxGuess — include them in the bound.
    const lin = linearProjection(tripEndMs);
    const quad = quadraticProjection(tripEndMs);
    return Math.max(maxGuess, maxLog, lin || 0, quad || 0, 20) + 5;
  }

  function yForCount(count, yMax) {
    return M.top + PLOT_H * (1 - count / yMax);
  }

  // ----- Projection math -----
  //
  // Both projections treat the count as a function of *days since
  // trip start* so the units are intuitive. We anchor at the most
  // recent log so the curve visually continues from the data — a
  // straight line for the linear projection, a parabola for the
  // quadratic. The area between them fills as an "uncertainty cone."

  // Days-since-trip-start for a timestamp. Clamped ≥ 0 so pre-trip
  // logs don't yield negative "day 0."
  function daysSinceStart(ms) {
    return Math.max(0, (ms - tripStartMs) / MS_PER_DAY);
  }

  // Latest logged (day, count) — the anchor for both projections.
  function anchorPoint() {
    if (!logs.length) return null;
    const last = logs[logs.length - 1];
    return {
      t: parseDate(last.created_at).getTime(),
      d: daysSinceStart(parseDate(last.created_at).getTime()),
      c: last.count,
    };
  }

  // Linear = "constant rate" projection.
  //   rate = current_count / days_elapsed_at_last_log
  //   count(t) = current_count + rate * (days_from_last_log)
  // Returns the projected count at the given target timestamp, or
  // null if we don't have any data yet.
  function linearProjection(ms) {
    if (!logs.length) return null;
    const a = anchorPoint();
    if (a.d <= 0) return a.c; // pre-trip log — nothing to extrapolate from
    const rate = a.c / a.d;
    const targetDays = daysSinceStart(ms);
    return Math.max(0, a.c + rate * (targetDays - a.d));
  }

  // Quadratic = "with acceleration" projection.
  //   Fit count(d) = a·d² + b·d through the log points (least
  //   squares, zero intercept so d=0 gives count=0).
  //   Returns null if we don't have ≥2 logs (need at least two to
  //   distinguish curvature from a straight line).
  //
  // The zero-intercept form is what makes this natural for a
  // running counter: at trip start we've seen zero. It also keeps
  // the closed-form solve to a 2x2 system.
  function fitQuadratic() {
    if (logs.length < 2) return null;
    // Sample points: (d_i, c_i) for each log, plus (0, 0) at trip
    // start so the fit is grounded. The trip-start point helps a lot
    // when logs are sparse.
    const pts = [{ d: 0, c: 0 }];
    for (const l of logs) {
      pts.push({ d: daysSinceStart(parseDate(l.created_at).getTime()), c: l.count });
    }
    // Solve min Σ (a·d² + b·d − c)². Normal equations:
    //   [Σd⁴  Σd³] [a] = [Σd²·c]
    //   [Σd³  Σd²] [b]   [Σd·c ]
    let s2 = 0, s3 = 0, s4 = 0, sd2c = 0, sdc = 0;
    for (const { d, c } of pts) {
      const d2 = d * d;
      s2 += d2;
      s3 += d2 * d;
      s4 += d2 * d2;
      sd2c += d2 * c;
      sdc  += d  * c;
    }
    const det = s4 * s2 - s3 * s3;
    if (Math.abs(det) < 1e-9) return null; // degenerate (all logs at same day)
    const a = (sd2c * s2 - sdc * s3) / det;
    const b = (s4 * sdc - s3 * sd2c) / det;
    return { a, b };
  }

  function quadraticProjection(ms) {
    const fit = fitQuadratic();
    if (!fit) return null;
    const d = daysSinceStart(ms);
    return Math.max(0, fit.a * d * d + fit.b * d);
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

      // ----- Extrapolation: linear + quadratic + uncertainty band -----
      //
      // Both curves start at the LATEST logged point and run to trip
      // end. The linear line is the "constant rate" projection; the
      // quadratic is fit through all logs so acceleration / deceleration
      // shows as curvature. The area between them fills as an
      // "uncertainty cone" — the wider the band, the less confident
      // we should be about the trip-end total.
      //
      // Gated:
      //   0 logs  → no extrapolation (nothing to project from)
      //   1 log   → linear only (quadratic fit needs ≥2 real points)
      //   ≥2 logs → linear + quadratic + shaded band between them
      if (logs.length >= 1) {
        const lastPt = pts[pts.length - 1];
        const x0 = xForDate(lastPt.t);
        const y0 = yForCount(lastPt.c, yMax);

        // Sample the two projections at ~1-day steps from the latest
        // point through trip end. Store both as (x, yLinear, yQuad)
        // arrays for easy band drawing.
        const linSamples = [];
        const quadSamples = [];
        const fit = fitQuadratic();
        const stepMs = MS_PER_DAY / 2;
        for (let t = lastPt.t; t <= tripEndMs; t += stepMs) {
          const x = xForDate(t);
          const cLin = linearProjection(t);
          if (cLin != null) linSamples.push({ x, y: yForCount(Math.min(cLin, yMax * 1.1), yMax) });
          if (fit) {
            const cQuad = quadraticProjection(t);
            quadSamples.push({ x, y: yForCount(Math.min(cQuad, yMax * 1.1), yMax) });
          }
        }
        // Always include the trip-end sample exactly.
        {
          const x = xForDate(tripEndMs);
          const cLin = linearProjection(tripEndMs);
          if (cLin != null) linSamples.push({ x, y: yForCount(Math.min(cLin, yMax * 1.1), yMax) });
          if (fit) {
            const cQuad = quadraticProjection(tripEndMs);
            quadSamples.push({ x, y: yForCount(Math.min(cQuad, yMax * 1.1), yMax) });
          }
        }

        // Shaded uncertainty band between the two curves. Only if we
        // have both. Path = linear forward, then quadratic reverse.
        if (fit && linSamples.length && quadSamples.length) {
          const fwd = linSamples.map(p => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
          const rev = quadSamples.slice().reverse().map(p => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
          const bandD = `M ${x0.toFixed(1)} ${y0.toFixed(1)} ${fwd} ${rev} Z`;
          out += `<path d="${bandD}" fill="#FF6720" fill-opacity="0.13" stroke="none"/>`;
        }

        // Linear line — dotted.
        if (linSamples.length) {
          const linD = `M ${x0.toFixed(1)} ${y0.toFixed(1)} ` +
                       linSamples.map(p => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
          out += `<path d="${linD}" fill="none" stroke="#FF6720" stroke-opacity="0.6" stroke-width="2" stroke-dasharray="4,4"/>`;
        }

        // Quadratic curve — dashed, slightly heavier so the "with
        // acceleration" story reads.
        if (fit && quadSamples.length) {
          const quadD = `M ${x0.toFixed(1)} ${y0.toFixed(1)} ` +
                       quadSamples.map(p => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
          out += `<path d="${quadD}" fill="none" stroke="#DA1884" stroke-opacity="0.65" stroke-width="2" stroke-dasharray="2,3"/>`;
        }

        // End-of-trip label. Show both projected values if we have
        // both curves; else just the linear.
        const lin = linearProjection(tripEndMs);
        const quad = quadraticProjection(tripEndMs);
        const x1 = xForDate(tripEndMs);
        if (lin != null) {
          let label = `~${Math.round(lin)}`;
          if (quad != null) label = `${Math.round(Math.min(lin, quad))}–${Math.round(Math.max(lin, quad))}`;
          const yEnd = yForCount(Math.min(lin, yMax * 1.1), yMax);
          out += `<text x="${(x1 - 3).toFixed(1)}" y="${(yEnd - 4).toFixed(1)}" font-size="10" text-anchor="end" fill="#FF6720" font-weight="700" font-family="system-ui,sans-serif">${label}</text>`;
        }
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
