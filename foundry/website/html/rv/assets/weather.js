// ============================================================
// Weather + rain comparison
// Renders: line charts (temp, rain), tabbed route maps with sleep moons +
// activity icons + passthrough labels, data tables, combined verdict.
// ============================================================

// ---------- Unit handling ----------
const UNIT_COOKIE = "rv_temp_unit";
function readUnitCookie() {
  const m = document.cookie.match(/(?:^|; )rv_temp_unit=([^;]+)/);
  return m && m[1] === "C" ? "C" : "F";
}
function writeUnitCookie(u) {
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${UNIT_COOKIE}=${u}; path=/; max-age=${oneYear}; SameSite=Lax`;
}
let currentUnit = readUnitCookie();
const fToC = f => (Number(f) - 32) * 5 / 9;
function convT(f) { return currentUnit === "C" ? fToC(f) : Number(f); }
function fmtT(f, digits = 1) {
  return `${convT(f).toFixed(digits)}°${currentUnit}`;
}
function fmtTDelta(f, digits = 1) {
  const v = currentUnit === "C" ? Number(f) * 5 / 9 : Number(f);
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)}°${currentUnit}`;
}
function fmtTRange(fLow, fHigh, digits = 0) {
  return `${convT(fLow).toFixed(digits)}–${convT(fHigh).toFixed(digits)}°${currentUnit}`;
}
function fmtTDeltaRange(fLow, fHigh, digits = 0) {
  const lo = currentUnit === "C" ? Number(fLow) * 5 / 9 : Number(fLow);
  const hi = currentUnit === "C" ? Number(fHigh) * 5 / 9 : Number(fHigh);
  return `${lo.toFixed(digits)}–${hi.toFixed(digits)}°${currentUnit}`;
}

// DRIVE_HOURS is derived from trip.json at runtime. See buildDriveHours() below.
// Length will be (totalNights - 1). Zero-hour entries represent same-coord
// transitions between consecutive nights at a multi-night stop.

