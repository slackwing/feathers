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
  // Trip officially starts when we leave for JFK — Sun 8 AM ET
  // (Eastern is UTC-4 in July). Bets lock and the counter resets to
  // 0 at that instant; seed rows filter out and any real clicks
  // logged after that timestamp become the live chart.
  const TRIP_START = "2026-07-05T12:00:00Z";
  // End of day July 22 EASTERN (UTC-4). The old bare "2026-07-22"
  // parsed as midnight UTC = 8 PM ET on July 21, so the chart's x-axis
  // and every projection ended almost a day before the trip does.
  const TRIP_END = "2026-07-23T04:00:00Z";

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
    // Label in EASTERN (UTC-4 in July, like every other hard-coded ET
    // assumption in this file) so the trip-end tick reads "Jul 22",
    // not the UTC-rollover "Jul 23".
    const et = new Date(dt.getTime() - 4 * 3600 * 1000);
    return `${M[et.getUTCMonth()]} ${et.getUTCDate()}`;
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
  // Confirm before posting — a stray thumb tap on the donut button
  // otherwise silently commits a real sighting to the DB.
  if (btn) {
    btn.addEventListener("click", async () => {
      const next = currentCount() + 1;
      if (!window.confirm(`Log a Dunkin' sighting? Count will go to ${next}.`)) return;
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
        // Loud failure — a swallowed error here means the user walks
        // away believing the sighting counted when it didn't.
        alert(`Dunkin' log failed (${err.message}). Not counted — try again.`);
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
  const CHART_W = 400, CHART_H = 468;
  const PLOT_W = CHART_W - M.left - M.right;
  const PLOT_H = CHART_H - M.top - M.bottom;

  // X domain is the trip window (Jul 5 → Jul 22). Pre-trip clicks
  // still land in the DB but they clamp to the trip start visually —
  // by design; the chart is about "sightings during the trip."
  function xForDate(ms) {
    const clamped = Math.max(tripStartMs, Math.min(tripEndMs, ms));
    return M.left + PLOT_W * (clamped - tripStartMs) / (tripEndMs - tripStartMs);
  }

  // Round a raw value up to the next gridline. Aims for ~6 labels
  // regardless of range using a standard 1-2-5 tick sequence — the
  // same logic Matplotlib / D3 use, so tick spacing stays visually
  // even whether we're at 30 sightings or 3000.
  function chooseGridStep(rawMax) {
    const targetTicks = 6;
    const rough = Math.max(1, rawMax) / targetTicks;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
    const norm = rough / magnitude;
    let mult;
    if (norm < 1.5) mult = 1;
    else if (norm < 3.5) mult = 2;
    else if (norm < 7.5) mult = 5;
    else mult = 10;
    return mult * magnitude;
  }
  function pickYMax() {
    const maxGuess = Math.max(...PARTICIPANTS.map(p => p.guess));
    const maxLog = currentCount();
    // Extrapolations count toward the ceiling but are capped at 2×
    // the highest guess. Early data can produce runaway projections
    // (3 clicks in 30 minutes → thousands over the trip) and letting
    // that drive the axis makes every guess line squash to the bottom.
    // Capping means the projection line may clip near the top when
    // wild, which is fine — the label at the end tells the real story.
    const projCap = maxGuess * 2;
    const lin = Math.min(linearProjection(tripEndMs) || 0, projCap);
    const quad = Math.min(quadraticProjection(tripEndMs) || 0, projCap);
    const raw = Math.max(maxGuess, maxLog, lin, quad, 20);
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

  // Anchor for both projections. Placed at (NOW, current_count) once
  // the trip has started so the forecast — and the donut emoji — move
  // forward every render, treating "we've now gone X hours without a
  // sighting" as real information. Pre-trip we fall back to the last
  // logged point since there's no meaningful "now" in the trip window.
  function anchorPoint() {
    if (!logs.length) return null;
    const last = logs[logs.length - 1];
    const lastT = parseDate(last.created_at).getTime();
    const nowMs = Date.now();
    // Use NOW as the anchor if we're inside the trip window AND now is
    // after the latest log. Otherwise the last log stays authoritative.
    const useNow = nowMs >= tripStartMs && nowMs >= lastT;
    const t = useNow ? Math.min(nowMs, tripEndMs) : lastT;
    return {
      t,
      d: daysSinceStart(t),
      c: last.count,
    };
  }

  // We only project once we have MIN_LOGS_FOR_PROJECTION points. With
  // fewer than that, early clicks (esp. clumped ones on day 1) produce
  // wild rates that make the projection lines meaningless — a single
  // click 30 minutes into a 17-day trip extrapolates to thousands.
  // Better to show no lines until there's enough spread to say
  // anything useful.
  const MIN_LOGS_FOR_PROJECTION = 5;

  // Linear = "constant rate" projection.
  //   rate = current_count / days_elapsed_at_last_log
  //   count(t) = current_count + rate * (days_from_last_log)
  // Returns the projected count at the given target timestamp, or
  // null if we don't have enough data to draw a meaningful line.
  function linearProjection(ms) {
    if (logs.length < MIN_LOGS_FOR_PROJECTION) return null;
    const a = anchorPoint();
    if (a.d <= 0) return a.c;
    const rate = a.c / a.d;
    const targetDays = daysSinceStart(ms);
    return Math.max(0, a.c + rate * (targetDays - a.d));
  }

  // Rolling rate + acceleration — the "two kernels" model.
  //
  // The old approach (weighted quadratic least squares through the last
  // log) structurally could NOT see a same-day burst: points from the
  // last few hours sit at u ≈ 0 where the u² term has no leverage, so
  // three donuts in an afternoon left accel unmoved. And every attempt
  // to tune its τ traded one failure for another (τ=1 collapsed after
  // multi-day gaps; τ=5 was numb to bursts).
  //
  // Instead we now estimate the sighting RATE directly with causal
  // exponential-kernel intensity estimates (standard point-process
  // tooling), evaluated at NOW:
  //
  //   rate(τ) = Σᵢ exp(−(now − tᵢ)/τ) / τ      over logs tᵢ ≤ now
  //
  // computed at two timescales:
  //   fast (τ_f): "how hot are the last several hours?"
  //   slow (τ_s): "what's the multi-day trend?"
  //
  // Then:
  //   rate  = rate(τ_s)                        — the trend carries the curve
  //   accel = (rate(τ_f) − rate(τ_s)) / (τ_s − τ_f)
  //           — a burst hotter than trend bends it up; a lull (fast
  //             kernel decaying with no events) bends it down.
  //
  // No phantom point needed: the kernels decay on their own as time
  // passes without sightings, so "we've gone all day without one" is
  // felt automatically.
  const RATE_TAU_FAST = 0.75;  // days — burst kernel
  const RATE_TAU_SLOW = 3.0;   // days — trend kernel
  function kernelRate(tau, nowDays) {
    let s = 0;
    for (const l of logs) {
      const lag = nowDays - daysSinceStart(parseDate(l.created_at).getTime());
      if (lag < 0) continue;
      s += Math.exp(-lag / tau);
    }
    return s / tau;
  }
  function fitRollingRate() {
    if (logs.length < MIN_LOGS_FOR_PROJECTION) return null;
    const lastLog = logs[logs.length - 1];
    const d0 = daysSinceStart(parseDate(lastLog.created_at).getTime());
    const c0 = lastLog.count;
    // Rates are evaluated at NOW (clamped into the trip window) — the
    // curve still ANCHORS at the last log, but its slope/curvature
    // reflect current conditions, including hours-long silences.
    const nowDays = Math.max(d0, daysSinceStart(Math.min(Date.now(), tripEndMs)));
    const rFast = kernelRate(RATE_TAU_FAST, nowDays);
    const rSlow = kernelRate(RATE_TAU_SLOW, nowDays);
    const rate = rSlow;
    const accel = (rFast - rSlow) / (RATE_TAU_SLOW - RATE_TAU_FAST);
    return { rate, accel, d0, c0 };
  }

  // Time constant for accel-taper (in days). A burst's influence dies
  // out over roughly the trend-kernel window — it shouldn't compound
  // for the rest of the trip.
  function taperTau() {
    return RATE_TAU_SLOW;
  }

  // Project via the fitted rolling rate + accel WITH A DECAYING
  // ACCELERATION. Constant accel is unrealistic — a surge doesn't
  // compound forever. Instead we let accel decay exponentially with
  // time constant τ (see taperTau):
  //
  //     accel(u) = accel · exp(−u/τ)
  //     rate(u)  = rate + accel·τ·(1 − exp(−u/τ))
  //     count(u) = c₀ + rate·u + accel·τ·(u − τ·(1 − exp(−u/τ)))
  //
  // where u = d − d₀. As u → ∞, accel dies to 0 and the counter
  // grows linearly at the new steady-state rate (rate + accel·τ).
  //
  // Monotonic guard: if accel is negative enough that the steady-
  // state rate would go negative, we integrate up to the zero-
  // crossing and hold count flat afterward (no un-seeing donuts).
  function quadraticProjection(ms) {
    const fit = fitRollingRate();
    if (!fit) return null;
    const { rate, accel, d0, c0 } = fit;
    const d = daysSinceStart(ms);
    const u = d - d0;
    if (u <= 0) return c0;
    const tau = taperTau();
    // Analytic count(u) under exponentially decaying acceleration.
    const decay = Math.exp(-u / tau);
    const rateAtU = rate + accel * tau * (1 - decay);
    // If the local rate stays non-negative for the whole interval,
    // use the closed-form count.
    if (rate >= 0 && rateAtU >= 0) {
      const c = c0 + rate * u + accel * tau * (u - tau * (1 - decay));
      return Math.max(c0, c);
    }
    // Decelerating fast enough that rate crosses zero before we reach
    // u. Solve rate + accel·τ·(1 − exp(−u*/τ)) = 0 for u*:
    //   exp(−u*/τ) = 1 + rate / (accel·τ)
    // Only meaningful when accel < 0 and the bracket is in (0, 1].
    if (accel < 0) {
      const bracket = 1 + rate / (accel * tau);
      if (bracket > 0 && bracket <= 1) {
        const uStar = -tau * Math.log(bracket);
        if (uStar > 0 && uStar < u) {
          const dStar = Math.exp(-uStar / tau);
          const cStar = c0 + rate * uStar + accel * tau * (uStar - tau * (1 - dStar));
          return Math.max(c0, cStar);
        }
      }
    }
    // Fall-through: return the raw closed form, floored at c₀.
    const c = c0 + rate * u + accel * tau * (u - tau * (1 - decay));
    return Math.max(c0, c);
  }
  // Kept for callers that still reference the old names.
  function fitQuadratic() { return fitRollingRate(); }
  function fitPowerLaw() { return fitRollingRate(); }

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
      // Extend the data line horizontally to NOW at the current count.
      // The donut sits at (now, current_count), so the line should
      // reach it — otherwise the flat "no sightings since last log"
      // gap between the last click and the donut is invisible.
      const nowT = Date.now();
      const lastLogT = pts[pts.length - 1].t;
      if (nowT > lastLogT && nowT >= tripStartMs && nowT <= tripEndMs) {
        pts.push({ t: nowT, c: pts[pts.length - 1].c });
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
      //
      // curvesSvg is built up inside the if-block below but appended
      // to `out` AFTER the 🍩 emoji, so declare it up here to keep it
      // in scope.
      let curvesSvg = "";
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

        // Shaded uncertainty band spanning the full cone of
        // possibility: from the flat "no more Dunkin" floor at y0
        // up to whichever projection curve sits highest. Rendered
        // NOW (before the emoji) since it's decorative fill; the
        // interactive curves themselves are held back until after
        // the 🍩 so hover works over the donut.
        if (linSamples.length || quadSamples.length) {
          // Top curve = pointwise MAX of quad and linear (in y-space,
          // that's the MIN y since y grows downward).
          const topSamples = [];
          const n = Math.max(linSamples.length, quadSamples.length);
          for (let i = 0; i < n; i++) {
            const l = linSamples[i], q = quadSamples[i];
            if (l && q) topSamples.push({ x: l.x, y: Math.min(l.y, q.y) });
            else if (l) topSamples.push(l);
            else if (q) topSamples.push(q);
          }
          const flatXEnd = xForDate(tripEndMs);
          const fwd = topSamples.map(p => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
          const bandD = `M ${x0.toFixed(1)} ${y0.toFixed(1)} ${fwd} L ${flatXEnd.toFixed(1)} ${y0.toFixed(1)} Z`;
          out += `<path d="${bandD}" fill="#FF6720" fill-opacity="0.13" stroke="none"/>`;
        }

        // The interactive curves (linear, flat "no more Dunkin",
        // rolling-rate) are built into `curvesSvg` here but appended
        // to `out` AFTER the 🍩 emoji below. That way the fat hover
        // hit paths sit above the donut and stay clickable even where
        // the emoji overlaps the anchor.
        //
        // (curvesSvg was hoisted just above the `if (logs.length >= 1)`
        // so it's in scope when we append it after the emoji.)

        // Linear line — dotted. Wrapped in an interactive group so
        // hovering (or tapping) reveals a pill with the fit equation.
        // Model: y = c0 + rate·(d - d0), where (d0, c0) is the anchor
        // point (latest logged sighting) and rate = c0 / d0.
        if (linSamples.length) {
          const linD = `M ${x0.toFixed(1)} ${y0.toFixed(1)} ` +
                       linSamples.map(p => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
          const anchor = anchorPoint();
          const rate = anchor && anchor.d > 0 ? (anchor.c / anchor.d) : 0;
          const linLabel = `Linear extrapolation: y = ${rate.toFixed(2)} · d`;
          const linLW = Math.max(60, linLabel.length * 6.2 + 12);
          const linLH = 18;
          const linLX = Math.max(M.left + 4, x0 - linLW / 2);
          const linLY = Math.min(M.top + PLOT_H - linLH - 2, y0 + 8);
          curvesSvg += `<g class="dunkin-fit-curve dunkin-fit-linear" tabindex="0" role="button" aria-label="${esc(linLabel)}">`;
          curvesSvg += `<path d="${linD}" fill="none" stroke="#FF6720" stroke-opacity="0.6" stroke-width="2" stroke-dasharray="4,4"/>`;
          curvesSvg += `<path d="${linD}" fill="none" stroke="transparent" stroke-width="14" style="cursor:help;"/>`;
          curvesSvg += `<g class="dunkin-fit-label" pointer-events="none">`;
          curvesSvg += `<rect x="${linLX.toFixed(1)}" y="${linLY.toFixed(1)}" width="${linLW.toFixed(1)}" height="${linLH}" rx="4" fill="#FF6720"/>`;
          curvesSvg += `<text x="${(linLX + linLW / 2).toFixed(1)}" y="${(linLY + linLH / 2 + 4).toFixed(1)}" font-size="11" text-anchor="middle" fill="white" font-weight="700" font-family="system-ui,sans-serif">${esc(linLabel)}</text>`;
          curvesSvg += `</g>`;
          curvesSvg += `<title>${esc(linLabel)}</title>`;
          curvesSvg += `</g>`;
        }

        // "If we don't see a single Dunkin from here on out..." — the
        // pessimistic flat projection. Horizontal dotted line at the
        // current count from the anchor to the trip end. Same
        // interactive treatment as the others so the label appears
        // on hover/tap.
        {
          const flatXEnd = xForDate(tripEndMs);
          const flatD = `M ${x0.toFixed(1)} ${y0.toFixed(1)} L ${flatXEnd.toFixed(1)} ${y0.toFixed(1)}`;
          const flatLabel = `If we don't see a single Dunkin from here on out…`;
          const flatLW = Math.max(60, flatLabel.length * 6.2 + 12);
          const flatLH = 18;
          const flatLX = Math.max(M.left + 4, Math.min(CHART_W - flatLW - 4, (x0 + flatXEnd) / 2 - flatLW / 2));
          // Sit the label ABOVE the flat line so it doesn't collide
          // with the linear-label pill just below the anchor.
          let flatLY = y0 - flatLH - 6;
          if (flatLY < M.top + 2) flatLY = y0 + 10;
          curvesSvg += `<g class="dunkin-fit-curve dunkin-fit-flat" tabindex="0" role="button" aria-label="${esc(flatLabel)}">`;
          curvesSvg += `<path d="${flatD}" fill="none" stroke="#8a9a92" stroke-opacity="0.75" stroke-width="1.5" stroke-dasharray="2,3"/>`;
          curvesSvg += `<path d="${flatD}" fill="none" stroke="transparent" stroke-width="14" style="cursor:help;"/>`;
          curvesSvg += `<g class="dunkin-fit-label" pointer-events="none">`;
          curvesSvg += `<rect x="${flatLX.toFixed(1)}" y="${flatLY.toFixed(1)}" width="${flatLW.toFixed(1)}" height="${flatLH}" rx="4" fill="#4a5a52"/>`;
          curvesSvg += `<text x="${(flatLX + flatLW / 2).toFixed(1)}" y="${(flatLY + flatLH / 2 + 4).toFixed(1)}" font-size="11" text-anchor="middle" fill="white" font-weight="700" font-family="system-ui,sans-serif">${esc(flatLabel)}</text>`;
          curvesSvg += `</g>`;
          curvesSvg += `<title>${esc(flatLabel)}</title>`;
          curvesSvg += `</g>`;
        }

        // Quadratic curve — dashed, slightly heavier so the "with
        // acceleration" story reads. Wrapped in a group with an
        // invisible fat-stroke hit path so hovering anywhere near the
        // curve reveals the fit formula (count = A · d^k, with actual
        // A and k floats). Hover state toggles .is-open on the group
        // and CSS drives the reveal of the .dunkin-fit-label element.
        if (fit && quadSamples.length) {
          const quadD = `M ${x0.toFixed(1)} ${y0.toFixed(1)} ` +
                       quadSamples.map(p => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
          // Model: count(d) = c₀ + rate·(d − d₀) + ½·accel·(d − d₀)²
          // fit on the last few logs. rate = current 1st-order rate
          // (sightings/day), accel = 2nd-order rate (how fast the
          // rate itself is changing).
          const rate = (fit.rate).toFixed(2);
          const accel = (fit.accel).toFixed(2);
          const tau = taperTau().toFixed(2);
          const shortLabel = `Trend rate + burst accel: rate=${rate}/day, accel=${accel}/day², τ=${tau}d`;

          // Long-form essay explaining why the graph model changed
          // over the trip's lifetime. Rendered as a hover-only tooltip
          // that fades in when the curve is hovered/tapped. The lines
          // are pre-wrapped (SVG doesn't wrap text natively) — each
          // string becomes one tspan.
          const essayLines = [
            `Forecast accounting for recent acceleration of sightings:`,
            `  trend rate = ${rate}/day, accel = ${accel}/day², τ = ${tau}d`,
            ``,
            `Claude here, instructed by Andrew to explain this. Earlier`,
            `versions fit a weighted quadratic through the last log, but`,
            `no tuning could make that see a same-day BURST: points from`,
            `the last few hours sit at u ≈ 0 where the u² term has no`,
            `leverage, so three donuts in an afternoon left the curve`,
            `unmoved. Now we measure the sighting rate directly with two`,
            `causal exponential kernels evaluated at NOW:`,
            `   rate(τ) = Σ exp(−(now − tᵢ)/τ) / τ`,
            `a FAST one (τ=${RATE_TAU_FAST}d — how hot are the last few hours?)`,
            `and a SLOW one (τ=${RATE_TAU_SLOW}d — the multi-day trend). Then:`,
            `   rate  = slow kernel (the trend carries the curve)`,
            `   accel = (fast − slow) / (τslow − τfast)`,
            `A burst hotter than trend bends the curve UP; hours of`,
            `silence decay the fast kernel and bend it down — no phantom`,
            `point needed, time passing is felt automatically. The curve`,
            `anchors at the LAST LOG (d₀, c₀) and a burst can't compound`,
            `forever, so accel TAPERS with time constant τ = ${RATE_TAU_SLOW}d:`,
            `   accel(u) = accel · exp(−u/τ)`,
            `   count(u) = c₀ + rate·u + accel·τ·(u − τ·(1 − exp(−u/τ)))`,
            `As u grows the curve settles into linear growth at rate +`,
            `accel·τ. Monotonic guard: if accel drives the local rate`,
            `below zero, we hold count flat at the crossing — no`,
            `un-seeing donuts.`,
          ];
          const lineH = 13;
          const padX = 12, padY = 10;
          // Approximate width using the widest line. Monospace-ish
          // estimate: 6.2 CSS units per char at font-size 11 works
          // reasonably at the chart's 400-unit viewBox width.
          const maxLineW = Math.max(...essayLines.map(s => s.length)) * 6.2;
          const essayW = Math.min(CHART_W - 8, maxLineW + padX * 2);
          const essayH = essayLines.length * lineH + padY * 2;
          // Anchor the essay above and slightly right of the curve
          // start, but keep it inside the chart bounds.
          let essayX = x0 - essayW / 2;
          essayX = Math.max(4, Math.min(essayX, CHART_W - essayW - 4));
          let essayY = y0 - essayH - 10;
          if (essayY < 4) essayY = Math.min(y0 + 12, CHART_H - essayH - 4);

          curvesSvg += `<g class="dunkin-fit-curve" tabindex="0" role="button" aria-label="${esc(shortLabel)}">`;
          // Visible dashed pink curve.
          curvesSvg += `<path d="${quadD}" fill="none" stroke="#DA1884" stroke-opacity="0.65" stroke-width="2" stroke-dasharray="2,3"/>`;
          // Invisible fat hitbox so hover/tap targets are generous.
          curvesSvg += `<path d="${quadD}" fill="none" stroke="transparent" stroke-width="14" style="cursor:help;"/>`;
          // Hover-reveal essay (hidden by default; CSS drives opacity).
          curvesSvg += `<g class="dunkin-fit-label" pointer-events="none">`;
          curvesSvg += `<rect x="${essayX.toFixed(1)}" y="${essayY.toFixed(1)}" width="${essayW.toFixed(1)}" height="${essayH.toFixed(1)}" rx="6" fill="#DA1884"/>`;
          // Text lines as tspans, each dy = lineH.
          const textX = essayX + padX;
          const textY0 = essayY + padY + 10;
          curvesSvg += `<text x="${textX.toFixed(1)}" y="${textY0.toFixed(1)}" font-size="11" fill="white" font-family="system-ui,sans-serif">`;
          essayLines.forEach((line, i) => {
            const bold = i === 0;
            const weight = bold ? " font-weight=\"800\"" : "";
            curvesSvg += `<tspan x="${textX.toFixed(1)}" dy="${i === 0 ? 0 : lineH}"${weight}>${esc(line || " ")}</tspan>`;
          });
          curvesSvg += `</text>`;
          curvesSvg += `</g>`;
          // Native title as a fallback tooltip — short form only, since
          // native tooltips don't render wrapped text nicely.
          curvesSvg += `<title>${esc(shortLabel)}</title>`;
          curvesSvg += `</g>`;
        }

      }

      // ----- Latest = 🍩 emoji -----
      const last = pts[pts.length - 1];
      const lx = xForDate(last.t);
      const ly = yForCount(last.c, yMax);
      out += `<text x="${lx.toFixed(1)}" y="${(ly + 6).toFixed(1)}" font-size="18" text-anchor="middle" style="user-select:none;">🍩</text>`;

      // ----- Interactive projection curves, drawn AFTER the emoji so
      // their hover hit paths (fat transparent strokes) sit on top of
      // the donut and stay clickable even where they overlap. -----
      if (typeof curvesSvg === "string" && curvesSvg) {
        out += curvesSvg;
      }
    }

    // ----- Right-axis avatars at each guess -----
    // Avatars are DISTRIBUTED evenly across the vertical plot area
    // rather than parked at each true guess-y and then shoved down on
    // collision. That lets low guesses use the top space that would
    // otherwise be wasted, and connector lines can slope up OR down
    // to reach each guess's real y instead of always sloping down.
    const AV_R = 12;
    // Push the avatar column to the far right of the SVG so the space
    // between the plot edge (M.left + PLOT_W) and the avatar circles
    // is maximized — that's the room the connector lines get to fan
    // out toward each guess's exact y-value.
    const avX = CHART_W - AV_R - 4;
    // Sort by guess DESCENDING so the highest guess sits at the top
    // of the column (matches the y-axis where higher numbers are up).
    const sorted = PARTICIPANTS
      .filter(p => p.guess <= yMax)
      .slice()
      .sort((a, b) => b.guess - a.guess);
    // Evenly distribute across the plot area. If there's more room
    // than the avatars need (natural spacing would exceed the ideal),
    // fall back to just parking each avatar at its true guess-y
    // (nothing to gain from artificial distribution).
    const plotTop = M.top;
    const plotBottom = M.top + PLOT_H;
    const idealPitch = 2 * AV_R + 4;
    const availableH = plotBottom - plotTop - 2 * AV_R;
    const needed = (sorted.length - 1) * idealPitch;
    const distribute = sorted.length > 1 && needed > 0 && needed <= availableH * 2;
    const placed = sorted.map((p, i) => {
      const trueY = yForCount(p.guess, yMax);
      let y;
      if (!distribute || sorted.length === 1) {
        y = trueY;
      } else {
        // Even spread from top to bottom of the plot area.
        const pitch = availableH / (sorted.length - 1);
        y = plotTop + AV_R + i * pitch;
      }
      return { p, y, trueY };
    });
    // Avatars are wrapped in a group with class .dunkin-avatar; hover
    // (desktop) or tap (touch) toggles a name+guess label to the left.
    // <title> stays as a fallback for native platform tooltips.
    for (const { p, y, trueY } of placed) {
      const tip = `${p.name} guessed ${p.guess}`;
      out += `<g class="dunkin-avatar" data-avatar="${esc(p.id)}" tabindex="0" role="button" aria-label="${esc(tip)}"><title>${esc(tip)}</title>`;
      // Connector line from the guess-line's right end at the TRUE
      // guess y to the avatar's placed y. Slopes up or down depending
      // on whether the participant's guess is higher or lower than
      // their position in the evenly-distributed column.
      out += `<line x1="${(M.left + PLOT_W).toFixed(1)}" y1="${trueY.toFixed(1)}" x2="${(avX - AV_R).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${p.color}" stroke-opacity="0.45" stroke-width="1"/>`;
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
    wireFitCurveInteractions();
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

  // Same pattern for each fit curve (linear + power-law) — hover
  // shows a formula pill (CSS handles that); tap toggles it for
  // touch users. Only one open at a time.
  function wireFitCurveInteractions() {
    const curves = svg.querySelectorAll(".dunkin-fit-curve");
    if (!curves.length) return;
    function closeAll() {
      curves.forEach(c => c.classList.remove("is-open"));
    }
    curves.forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const wasOpen = el.classList.contains("is-open");
        closeAll();
        if (!wasOpen) el.classList.add("is-open");
      });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const wasOpen = el.classList.contains("is-open");
          closeAll();
          if (!wasOpen) el.classList.add("is-open");
        }
      });
    });
    document.addEventListener("click", closeAll, { once: true });
  }

  // Re-render every minute so the "today" marker + "X ago" extrapolation
  // stay fresh without a page reload. Cheap; the chart is small.
  setInterval(() => { if (logs.length) renderChart(); }, 60 * 1000);
})();
