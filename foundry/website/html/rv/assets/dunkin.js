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
  // Trip officially starts the minute we land at SAN — Sun 2:27 PM PDT
  // (Pacific is UTC-7 in July). Seed rows filter out and the counter
  // resets to 0 at that instant.
  const TRIP_START = "2026-07-05T21:27:00Z";
  const TRIP_END = "2026-07-22";

  // Participants — order controls y-axis avatar stacking priority
  // when guesses collide. Default avatar is a colored letter chip
  // showing the first character of the name; add `src` to a
  // participant to use a photo instead.
  // Participants come from the DB (see /rv/api/dunkin/participants +
  // admin.html). Photos are keyed by id here since they're static
  // assets, not user data.
  const PARTICIPANT_PHOTOS = {
    andrew: "assets/photos/andrew-avatar.jpg",
    abi:    "assets/photos/abi-avatar.jpg",
  };
  let PARTICIPANTS = [];

  // ----- DOM refs -----
  const btn = document.getElementById("hero-dunkin-btn");
  const btnCount = document.getElementById("hero-dunkin-count");
  const badge = document.getElementById("dunkin-latest-badge");
  const svg = document.getElementById("dunkin-chart");
  const betCountEl = document.getElementById("dunkin-bet-count");
  if (!svg) return;

  // Fill in the "N bets" word — spelled out for small counts so the
  // blurb reads like prose. Falls back to the digit above 12. Runs
  // after loadParticipants() populates the array.
  const NUM_WORDS = ["Zero","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve"];
  function betCountWord(n) {
    return NUM_WORDS[n] != null ? NUM_WORDS[n] : String(n);
  }
  function updateBetCount() {
    if (betCountEl) betCountEl.textContent = betCountWord(PARTICIPANTS.length);
  }

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
  let seedMode = false; // true while the chart shows demo (is_seed) rows

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
  async function loadParticipants() {
    try {
      const r = await fetch(API_URL + "/participants", { credentials: "include" });
      if (!r.ok) return;
      const data = await r.json();
      PARTICIPANTS = (data.participants || []).map(p => ({
        ...p,
        src: PARTICIPANT_PHOTOS[p.id] || null,
      }));
    } catch (_) { /* keep whatever we had */ }
  }
  async function loadLogs() {
    try {
      await loadParticipants();
      const r = await fetch(API_URL, { credentials: "include" });
      if (!r.ok) return;
      const data = await r.json();
      const raw = data.logs || [];
      // Show seed rows only until a real (non-seed) row exists. As
      // soon as the first genuine sighting is logged — presumably
      // once the trip actually starts — the seed set drops off and
      // the chart resets to real data starting at 1.
      // Two conditions gate "real mode": at least one non-seed row
      // AND we've passed TRIP_START (Sun 2:27 PM PDT = 21:27 UTC).
      // The trip-start check means any stray pre-trip taps sitting
      // in the DB don't accidentally take down the sample chart —
      // seed rows keep showing until the trip actually begins.
      const nowMs = Date.now();
      const tripStarted = nowMs >= tripStartMs;
      const realLogs = raw.filter(l => !l.is_seed &&
        parseDate(l.created_at).getTime() >= tripStartMs);
      seedMode = !tripStarted || realLogs.length === 0;
      showSampleNote(seedMode);
      const active = seedMode ? raw.filter(l => l.is_seed) : realLogs;
      // Renumber to 1..N so the line starts at (tripStart, 0) →
      // (firstLog, 1). Server counts are historical bookkeeping;
      // the chart's y-axis is always "sightings in this active set."
      logs = active.map((l, i) => ({ ...l, count: i + 1 }));
      updateBetCount();
      updateBadge();
      updateHeaderCount();
      renderChart();
    } catch (_) {
      // Non-fatal — chart just stays empty.
    }
  }
  loadLogs();

  // Show/hide the "Showing sample chart" note based on whether the
  // chart is currently displaying seed rows.
  function showSampleNote(active) {
    const el = document.getElementById("dunkin-sample-note");
    if (el) el.hidden = !active;
  }

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
    badge.textContent = `${currentCount()} so far${seedMode ? "*" : ""}`;
  }

  // ----- Chart rendering -----
  // Layout (in viewBox 400x260):
  //   left margin 34   right margin 44 (for avatars)
  //   top margin 14    bottom margin 30 (for x-axis dates)
  // Right margin is intentionally wide so the connector lines from the
  // plot's right edge to each avatar have room to spread — when
  // multiple guesses cluster (e.g., low 40s to high 40s), the pins
  // stack tight but the connector lines fan out to their exact y.
  const M = { top: 14, right: 84, bottom: 30, left: 34 };
  const CHART_W = 400, CHART_H = 260;
  const PLOT_W = CHART_W - M.left - M.right;
  const PLOT_H = CHART_H - M.top - M.bottom;

  // X domain is the trip window (Jul 5 → Jul 22). Pre-trip clicks
  // still land in the DB but they clamp to the trip start visually —
  // by design; the chart is about "sightings during the trip."
  function xForDate(ms) {
    const clamped = Math.max(tripStartMs, Math.min(tripEndMs, ms));
    return M.left + PLOT_W * (clamped - tripStartMs) / (tripEndMs - tripStartMs);
  }

  // Round a raw value up to the next gridline. Grid step follows the
  // same rule renderChart uses so the axis top always lands on a
  // labeled tick — i.e. one tick above the highest guess.
  function chooseGridStep(rawMax) {
    if (rawMax > 80) return 20;
    if (rawMax > 40) return 10;
    return 5;
  }
  function pickYMax() {
    const maxGuess = Math.max(...PARTICIPANTS.map(p => p.guess));
    const maxLog = currentCount();
    // Extrapolations could exceed maxGuess — include them in the bound
    // when picking the step, so we don't clip the projected curve.
    const lin = linearProjection(tripEndMs);
    const quad = quadraticProjection(tripEndMs);
    const raw = Math.max(maxGuess, maxLog, lin || 0, quad || 0, 20);
    const step = chooseGridStep(raw);
    // One tick above the highest data point. If maxGuess is exactly on
    // a step boundary, still bump by one full step so the guess dashed
    // line has breathing room above it.
    return Math.ceil((raw + 1) / step) * step;
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

  // Power-law = "with acceleration or deceleration" projection.
  //   Fit count(d) = A · d^k where d = days since trip start.
  //     k = 1 → straight line (constant rate)
  //     k > 1 → accelerating (rate rising over time)
  //     0 < k < 1 → decelerating (rate slowing, still climbing)
  //   Because A > 0 and d > 0 give A·d^k > 0 monotonically, the
  //   projection is guaranteed non-decreasing — right shape for a
  //   running counter that can only go up or stay flat.
  //
  // Method: linear regression on the log-log points (log(d), log(c))
  //   log(c) = log(A) + k · log(d)
  //   → k = slope, log(A) = intercept.
  // Only points with d > 0 and c > 0 participate (log of 0 is
  // undefined). Needs ≥2 such points to fit both k and A.
  function fitPowerLaw() {
    const pts = [];
    for (const l of logs) {
      const d = daysSinceStart(parseDate(l.created_at).getTime());
      const c = l.count;
      if (d > 0 && c > 0) pts.push({ x: Math.log(d), y: Math.log(c) });
    }
    if (pts.length < 2) return null;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (const { x, y } of pts) {
      sx += x; sy += y; sxx += x * x; sxy += x * y;
    }
    const n = pts.length;
    const denom = n * sxx - sx * sx;
    if (Math.abs(denom) < 1e-9) return null; // degenerate (all logs same day)
    const k = (n * sxy - sx * sy) / denom;
    const logA = (sy - k * sx) / n;
    const A = Math.exp(logA);
    return { A, k };
  }

  // Kept the old name so callers don't have to change; the shape of
  // the returned curve is now a power law, not a parabola.
  function quadraticProjection(ms) {
    const fit = fitPowerLaw();
    if (!fit) return null;
    const d = daysSinceStart(ms);
    if (d <= 0) return 0;
    return Math.max(0, fit.A * Math.pow(d, fit.k));
  }
  function fitQuadratic() { return fitPowerLaw(); }

  function renderChart() {
    const yMax = pickYMax();

    let out = "";

    // ----- Y-axis gridlines every ~20 units (light) -----
    const gridStep = chooseGridStep(yMax);
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
        // arrays for easy band drawing. The power-law fit passes
        // through the origin but usually not exactly through the
        // latest point, so we ANCHOR its curve at (lastPt.t, lastPt.c)
        // by adding the offset (lastPt.c - quadAt(lastPt.t)) to every
        // sample. This keeps the drawn curve visually continuous with
        // the data line while preserving its shape (slope + curvature).
        const linSamples = [];
        const quadSamples = [];
        const fit = fitQuadratic();
        const quadAtLast = fit ? quadraticProjection(lastPt.t) : null;
        const quadOffset = quadAtLast != null ? (lastPt.c - quadAtLast) : 0;
        const stepMs = MS_PER_DAY / 2;
        for (let t = lastPt.t; t <= tripEndMs; t += stepMs) {
          const x = xForDate(t);
          const cLin = linearProjection(t);
          if (cLin != null) linSamples.push({ x, y: yForCount(Math.min(cLin, yMax * 1.1), yMax) });
          if (fit) {
            const cQuad = Math.max(lastPt.c, quadraticProjection(t) + quadOffset);
            quadSamples.push({ x, y: yForCount(Math.min(cQuad, yMax * 1.1), yMax) });
          }
        }
        // Always include the trip-end sample exactly.
        {
          const x = xForDate(tripEndMs);
          const cLin = linearProjection(tripEndMs);
          if (cLin != null) linSamples.push({ x, y: yForCount(Math.min(cLin, yMax * 1.1), yMax) });
          if (fit) {
            const cQuad = Math.max(lastPt.c, quadraticProjection(tripEndMs) + quadOffset);
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

      }

      // ----- Latest = 🍩 emoji -----
      const last = pts[pts.length - 1];
      const lx = xForDate(last.t);
      const ly = yForCount(last.c, yMax);
      out += `<text x="${lx.toFixed(1)}" y="${(ly + 6).toFixed(1)}" font-size="18" text-anchor="middle" style="user-select:none;">🍩</text>`;
    }

    // ----- Right-axis avatars at each guess -----
    // Dedupe avatars that overlap by nudging them apart vertically.
    // Simple pass: sort by y ascending; if a later one is closer than
    // 20px, push it down.
    const AV_R = 12;
    // Push the avatar column to the far right of the SVG so the space
    // between the plot edge (M.left + PLOT_W) and the avatar circles
    // is maximized — that's the room the connector lines get to fan
    // out toward each guess's exact y-value.
    const avX = CHART_W - AV_R - 4;
    const placed = PARTICIPANTS
      .filter(p => p.guess <= yMax)
      .map(p => ({ p, y: yForCount(p.guess, yMax) }))
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < placed.length; i++) {
      if (placed[i].y - placed[i-1].y < 2 * AV_R + 1) {
        placed[i].y = placed[i-1].y + 2 * AV_R + 1;
      }
    }
    // Avatars are wrapped in a group with class .dunkin-avatar; hover
    // (desktop) or tap (touch) toggles a name+guess label to the left.
    // <title> stays as a fallback for native platform tooltips.
    for (const { p, y } of placed) {
      const tip = `${p.name} guessed ${p.guess}`;
      out += `<g class="dunkin-avatar" data-avatar="${esc(p.id)}" tabindex="0" role="button" aria-label="${esc(tip)}"><title>${esc(tip)}</title>`;
      // Connector line from the guess-line's right end to the avatar.
      const guessY = yForCount(p.guess, yMax);
      out += `<line x1="${(M.left + PLOT_W).toFixed(1)}" y1="${guessY.toFixed(1)}" x2="${(avX - AV_R).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${p.color}" stroke-opacity="0.45" stroke-width="1"/>`;
      if (p.src) {
        // Circular photo via clip-path (opt-in via participant.src).
        const clipId = `dunkin-clip-${p.id}`;
        out += `<defs><clipPath id="${clipId}"><circle cx="${avX}" cy="${y.toFixed(1)}" r="${AV_R}"/></clipPath></defs>`;
        out += `<image href="${esc(p.src)}" x="${(avX - AV_R).toFixed(1)}" y="${(y - AV_R).toFixed(1)}" width="${(AV_R * 2).toFixed(1)}" height="${(AV_R * 2).toFixed(1)}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>`;
        out += `<circle cx="${avX}" cy="${y.toFixed(1)}" r="${AV_R}" fill="none" stroke="${p.color}" stroke-width="2"/>`;
      } else {
        // Default: first-letter chip in participant's color.
        const letter = (p.name || "?").charAt(0).toUpperCase();
        out += `<circle cx="${avX}" cy="${y.toFixed(1)}" r="${AV_R}" fill="${p.color}" stroke="white" stroke-width="1.5"/>`;
        out += `<text x="${avX}" y="${(y + 4).toFixed(1)}" font-size="12" text-anchor="middle" fill="white" font-weight="800" font-family="system-ui,sans-serif" style="pointer-events:none;">${esc(letter)}</text>`;
      }
      // Popover label — an SVG text with a background rect. Positioned
      // to the LEFT of the avatar (over the chart area) so it doesn't
      // fall off the tile's right edge. Hidden by default; the
      // .is-open toggle drives visibility via CSS.
      const label = `${p.name} · ${p.guess}`;
      const labelW = Math.max(60, label.length * 6.5 + 12);
      const labelH = 18;
      const labelX = avX - AV_R - 6 - labelW;   // right edge sits just left of avatar
      const labelY = y - labelH / 2;
      out += `<g class="dunkin-avatar-popover" pointer-events="none">`;
      out += `<rect x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}" width="${labelW.toFixed(1)}" height="${labelH}" rx="4" fill="${p.color}"/>`;
      out += `<text x="${(labelX + labelW / 2).toFixed(1)}" y="${(y + 4).toFixed(1)}" font-size="11" text-anchor="middle" fill="white" font-weight="700" font-family="system-ui,sans-serif">${esc(label)}</text>`;
      out += `</g>`;
      out += `</g>`;
    }

    svg.innerHTML = out;
    wireAvatarInteractions();
  }

  // Hover (mouse) or tap (touch) toggles a popover on each avatar. On
  // touch we also close whichever popover was previously open so only
  // one shows at a time. Runs after each renderChart() because
  // svg.innerHTML wipes the previous listeners.
  function wireAvatarInteractions() {
    const avatars = svg.querySelectorAll(".dunkin-avatar");
    function closeAll() {
      avatars.forEach(el => el.classList.remove("is-open"));
    }
    avatars.forEach(el => {
      el.addEventListener("mouseenter", () => el.classList.add("is-open"));
      el.addEventListener("mouseleave", () => el.classList.remove("is-open"));
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const wasOpen = el.classList.contains("is-open");
        closeAll();
        if (!wasOpen) el.classList.add("is-open");
      });
      // Keyboard access for the tabindex="0" chip.
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const wasOpen = el.classList.contains("is-open");
          closeAll();
          if (!wasOpen) el.classList.add("is-open");
        }
      });
    });
    // Tap outside → close all.
    document.addEventListener("click", closeAll, { once: true });
  }

  // Re-render every minute so the "today" marker + "X ago" extrapolation
  // stay fresh without a page reload. Cheap; the chart is small.
  setInterval(() => { if (logs.length) renderChart(); }, 60 * 1000);
})();