function shortName(name) {
  return name
    .replace(/, [A-Z]{2}.*$/, "")
    .replace(/ \(.*\)$/, "")
    .replace(/Gunnison\//, "");
}

// HTML/SVG attribute escaping for tooltip strings.
function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeText(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Inline SVG icons. Each is a path/group designed to render at a given (cx, cy)
// at scale ~14px. Returned strings are <g> blocks that should be appended to
// the map SVG. Color comes via stroke="currentColor" with the parent setting
// fill/stroke on the wrapper.
function svgIcon(kind, cx, cy, size = 14) {
  const r = size / 2;
  switch (kind) {
    case "moon":
      // Classic crescent built as a single closed path with two arcs.
      // The path traces:
      //   1. Up the outer arc (left side of the moon) from bottom to top.
      //   2. Down the inner arc (right side) from top back to bottom.
      // Both arcs share their endpoints (top and bottom of the crescent),
      // producing one continuous outline. One stroke, no artifacts.
      //
      // Geometry: outer arc has radius r centered at (0, 0); inner arc has
      // radius ir (smaller than r — bigger ir = thinner crescent). The two
      // arcs meet at (0, -r) and (0, r). We use sweep flags to make outer
      // bulge left and inner bulge left less (so the crescent opens right).
      {
        // Crescent opening RIGHT, built via evenodd fill rule:
        //   - outer subpath: full circle radius r at origin (drawn as two arcs)
        //   - inner subpath: full circle radius ir, offset to the right by ox
        // Evenodd fills only the region inside outer-but-outside-inner — the
        // moon's lit area. Visually verified at r=20, ir=16, ox=8: produces
        // a clean fat crescent with no artifacts.
        const ir = r * 0.8;
        const ox = r * 0.4;
        return `<g transform="translate(${cx} ${cy})"><path fill-rule="evenodd" d="M 0 ${-r} A ${r} ${r} 0 1 0 0 ${r} A ${r} ${r} 0 1 0 0 ${-r} Z M ${ox} ${-ir} A ${ir} ${ir} 0 1 0 ${ox} ${ir} A ${ir} ${ir} 0 1 0 ${ox} ${-ir} Z" fill="__FILL__" stroke="white" stroke-width="1.5"/></g>`;
      }
    case "mountain":
      return `<g transform="translate(${cx} ${cy})"><path d="M ${-r} ${r * 0.55} L ${-r * 0.25} ${-r * 0.5} L ${r * 0.15} ${r * 0.05} L ${r * 0.45} ${-r * 0.85} L ${r} ${r * 0.55} Z" fill="#6b8478" stroke="white" stroke-width="0.8"/></g>`;
    case "park":
      // pine-tree silhouette
      return `<g transform="translate(${cx} ${cy})"><path d="M 0 ${-r} L ${-r * 0.55} ${-r * 0.1} L ${-r * 0.3} ${-r * 0.1} L ${-r * 0.7} ${r * 0.45} L ${-r * 0.4} ${r * 0.45} L ${-r * 0.4} ${r * 0.8} L ${r * 0.4} ${r * 0.8} L ${r * 0.4} ${r * 0.45} L ${r * 0.7} ${r * 0.45} L ${r * 0.3} ${-r * 0.1} L ${r * 0.55} ${-r * 0.1} Z" fill="#2f8a6e" stroke="white" stroke-width="0.6"/></g>`;
    case "museum":
      // Greek column silhouette
      return `<g transform="translate(${cx} ${cy})"><rect x="${-r * 0.9}" y="${-r}" width="${r * 1.8}" height="${r * 0.18}" fill="#7a6a4f" stroke="white" stroke-width="0.5"/><path d="M ${-r * 0.85} ${-r * 0.75} L ${r * 0.85} ${-r * 0.75} L ${r * 0.65} ${-r * 0.82} L ${-r * 0.65} ${-r * 0.82} Z" fill="#7a6a4f" stroke="white" stroke-width="0.5"/><rect x="${-r * 0.7}" y="${-r * 0.7}" width="${r * 0.18}" height="${r * 1.4}" fill="#7a6a4f"/><rect x="${-r * 0.1}" y="${-r * 0.7}" width="${r * 0.18}" height="${r * 1.4}" fill="#7a6a4f"/><rect x="${r * 0.5}" y="${-r * 0.7}" width="${r * 0.18}" height="${r * 1.4}" fill="#7a6a4f"/><rect x="${-r}" y="${r * 0.7}" width="${r * 2}" height="${r * 0.25}" fill="#7a6a4f" stroke="white" stroke-width="0.5"/></g>`;
    case "natural":
      // hot spring / water drop
      return `<g transform="translate(${cx} ${cy})"><path d="M 0 ${-r} C ${r * 0.7} ${-r * 0.2} ${r * 0.7} ${r * 0.55} 0 ${r * 0.85} C ${-r * 0.7} ${r * 0.55} ${-r * 0.7} ${-r * 0.2} 0 ${-r} Z" fill="#4a7fa0" stroke="white" stroke-width="0.8"/></g>`;
    case "food":
      // chef hat / dining
      return `<g transform="translate(${cx} ${cy})"><path d="M ${-r * 0.65} ${r * 0.2} A ${r * 0.45} ${r * 0.45} 0 1 1 ${r * 0.05} ${-r * 0.6} A ${r * 0.45} ${r * 0.45} 0 1 1 ${r * 0.65} ${r * 0.2} Z" fill="#d97b3a" stroke="white" stroke-width="0.7"/><rect x="${-r * 0.65}" y="${r * 0.2}" width="${r * 1.3}" height="${r * 0.45}" fill="#d97b3a" stroke="white" stroke-width="0.7"/></g>`;
    case "coast":
      // wave
      return `<g transform="translate(${cx} ${cy})"><path d="M ${-r} ${r * 0.2} Q ${-r * 0.5} ${-r * 0.45} 0 ${r * 0.2} Q ${r * 0.5} ${r * 0.85} ${r} ${r * 0.2}" stroke="#4a7fa0" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M ${-r} ${r * 0.65} Q ${-r * 0.5} 0 0 ${r * 0.65} Q ${r * 0.5} ${r * 1.3} ${r} ${r * 0.65}" stroke="#4a7fa0" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.6"/></g>`;
    case "home":
      return `<g transform="translate(${cx} ${cy})"><path d="M 0 ${-r} L ${r} 0 L ${r * 0.7} 0 L ${r * 0.7} ${r * 0.8} L ${-r * 0.7} ${r * 0.8} L ${-r * 0.7} 0 L ${-r} 0 Z" fill="#d97b3a" stroke="white" stroke-width="0.7"/></g>`;
    default:
      return `<circle cx="${cx}" cy="${cy}" r="${r * 0.5}" fill="#999"/>`;
  }
}

(async function () {
  const [tempRes, rainRes, tripRes] = await Promise.all([
    fetch("assets/weather-data.json"),
    fetch("assets/rain-data.json"),
    fetch("assets/trip.json"),
  ]);
  const tempData = await tempRes.json();
  const rainData = await rainRes.json();
  const trip = await tripRes.json();
  const stops = tempData.stops;
  const rainByDay = new Map(rainData.stops.map(s => [s.day, s]));

  const N = stops.length;

  // Build DRIVE_HOURS array: length N-1, indexed by transition from day i to i+1.
  // Same-coord consecutive nights (multi-night stops) get 0; real transitions
  // pull from trip.drives keyed by from_day → to_day. Skip dropped drives.
  const drivesByFrom = new Map(
    trip.drives.filter(d => !d.dropped_at).map(d => [d.from_day, d])
  );
  const DRIVE_HOURS = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const fromDay = stops[i].day;
    const toDay   = stops[i + 1].day;
    if (stops[i].lat === stops[i + 1].lat && stops[i].lon === stops[i + 1].lon) {
      DRIVE_HOURS.push(0);
    } else {
      const drive = drivesByFrom.get(fromDay);
      DRIVE_HOURS.push(drive ? drive.hours : 0);
    }
  }

  // Build `places` array from trip activities + passthroughs (shape compatible
  // with the old places.json structure that the map renderer expects).
  // Spread the whole entry so per-stop optional fields like `hours` and
  // `label_dir` flow through. Skip dropped items.
  const places = [
    ...trip.activities.filter(a => !a.dropped_at).map(a => ({
      ...a,
      type: "activity",
      early_day: a.day,
      late_day: a.day,
    })),
    ...trip.passthroughs.filter(p => !p.dropped_at).map(p => ({
      ...p,
      type: "passthrough",
    })),
  ];

  // ---------- VERDICT ----------
  let earlyTotal = 0, lateTotal = 0;
  let earlyHotNights = 0, lateHotNights = 0;
  stops.forEach((s) => {
    earlyTotal += s.early_normal_low_f;
    lateTotal  += s.late_normal_low_f;
    if (s.early_normal_low_f > 70) earlyHotNights++;
    if (s.late_normal_low_f  > 70) lateHotNights++;
  });
  const earlyTempAvg = (earlyTotal / N).toFixed(1);
  const lateTempAvg  = (lateTotal  / N).toFixed(1);
  const tempDelta = (lateTempAvg - earlyTempAvg).toFixed(1);

  // Rain first/second half split (first half = stops 1-8, second = 9-N)
  let efr = 0, lfr = 0, esr = 0, lsr = 0, fhc = 0, shc = 0;
  stops.forEach((s, i) => {
    const r = rainByDay.get(s.day);
    if (!r) return;
    if (i < 8) {
      efr += r.early_rain.wet_day_pct; lfr += r.late_rain.wet_day_pct; fhc++;
    } else {
      esr += r.early_rain.wet_day_pct; lsr += r.late_rain.wet_day_pct; shc++;
    }
  });
  const earlyFirstRain = (efr / fhc).toFixed(1);
  const lateFirstRain  = (lfr / fhc).toFixed(1);
  const earlySecondRain = (esr / shc).toFixed(1);
  const lateSecondRain  = (lsr / shc).toFixed(1);

  function renderVerdict() {
    const absDeltaF = Math.abs(parseFloat(tempDelta));
    const absDeltaConv = currentUnit === "C" ? absDeltaF * 5 / 9 : absDeltaF;
    const absDelta = `${absDeltaConv.toFixed(1)}°${currentUnit}`;
    // After consolidating BB+MW (Day 6) and rebalancing midwest to ~5hr days,
    // the trip is 15 nights. Sleep at elevation tempers heat almost entirely.
    document.getElementById("verdict-text").innerHTML = `
      <p><strong>Heat:</strong> Sleep at elevation (Cloudcroft, Hyde Park, Mancos NF, Last Dollar Rd, Cement Creek) makes heat almost a non-issue — <strong>5 of 15 nights drop below ${fmtT(55, 0)}</strong>, with Cement Creek averaging ${fmtT(40, 0)}. The 2 hot nights are <strong>Gila Bend (~${fmtT(83, 0)}, splurge motel night) and Willcox (~${fmtT(72, 0)}, Walmart)</strong>. Trip averages: ${fmtT(earlyTempAvg)} (early) vs. ${fmtT(lateTempAvg)} (late), within ${absDelta}.</p>
      <p><strong>Rain:</strong> Early start (Jul 5) is drier in the first half (${earlyFirstRain}% vs. ${lateFirstRain}% avg wet-day probability across SD → Mancos). The North American Monsoon kicks in around Jul 4–15 and intensifies through August — the early window front-runs it. The spike shows hardest at the high-elevation NM dispersed nights: <strong>Cloudcroft (Day 6) goes 37% → 49%</strong> wet-day probability between the two starts, and Hyde Park (Day 7) goes 42% → 48%. The second half (Denver → NYC) is close (${earlySecondRain}% vs ${lateSecondRain}%).</p>
      <p><strong>Trade-off:</strong> With sleep at elevation, heat stops being a real decider. <strong>Rain is the decisive factor — and rain hits hardest at exactly the days we most want dry weather</strong> (White Sands sledding, Mesa Verde tours, dirt-road dispersed access in CO). Jul 5 still wins. <em>Leaning July 5.</em></p>
    `;
  }
  renderVerdict();

  function renderStaticTempCaptions() {
    const el = document.getElementById("comfort-band-label");
    if (el) el.textContent = `Comfortable sleep band (${fmtTRange(55, 68)} outside)`;
    const el2 = document.getElementById("rv-warmer-note");
    if (el2) el2.innerHTML = `⚠️ <strong>Inside the RV runs ${fmtTDeltaRange(10, 20)} warmer</strong> than outside lows for the first half of the night — so a ${fmtT(70, 0)} outside reading often means a sticky ${fmtT(80, 0)}+ inside, especially after a day baking in the sun. Mitigations: park in shade, use the roof vent / Fantastic Fan, reflectix the windshield, sleep at elevation when you can.`;
    const el3 = document.getElementById("caveat-deviation");
    if (el3) el3.innerHTML = `Any individual year can deviate ±${fmtTDeltaRange(5, 10)} from these averages. Heat domes happen, and so do unusual monsoon seasons.`;
  }
  renderStaticTempCaptions();

  // ===========================================================
  // LINE CHARTS (unchanged structure)
  // ===========================================================
  function buildLineChart(svgId, getEarlyRaw, getLateRaw, yUnit, comfortBandRaw, convert) {
    const svg = document.getElementById(svgId);
    const W = 900, H = 380;
    const M = { l: 55, r: 20, t: 18, b: 80 };
    const innerW = W - M.l - M.r, innerH = H - M.t - M.b;

    const getEarly = s => convert ? convert(getEarlyRaw(s)) : getEarlyRaw(s);
    const getLate  = s => convert ? convert(getLateRaw(s))  : getLateRaw(s);
    const comfortBand = (comfortBandRaw && convert)
      ? [convert(comfortBandRaw[0]), convert(comfortBandRaw[1])]
      : comfortBandRaw;

    const allVals = stops.flatMap(s => [getEarly(s), getLate(s)]);
    const yMin = Math.floor(Math.min(...allVals) / 5) * 5 - 2;
    const yMax = Math.ceil(Math.max(...allVals) / 5) * 5 + 2;
    const xAt = i => M.l + (i / (N - 1)) * innerW;
    const yAt = v => M.t + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

    let inner = "";

    if (comfortBand) {
      const bandTop = yAt(comfortBand[1]), bandBottom = yAt(comfortBand[0]);
      inner += `<rect x="${M.l}" y="${bandTop}" width="${innerW}" height="${bandBottom - bandTop}" fill="#c9dfd2" opacity="0.45"/>`;
    }

    const step = (yMax - yMin) > 50 ? 10 : 5;
    for (let t = Math.ceil(yMin / step) * step; t <= yMax; t += step) {
      const y = yAt(t);
      inner += `<line x1="${M.l}" x2="${M.l + innerW}" y1="${y}" y2="${y}" stroke="#e0e9e4" stroke-width="1"/>`;
      inner += `<text x="${M.l - 8}" y="${y + 4}" font-size="11" fill="#4a5a52" text-anchor="end" font-family="system-ui, sans-serif">${Math.round(t)}${yUnit}</text>`;
    }

    stops.forEach((s, i) => {
      const x = xAt(i);
      inner += `<text x="${x}" y="${H - M.b + 14}" font-size="10" fill="#4a5a52" text-anchor="end" transform="rotate(-40 ${x} ${H - M.b + 14})" font-family="system-ui, sans-serif">D${s.day} ${shortName(s.label)}</text>`;
    });

    const earlyPath = stops.map((s, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(getEarly(s))}`).join(" ");
    inner += `<path d="${earlyPath}" fill="none" stroke="#d97b3a" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    const latePath = stops.map((s, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(getLate(s))}`).join(" ");
    inner += `<path d="${latePath}" fill="none" stroke="#2f8a6e" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;

    stops.forEach((s, i) => {
      inner += `<circle cx="${xAt(i)}" cy="${yAt(getEarly(s))}" r="3.5" fill="#d97b3a"/>`;
      inner += `<circle cx="${xAt(i)}" cy="${yAt(getLate(s))}" r="3.5" fill="#2f8a6e"/>`;
    });

    svg.innerHTML = inner;
  }

  function renderTempChart() {
    buildLineChart("chart",
      s => s.early_normal_low_f,
      s => s.late_normal_low_f,
      `°${currentUnit}`,
      [55, 68],
      convT);
  }
  renderTempChart();

  buildLineChart("rain-chart",
    s => rainByDay.get(s.day).early_rain.wet_day_pct,
    s => rainByDay.get(s.day).late_rain.wet_day_pct,
    "%",
    null,
    null);

  // ===========================================================
  // MAP — sleep moons, activity icons, passthrough labels
  // ===========================================================
  // Build coord bounds from sleep + places combined
  const allLats = [...stops.map(s => s.lat), ...places.map(p => p.lat)];
  const allLons = [...stops.map(s => s.lon), ...places.map(p => p.lon)];
  const latMin = Math.min(...allLats), latMax = Math.max(...allLats);
  const lonMin = Math.min(...allLons), lonMax = Math.max(...allLons);
  const midLat = (latMin + latMax) / 2;
  const lonScale = Math.cos(midLat * Math.PI / 180);
  // 2x tall map
  // Map viewBox is 2x tall (1520) to give labels and icons breathing room.
  const mW = 900, mH = 1520;
  const mM = { l: 50, r: 50, t: 40, b: 50 };
  const project = (lat, lon) => {
    const x = mM.l + ((lon - lonMin) * lonScale) / ((lonMax - lonMin) * lonScale) * (mW - mM.l - mM.r);
    const y = mM.t + (latMax - lat) / (latMax - latMin) * (mH - mM.t - mM.b);
    return [x, y];
  };

  function tempColor(t) {
    const tt = Math.max(35, Math.min(85, t));
    const ratio = (tt - 35) / 50;
    // 35°F = cool teal, 85°F = warm orange
    const r = Math.round(70 + (217 - 70) * ratio);
    const g = Math.round(140 + (123 - 140) * ratio);
    const b = Math.round(160 + (58 - 160) * ratio);
    return `rgb(${r},${g},${b})`;
  }
  function rainColor(p) {
    const pp = Math.max(0, Math.min(50, p));
    const ratio = pp / 50;
    const r = Math.round(220 + (40 - 220) * ratio);
    const g = Math.round(232 + (90 - 232) * ratio);
    const b = Math.round(238 + (170 - 238) * ratio);
    return `rgb(${r},${g},${b})`;
  }

  // Format month/day
  function mmdd(iso) {
    const d = new Date(iso + "T00:00:00");
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  // Group consecutive same-coord sleep stops (e.g. SD x2 nights)
  function buildSleepGroups() {
    const groups = [];
    stops.forEach((s) => {
      const last = groups[groups.length - 1];
      if (last && last.lat === s.lat && last.lon === s.lon) {
        last.stops.push(s);
      } else {
        groups.push({ lat: s.lat, lon: s.lon, stops: [s] });
      }
    });
    return groups;
  }

  // Bounding box overlap helper for label placement
  function overlaps(a, b, pad = 2) {
    return !(a.x2 < b.x1 - pad || a.x1 > b.x2 + pad || a.y2 < b.y1 - pad || a.y1 > b.y2 + pad);
  }

  function renderMap(svgEl, mode, which) {
    let inner = "";
    const dateField = which === "late" ? "late_date" : "early_date";
    const dayField  = which === "late" ? "late_day"  : "early_day";

    // ----- LAYER 0: route line + drive-hour pills -----
    for (let i = 0; i < stops.length - 1; i++) {
      const [x1, y1] = project(stops[i].lat, stops[i].lon);
      const [x2, y2] = project(stops[i + 1].lat, stops[i + 1].lon);
      inner += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#c9dfd2" stroke-width="2"/>`;
      const dh = DRIVE_HOURS[i];
      if (dh > 0) {
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.hypot(dx, dy) || 1;
        const ox = -dy / len * 11, oy = dx / len * 11;
        const lx = mx + ox, ly = my + oy;
        inner += `<g><rect x="${lx - 15}" y="${ly - 8}" width="30" height="14" rx="7" fill="white" opacity="0.92" stroke="#c9dfd2" stroke-width="0.5"/><text x="${lx}" y="${ly + 3}" font-size="10" fill="#4a5a52" text-anchor="middle" font-family="system-ui, sans-serif">${dh}h</text></g>`;
      }
    }

    // ----- BUILD: all icons/dots with their fixed (x,y) + tooltip data -----
    // Three categories:
    //   1. passthrough markers (small grey dot at fixed coord)
    //   2. activity icons (svg icon at fixed coord) + label
    //   3. sleep moons (crescent at fixed coord) + value label
    //
    // Each has a 'core' bbox (the icon/dot itself, immovable) and an optional
    // 'label' that we'll place after all cores are pinned.

    const SLEEP_R = 9;       // crescent radius
    const ICON_R = 8;        // activity icon radius
    const PASS_R = 2.5;      // pass-through dot radius

    // Build the route polyline (projected coords of sleep stops). Activities
    // and pass-throughs snap to the nearest point on this line so they sit
    // visually on the route rather than drifting into empty space.
    const routePoints = stops.map(s => project(s.lat, s.lon));

    // For a point (px, py), find the nearest point on the polyline made up of
    // routePoints[0..N-1]. Returns {x, y, segIdx, t} where segIdx is which
    // segment was closest and t in [0,1] is position along it.
    function snapToRoute(px, py) {
      let best = { x: px, y: py, segIdx: 0, t: 0, dist: Infinity };
      for (let i = 0; i < routePoints.length - 1; i++) {
        const [ax, ay] = routePoints[i];
        const [bx, by] = routePoints[i + 1];
        const dx = bx - ax, dy = by - ay;
        const lenSq = dx * dx + dy * dy;
        let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const sx = ax + dx * t, sy = ay + dy * t;
        const d = Math.hypot(px - sx, py - sy);
        if (d < best.dist) best = { x: sx, y: sy, segIdx: i, t, dist: d };
      }
      return best;
    }

    // Decide a label-direction order from the per-item `label_dir` hint and
    // the local route orientation. Returns an array of candidate (dx, dy)
    // offset CENTERS for the label rectangle. The first non-colliding one wins.
    //
    // Directions: "right", "left", "above", "below", "auto" (default).
    // The "auto" default prefers horizontal placement (left/right) since the
    // map is now 2x tall and we want to use the horizontal whitespace. Tight
    // ring tried first, then medium, then wide.
    function makePositions(dir, labelW, labelH, iconR) {
      const halfW = labelW / 2;
      // Distance from icon center to label center: icon radius + padding + half label
      const NEAR = iconR + 4 + halfW;
      const MID  = NEAR + 14;
      const FAR  = NEAR + 32;
      const NEAR_V = iconR + 4 + labelH / 2;
      const MID_V  = NEAR_V + 12;
      const FAR_V  = NEAR_V + 26;
      const right = [
        { dx:  NEAR, dy: 0 }, { dx: MID, dy: 0 }, { dx: FAR, dy: 0 },
        { dx:  NEAR, dy: -8 }, { dx: NEAR, dy: 8 },
        { dx:  MID,  dy: -10 }, { dx: MID,  dy: 10 },
      ];
      const left = [
        { dx: -NEAR, dy: 0 }, { dx: -MID, dy: 0 }, { dx: -FAR, dy: 0 },
        { dx: -NEAR, dy: -8 }, { dx: -NEAR, dy: 8 },
        { dx: -MID,  dy: -10 }, { dx: -MID,  dy: 10 },
      ];
      const above = [
        { dx: 0, dy: -NEAR_V }, { dx: 0, dy: -MID_V }, { dx: 0, dy: -FAR_V },
        { dx: 12, dy: -NEAR_V }, { dx: -12, dy: -NEAR_V },
      ];
      const below = [
        { dx: 0, dy: NEAR_V }, { dx: 0, dy: MID_V }, { dx: 0, dy: FAR_V },
        { dx: 12, dy: NEAR_V }, { dx: -12, dy: NEAR_V },
      ];
      switch (dir) {
        case "right":  return [...right,  ...above, ...below, ...left];
        case "left":   return [...left,   ...above, ...below, ...right];
        case "above":  return [...above,  ...right, ...left,  ...below];
        case "below":  return [...below,  ...right, ...left,  ...above];
        case "auto":
        default:
          // Prefer horizontal first (use the tall map's horizontal space).
          return [...right, ...left, ...above, ...below];
      }
    }

    const items = []; // {coreBox, label, labelW, labelH, x, y, tooltip, drawCore, drawLabel, positions}
    const sleepGroups = buildSleepGroups();

    // 1) Pass-throughs — snap to route, label_dir from data or default "auto".
    places.filter(p => p.type === "passthrough").forEach(p => {
      const [rawX, rawY] = project(p.lat, p.lon);
      const snap = snapToRoute(rawX, rawY);
      const x = snap.x, y = snap.y;
      const labelText = p.name;
      const labelW = labelText.length * 5.5 + 6;
      const labelH = 12;
      const positions = makePositions(p.label_dir || "auto", labelW, labelH, PASS_R);
      items.push({
        kind: "passthrough",
        x, y,
        coreBox: { x1: x - PASS_R, y1: y - PASS_R, x2: x + PASS_R, y2: y + PASS_R },
        labelText, labelW, labelH, positions,
        tooltip: p.name,
        drawCore: () => `<circle cx="${x}" cy="${y}" r="${PASS_R}" fill="#9bb5a8" data-tip="${escapeAttr(p.name)}"/>`,
        drawLabel: (cx, cy) => `<text x="${cx}" y="${cy + 3}" font-size="9.5" fill="#7a8a82" text-anchor="middle" font-family="system-ui, sans-serif" font-style="italic" data-tip="${escapeAttr(p.name)}">${escapeText(labelText)}</text>`,
      });
    });

    // 2) Activity icons — snap to route, hours in tooltip, label_dir from data.
    places.filter(p => p.type === "activity").forEach(p => {
      const [rawX, rawY] = project(p.lat, p.lon);
      const snap = snapToRoute(rawX, rawY);
      const x = snap.x, y = snap.y;
      const day = p[dayField];
      const stop = stops.find(s => s.day === day);
      const dateStr = stop ? mmdd(stop[dateField]) : "";
      const hours = p.hours != null ? `~${p.hours} hr` : "";
      const tooltipParts = [p.name, dateStr, hours].filter(s => s);
      const tooltip = tooltipParts.join(" · ");
      const labelText = p.name;
      const labelW = labelText.length * 6.2 + 6;
      const labelH = 14;
      const positions = makePositions(p.label_dir || "auto", labelW, labelH, ICON_R);
      items.push({
        kind: "activity",
        x, y,
        coreBox: { x1: x - ICON_R, y1: y - ICON_R, x2: x + ICON_R, y2: y + ICON_R },
        labelText, labelW, labelH, positions,
        tooltip,
        drawCore: () => `<g data-tip="${escapeAttr(tooltip)}">${svgIcon(p.icon || "natural", x, y, ICON_R * 2)}</g>`,
        drawLabel: (cx, cy) => `<text x="${cx}" y="${cy + 4}" font-size="11" font-weight="600" fill="#1c2a25" text-anchor="middle" font-family="system-ui, sans-serif" data-tip="${escapeAttr(tooltip)}">${escapeText(labelText)}</text>`,
      });
    });

    // 3) Sleep moons (one per group; same-coord nights collapse). Color
    // carries the value; the temp/rain number lives only in the tooltip.
    sleepGroups.forEach((g) => {
      const [x, y] = project(g.lat, g.lon);
      const rep = g.stops[g.stops.length - 1];
      const dStrs = g.stops.map(s => mmdd(s[dateField]));
      const dateStr = dStrs.length === 1 ? dStrs[0] : `${dStrs[0]}–${dStrs[dStrs.length - 1]}`;
      let value, fillColor;
      if (mode === "temp") {
        const raw = which === "late" ? rep.late_normal_low_f : rep.early_normal_low_f;
        value = `${convT(raw).toFixed(0)}°${currentUnit}`;
        fillColor = tempColor(raw);
      } else {
        const r = rainByDay.get(rep.day);
        const raw = which === "late" ? r.late_rain.wet_day_pct : r.early_rain.wet_day_pct;
        value = `${raw.toFixed(0)}%`;
        fillColor = rainColor(raw);
      }
      const tooltip = `${shortName(rep.label)} · ${dateStr} · ${value}`;
      // No visible label — the color carries the value, and hovering reveals
      // the name + date + value. Less clutter, lets the route read clearly.
      items.push({
        kind: "sleep",
        x, y,
        coreBox: { x1: x - SLEEP_R, y1: y - SLEEP_R, x2: x + SLEEP_R, y2: y + SLEEP_R },
        labelText: null,
        labelW: 0,
        labelH: 0,
        tooltip,
        drawCore: () => {
          const moon = svgIcon("moon", x, y, SLEEP_R * 2).replace("__FILL__", fillColor);
          return `<g data-tip="${escapeAttr(tooltip)}">${moon}</g>`;
        },
        drawLabel: null,
      });
    });

    // ----- COLLISION: place labels around fixed cores -----
    // Step 1: collect all immovable rectangles (the cores).
    const obstacles = items.map(it => it.coreBox);

    // Step 2: place labels greedily using per-item position candidates.
    // Items with drawLabel=null skip placement (sleep moons rely on color).
    const labelPlacements = items.map(it => {
      if (!it.drawLabel) return null;
      const halfW = it.labelW / 2, halfH = it.labelH / 2;
      let chosen = null;
      for (const pos of it.positions) {
        const cx = it.x + pos.dx, cy = it.y + pos.dy;
        const box = {
          x1: cx - halfW, y1: cy - halfH,
          x2: cx + halfW, y2: cy + halfH,
        };
        if (box.x1 < 2 || box.x2 > mW - 2 || box.y1 < 2 || box.y2 > mH - 2) continue;
        let bad = false;
        for (const o of obstacles) {
          if (overlaps(box, o, 3)) { bad = true; break; }
        }
        if (!bad) { chosen = { cx, cy, box, pos }; break; }
      }
      // Fallback: use the first preferred position even if it overlaps.
      if (!chosen) {
        const pos = it.positions[0];
        const cx = it.x + pos.dx, cy = it.y + pos.dy;
        chosen = {
          cx, cy,
          box: { x1: cx - halfW, y1: cy - halfH, x2: cx + halfW, y2: cy + halfH },
          pos,
        };
      }
      obstacles.push(chosen.box);
      return chosen;
    });

    // ----- DRAW: cores first, then leader lines, then labels -----
    items.forEach((it) => {
      inner += it.drawCore();
    });
    items.forEach((it, i) => {
      const lp = labelPlacements[i];
      if (!lp) return;
      // Draw a thin leader line if the label is far from the core
      const dist = Math.hypot(lp.pos.dx, lp.pos.dy);
      if (dist > 24) {
        const nx = Math.max(lp.box.x1, Math.min(it.x, lp.box.x2));
        const ny = Math.max(lp.box.y1, Math.min(it.y, lp.box.y2));
        inner += `<line x1="${it.x}" y1="${it.y}" x2="${nx}" y2="${ny}" stroke="#c9dfd2" stroke-width="0.8" stroke-dasharray="2,2"/>`;
      }
    });
    items.forEach((it, i) => {
      const lp = labelPlacements[i];
      if (!lp) return;
      inner += it.drawLabel(lp.cx, lp.cy);
    });

    // ===== Color scale legend (bottom-left) =====
    const lgX = 30, lgY = mH - 25;
    const samples = 40;
    if (mode === "temp") {
      for (let i = 0; i < samples; i++) {
        const t = 35 + (50 * i) / (samples - 1);
        inner += `<rect x="${lgX + i * 4}" y="${lgY}" width="4" height="10" fill="${tempColor(t)}"/>`;
      }
      const loRaw = 35, hiRaw = 85;
      const loLab = currentUnit === "C" ? Math.round(fToC(loRaw)) : loRaw;
      const hiLab = currentUnit === "C" ? Math.round(fToC(hiRaw)) : hiRaw;
      inner += `<text x="${lgX}" y="${lgY - 4}" font-size="10" fill="#4a5a52" font-family="system-ui, sans-serif">${loLab}°${currentUnit}</text>`;
      inner += `<text x="${lgX + samples * 4}" y="${lgY - 4}" font-size="10" fill="#4a5a52" text-anchor="end" font-family="system-ui, sans-serif">${hiLab}°${currentUnit}</text>`;
    } else {
      for (let i = 0; i < samples; i++) {
        const p = (50 * i) / (samples - 1);
        inner += `<rect x="${lgX + i * 4}" y="${lgY}" width="4" height="10" fill="${rainColor(p)}"/>`;
      }
      inner += `<text x="${lgX}" y="${lgY - 4}" font-size="10" fill="#4a5a52" font-family="system-ui, sans-serif">0%</text>`;
      inner += `<text x="${lgX + samples * 4}" y="${lgY - 4}" font-size="10" fill="#4a5a52" text-anchor="end" font-family="system-ui, sans-serif">50%</text>`;
    }

    svgEl.innerHTML = inner;
  }

  let currentTempMapWhich = "early";
  let currentRainMapWhich = "early";

  function renderTempMap(which) {
    currentTempMapWhich = which;
    renderMap(document.getElementById("temp-map"), "temp", which);
  }
  function renderRainMap(which) {
    currentRainMapWhich = which;
    renderMap(document.getElementById("rain-map"), "rain", which);
  }

  renderTempMap("early");
  renderRainMap("early");

  document.querySelectorAll(".map-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const which = btn.dataset.which;
      const mode = btn.dataset.mode;
      const tabContainer = btn.parentElement;
      tabContainer.querySelectorAll(".map-tab").forEach((b) => {
        const active = b === btn;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-selected", active ? "true" : "false");
      });
      if (mode === "temp") renderTempMap(which);
      else renderRainMap(which);
    });
  });

  // ===========================================================
  // TABLES
  // ===========================================================
  function fillTempTable() {
    const tbody = document.querySelector("#temp-table tbody");
    tbody.innerHTML = "";
    stops.forEach((s) => {
      const dRaw = s.late_normal_low_f - s.early_normal_low_f;
      const cls = dRaw < -0.5 ? "cooler-late" : (dRaw > 0.5 ? "cooler-early" : "");
      const arrow = dRaw < -0.5 ? "▼" : (dRaw > 0.5 ? "▲" : "—");
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="num">${s.day}</td>
        <td>${shortName(s.label)}</td>
        <td class="num">${fmtT(s.early_normal_low_f)}</td>
        <td class="num">${fmtT(s.late_normal_low_f)}</td>
        <td class="num ${cls}">${arrow} ${fmtTDelta(dRaw)}</td>
      `;
      tbody.appendChild(tr);
    });
    const tr = document.createElement("tr");
    tr.style.borderTop = "2px solid var(--line)";
    tr.style.fontWeight = "600";
    const avgDeltaRaw = lateTempAvg - earlyTempAvg;
    tr.innerHTML = `
      <td class="num"></td>
      <td>Trip average</td>
      <td class="num">${fmtT(earlyTempAvg)}</td>
      <td class="num">${fmtT(lateTempAvg)}</td>
      <td class="num ${avgDeltaRaw < 0 ? "cooler-late" : "cooler-early"}">${fmtTDelta(avgDeltaRaw)}</td>
    `;
    tbody.appendChild(tr);
  }

  function fillRainTable() {
    const tbody = document.querySelector("#rain-table tbody");
    tbody.innerHTML = "";
    let earlySum = 0, lateSum = 0;
    stops.forEach((s) => {
      const r = rainByDay.get(s.day);
      const e = r.early_rain.wet_day_pct;
      const l = r.late_rain.wet_day_pct;
      earlySum += e; lateSum += l;
      const d = (l - e).toFixed(1);
      const dNum = parseFloat(d);
      const cls = dNum < -1 ? "drier-late" : (dNum > 1 ? "drier-early" : "");
      const arrow = dNum < -1 ? "▼" : (dNum > 1 ? "▲" : "—");
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="num">${s.day}</td>
        <td>${shortName(s.label)}</td>
        <td class="num">${e.toFixed(1)}%</td>
        <td class="num">${l.toFixed(1)}%</td>
        <td class="num ${cls}">${arrow} ${d > 0 ? "+" : ""}${d}%</td>
      `;
      tbody.appendChild(tr);
    });
    const earlyAvg = (earlySum / stops.length).toFixed(1);
    const lateAvg  = (lateSum  / stops.length).toFixed(1);
    const tr = document.createElement("tr");
    tr.style.borderTop = "2px solid var(--line)";
    tr.style.fontWeight = "600";
    const avgDelta = (lateAvg - earlyAvg).toFixed(1);
    tr.innerHTML = `
      <td class="num"></td>
      <td>Trip average</td>
      <td class="num">${earlyAvg}%</td>
      <td class="num">${lateAvg}%</td>
      <td class="num ${avgDelta < 0 ? "drier-late" : "drier-early"}">${avgDelta > 0 ? "+" : ""}${avgDelta}%</td>
    `;
    tbody.appendChild(tr);
  }

  fillTempTable();
  fillRainTable();

  // ===========================================================
  // UNIT TOGGLE
  // ===========================================================
  function applyUnitToButtons() {
    document.querySelectorAll("#unit-toggle button").forEach((b) => {
      const active = b.dataset.unit === currentUnit;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
  }
  function rerenderTempViews() {
    renderVerdict();
    renderStaticTempCaptions();
    renderTempChart();
    renderTempMap(currentTempMapWhich);
    fillTempTable();
  }
  applyUnitToButtons();
  document.querySelectorAll("#unit-toggle button").forEach((b) => {
    b.addEventListener("click", () => {
      const u = b.dataset.unit;
      if (u === currentUnit) return;
      currentUnit = u;
      writeUnitCookie(u);
      applyUnitToButtons();
      rerenderTempViews();
    });
  });

  // ===========================================================
  // IMMEDIATE TOOLTIP — fires on mousemove over any [data-tip] node
  // ===========================================================
  let tipEl = document.getElementById("map-tooltip");
  if (!tipEl) {
    tipEl = document.createElement("div");
    tipEl.id = "map-tooltip";
    tipEl.style.cssText = "position:fixed;pointer-events:none;background:#1c2a25;color:#fff;padding:5px 9px;border-radius:6px;font:600 12px/1.2 system-ui,-apple-system,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.18);opacity:0;transition:opacity 0.08s;z-index:1000;white-space:nowrap;";
    document.body.appendChild(tipEl);
  }
  function showTip(e, text) {
    tipEl.textContent = text;
    tipEl.style.opacity = "1";
    moveTip(e);
  }
  function moveTip(e) {
    // Position above-right of cursor, with a small offset; flip if too close to edge
    const pad = 14;
    let x = e.clientX + pad;
    let y = e.clientY - pad - tipEl.offsetHeight;
    if (x + tipEl.offsetWidth > window.innerWidth - 4) x = e.clientX - pad - tipEl.offsetWidth;
    if (y < 4) y = e.clientY + pad;
    tipEl.style.left = x + "px";
    tipEl.style.top = y + "px";
  }
  function hideTip() { tipEl.style.opacity = "0"; }

  document.querySelectorAll("svg.map").forEach((mapSvg) => {
    mapSvg.addEventListener("mousemove", (e) => {
      const el = e.target.closest("[data-tip]");
      if (el) {
        showTip(e, el.getAttribute("data-tip"));
      } else {
        hideTip();
      }
    });
    mapSvg.addEventListener("mouseleave", hideTip);
  });
})();
