// ============================================================
// Route Map V2 (data v3) — see MAP_V2_MECHANICS.md
//
// Data model: assets/map.json (version 3) has
//   locations[]   (real places: major | minor | sleep — all coords)
//   route[]       (ordered route-node ids defining the main polyline;
//                  hand-crafted highway geometry, no auto junctions)
//   segments[]    (per main-route edge: { from, to, raw_minutes,
//                  summary, is_mountain, distance_mi })
//   pois[]        (off-route locations w/ anchor metadata: each POI
//                  has anchor=nearest route-node id, anchor_distance_mi,
//                  spur_raw_minutes, spur_distance_mi, spur_summary,
//                  spur_is_mountain, kind)
//
// Render rules:
//   - main route line: polyline through route[] node coords (clean,
//     no kinks for sleeps — they're POIs, not in route)
//   - spurs: thin line from POI anchor to POI true coords
//   - major dot: large green, bold label
//   - minor dot: small grey, italic small grey label
//   - sleep: 🚐 emoji at real coords, fixed screen size on zoom
//   - hour pills: one per major→major leg, sum of main-route
//     segments between the two majors (NOT spurs)
//
// Pan/zoom mechanics (Q6/Q7/Q9):
//   - drag-pan, wheel-zoom-toward-cursor
//   - pinch-zoom (touch) + double-click/double-tap zoom in
//   - all dots/labels/emojis fixed screen size; only route geometry
//     positions move with zoom
//   - desktop: fit-to-viewport default
//   - mobile (TODO): full-width with horizontal scroll
// ============================================================

(async function () {
  const viewport = document.getElementById("route-map-v2-viewport");
  const svg = document.getElementById("route-map-v2-svg");
  if (!viewport || !svg) return;

  // ---------- Temp unit comes from window.rvTempUnit (set by site-unit.js) ----------
  const fToC = f => (Number(f) - 32) * 5 / 9;
  // Outside → inside-RV adjustment. Sleep-foundation-cited research +
  // RV-specific lore: inside runs 10–20°F warmer than outside lows for the
  // first half of the night (heat soak + body heat in a small sealed cabin).
  // We use +15°F as the midpoint estimate.
  const OUTSIDE_TO_INSIDE_F = 15;
  function outsideToInside(f) { return f + OUTSIDE_TO_INSIDE_F; }
  function fmtTemp(f) {
    if (f == null) return "?";
    const v = window.rvTempUnit === "C" ? fToC(f) : f;
    return `${Math.round(v)}°`;
  }
  function fmtRain(pct) {
    if (pct == null) return "?";
    return `💧${Math.round(pct)}%`;
  }

  // ---------- Temp gradient (research-anchored, INSIDE-RV) ----------
  // Sleep Foundation / Healthline summarizing studies:
  //   Bedroom sleep sweet spot:  60–68°F (inside)
  //   Sleep degrades noticeably above ~77°F inside
  //   Falling asleep gets hard below ~60°F inside
  // We display INSIDE temperature directly now, so anchors are:
  //   Inside ≤ 60°F → blanket needed, cool end (bluish-purple)
  //   Inside ~68°F  → sweet spot, neutral
  //   Inside ≥ 77°F → struggle even with fans, warm end (red)
  function tempColorInside(inside_f) {
    if (inside_f == null) return "#4a5a52";
    const COOL = 60, WARM = 77;
    const t = Math.max(0, Math.min(1, (inside_f - COOL) / (WARM - COOL)));
    const cool = [91, 79, 196];   // bluish-purple
    const warm = [196, 58, 58];   // red
    const r = Math.round(cool[0] + (warm[0] - cool[0]) * t);
    const g = Math.round(cool[1] + (warm[1] - cool[1]) * t);
    const b = Math.round(cool[2] + (warm[2] - cool[2]) * t);
    return `rgb(${r},${g},${b})`;
  }

  const mapData = await (await fetch("assets/map.json")).json();
  let statesGeo = null;
  try {
    statesGeo = await (await fetch("assets/us-states.json")).json();
  } catch (_) { /* states layer is optional */ }
  let itinerary = null;
  try {
    itinerary = await (await fetch("assets/itinerary.json")).json();
  } catch (_) { /* itinerary layer is optional */ }

  // --------------- Lookup tables ---------------
  const locationById = new Map(mapData.locations.map(l => [l.id, l]));
  // v3: pois[] replaces junctions[]. A POI is an off-route location with
  // an anchor (route node) + spur (anchor -> POI's true coords).
  const poiById = new Map(mapData.pois.map(p => [p.id, p]));

  function coordOf(id) {
    if (locationById.has(id)) {
      const l = locationById.get(id);
      return { lat: l.lat, lon: l.lon };
    }
    throw new Error(`Unknown id: ${id}`);
  }

  // --------------- Projection: lat/lon → km (equirectangular) ---------------
  // All POIs and route nodes are in mapData.locations.
  const allPoints = mapData.locations.map(l => [l.lat, l.lon]);
  const lats = allPoints.map(p => p[0]);
  const lons = allPoints.map(p => p[1]);
  const latMin = Math.min(...lats), latMax = Math.max(...lats);
  const lonMin = Math.min(...lons), lonMax = Math.max(...lons);
  const midLat = (latMin + latMax) / 2;
  const KM_PER_DEG_LAT = 111;
  const KM_PER_DEG_LON = 111 * Math.cos(midLat * Math.PI / 180);

  function project(lat, lon) {
    return {
      x:  (lon - lonMin) * KM_PER_DEG_LON,
      y: -(lat - latMin) * KM_PER_DEG_LAT,
    };
  }

  // Pre-project all things we'll render.
  // wpoints: id -> {wx, wy}. All locations (route + POIs) live here.
  const wpoints = new Map();
  mapData.locations.forEach(l => wpoints.set(l.id, project(l.lat, l.lon)));

  // Pre-project state polygons to world-km. Each state becomes a list of
  // rings; each ring is a list of [wx, wy] pairs. Drawn as faint stroke
  // (no fill) behind everything else, so they scale/pan with the route.
  // GeoJSON coords are [lon, lat], not [lat, lon] — important.
  const statePolygons = [];  // list of rings; each ring = [[wx,wy],...]
  if (statesGeo && statesGeo.features) {
    statesGeo.features.forEach(f => {
      const t = f.geometry.type;
      const c = f.geometry.coordinates;
      const polys = (t === "Polygon") ? [c] : (t === "MultiPolygon" ? c : []);
      polys.forEach(poly => {
        poly.forEach(ring => {
          const projected = ring.map(([lon, lat]) => {
            const p = project(lat, lon);
            return [p.x, p.y];
          });
          statePolygons.push(projected);
        });
      });
    });
  }

  // World bounding box (km).
  const allWX = [...wpoints.values()].map(p => p.x);
  const allWY = [...wpoints.values()].map(p => p.y);
  const worldXMin = Math.min(...allWX);
  const worldXMax = Math.max(...allWX);
  const worldYMin = Math.min(...allWY);
  const worldYMax = Math.max(...allWY);
  const worldW = worldXMax - worldXMin;
  const worldH = worldYMax - worldYMin;

  // --------------- Pan/zoom state ---------------
  let viewportW = viewport.clientWidth;
  let viewportH = viewport.clientHeight;

  const PADDING_PX = 30;
  function fitScale() {
    const sx = (viewportW - 2 * PADDING_PX) / worldW;
    const sy = (viewportH - 2 * PADDING_PX) / worldH;
    return Math.min(sx, sy);
  }

  // Frame a subset of nodes (by id) so their bounding box fits horizontally
  // with padding, vertically centered in the viewport.
  function frameNodes(ids) {
    const pts = ids
      .map(id => wpoints.get(id))
      .filter(p => p);
    if (!pts.length) return null;
    const minX = Math.min(...pts.map(p => p.x));
    const maxX = Math.max(...pts.map(p => p.x));
    const minY = Math.min(...pts.map(p => p.y));
    const maxY = Math.max(...pts.map(p => p.y));
    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    // Fit horizontally with padding; ensure vertical also fits (clamp by sy).
    const sx = (viewportW - 2 * PADDING_PX) / spanX;
    const sy = (viewportH - 2 * PADDING_PX) / spanY;
    const s = Math.min(sx, sy);
    // Center the subset's bounding box.
    const cxWorld = (minX + maxX) / 2;
    const cyWorld = (minY + maxY) / 2;
    return {
      scale: s,
      offsetX: viewportW / 2 - (cxWorld - worldXMin) * s,
      offsetY: viewportH / 2 - (cyWorld - worldYMin) * s,
    };
  }

  function isMobile() {
    return viewportW < 760;
  }

  // Initial view: on mobile, zoom into the first leg (SD → Tucson → White
  // Sands) vertically centered. On desktop, fit the whole route.
  let scale, offsetX, offsetY;
  function setInitialView() {
    if (isMobile()) {
      const framed = frameNodes(["san_diego", "tucson", "white_sands"]);
      if (framed) {
        scale = framed.scale;
        offsetX = framed.offsetX;
        offsetY = framed.offsetY;
        return;
      }
    }
    scale = fitScale();
    offsetX = (viewportW - worldW * scale) / 2 - worldXMin * scale;
    offsetY = (viewportH - worldH * scale) / 2 - worldYMin * scale;
  }
  setInitialView();

  const MIN_SCALE_FACTOR = 1.0;
  const MAX_SCALE_FACTOR = 20.0;

  function clampScale(s) {
    // Min zoom = fit the WHOLE route, regardless of the initial framing.
    // Otherwise mobile users couldn't zoom out past the SD/Tucson view.
    const base = fitScale();
    return Math.max(base * MIN_SCALE_FACTOR, Math.min(base * MAX_SCALE_FACTOR, s));
  }

  function worldToScreen(wx, wy) {
    return {
      x: (wx - worldXMin) * scale + offsetX,
      y: (wy - worldYMin) * scale + offsetY,
    };
  }
  function screenToWorld(sx, sy) {
    return {
      wx: (sx - offsetX) / scale + worldXMin,
      wy: (sy - offsetY) / scale + worldYMin,
    };
  }

  // --------------- Time format ---------------
  function fmtMinutes(min) {
    if (min == null) return "?";
    if (min < 60) return `${Math.round(min)}m`;
    // Round to total minutes first, then split — avoids "5h60m" when
    // 359.5 rounds to 60 minutes within the hour.
    const rounded = Math.round(min);
    const h = Math.floor(rounded / 60);
    const m = rounded - h * 60;
    return m === 0 ? `${h}h` : `${h}h${m}m`;
  }

  // --------------- Pre-compute major-to-major leg sums ---------------
  // Walk route[]; each time we cross a major node, close the previous leg
  // and start a new one. The leg's "minutes" is the sum of main-route
  // segments between the two majors. Spurs are NOT in route[] so they
  // don't get summed here (correct: through-route time only).
  const majorLegs = [];
  {
    const segMap = new Map();
    mapData.segments.forEach(s => segMap.set(`${s.from}|${s.to}`, s));

    let currentMajorIdx = -1;
    let accumMin = 0;
    let accumStartMajor = null;
    for (let i = 0; i < mapData.route.length; i++) {
      const id = mapData.route[i];
      const loc = locationById.get(id);
      const isMajor = loc && loc.kind === "major";
      if (isMajor) {
        if (accumStartMajor != null) {
          majorLegs.push({
            from: accumStartMajor,
            to: id,
            minutes: accumMin,
          });
        }
        accumStartMajor = id;
        accumMin = 0;
      }
      // Add the padded segment cost to the accumulator (segment from
      // route[i] to route[i+1]). Pad at render time from raw_minutes
      // + is_mountain flag (see padFactor above).
      if (i < mapData.route.length - 1) {
        const seg = segMap.get(`${mapData.route[i]}|${mapData.route[i + 1]}`);
        if (seg && seg.raw_minutes != null) {
          accumMin += seg.raw_minutes * (seg.is_mountain ? 1.25 : 1.10);
        }
      }
    }
  }

  // --------------- Label placement helpers ---------------
  // A "box" is { x, y, w, h } in screen pixels (top-left origin).
  function boxesOverlapArea(a, b) {
    const xo = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const yo = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    return xo * yo;
  }
  // Estimate text width by character count (good enough for placement).
  function estTextWidth(s, fontSize) { return s.length * fontSize * 0.58; }

  // Candidate offsets for a label of size (w, h) around an anchor (cx, cy)
  // sitting on a dot/anchor of radius dotR. Each candidate is the TOP-LEFT
  // of the label box. We emit 8 directions (right, upper-right, upper-left,
  // left, lower-right, lower-left, above, below) at every radius in
  // `radii`, ordered preference-first. For dense maps, pass several radii
  // so the placer can push further out when the close-in slots are taken.
  function labelCandidates(cx, cy, w, h, dotR, pad = 4, radii = null) {
    const baseGap = dotR + pad;
    const rs = radii || [baseGap];
    const out = [];
    for (const gap of rs) {
      const diag = gap * 0.71;
      const dirs = [
        { x: cx + gap,             y: cy - h / 2 },                    // right
        { x: cx + diag,            y: cy - h - diag + h / 2 },         // upper-right
        { x: cx - w - diag,        y: cy - h - diag + h / 2 },         // upper-left
        { x: cx - w - gap,         y: cy - h / 2 },                    // left
        { x: cx + diag,            y: cy + diag + h / 2 - h },         // lower-right
        { x: cx - w - diag,        y: cy + diag + h / 2 - h },         // lower-left
        { x: cx - w / 2,           y: cy - h - gap },                  // above
        { x: cx - w / 2,           y: cy + gap },                      // below
      ];
      for (const d of dirs) out.push({ ...d, w, h });
    }
    return out;
  }
  function pickLeastOverlap(candidates, obstacles) {
    let best = null, bestScore = Infinity;
    for (const c of candidates) {
      // Penalty for going off-screen.
      let off = 0;
      if (c.x < 2) off += (2 - c.x) * c.h * 3;
      if (c.y < 2) off += (2 - c.y) * c.w * 3;
      if (c.x + c.w > viewportW - 2) off += (c.x + c.w - viewportW + 2) * c.h * 3;
      if (c.y + c.h > viewportH - 2) off += (c.y + c.h - viewportH + 2) * c.w * 3;
      let score = off;
      for (const o of obstacles) score += boxesOverlapArea(c, o);
      if (score < bestScore) { bestScore = score; best = c; }
      if (bestScore === 0) break;
    }
    return best;
  }

  // --------------- Per-day drive geometry (from itinerary.json) ---------------
  // For each day in the itinerary where sleep[N] != sleep[N-1], compute the
  // list of (a, b) world-coord segment endpoints the drive traverses. The
  // "Day N" label and alternating green/yellow wash hang off that geometry.
  //
  // Algorithm:
  //   1. Resolve each day's sleep id to its position in mapData.route[]
  //      (for off-route sleeps, this is the junction id which IS in route[];
  //      we also note the off-route spur for spur-coloring).
  //   2. For day N with sleep != previous, walk route[] from prev's route
  //      index to today's route index, emitting one segment per adjacent
  //      pair. Plus prepend yesterday's spur (junction -> sleep, reversed:
  //      we wake up at the off-route spot and have to come back to the
  //      junction first) and append today's spur (junction -> sleep).
  //
  // Output: dayDrives[] = [{day, segments: [[wxA,wyA,wxB,wyB], ...],
  //                          fromSleepId, toSleepId}]
  const dayDrives = [];
  if (itinerary && itinerary.days && itinerary.days.length) {
    // v3: route[] is the clean highway polyline. POIs anchor to a route
    // node; sleeping off-route costs only the spur (anchor -> POI).
    const routeIndexOf = new Map();
    mapData.route.forEach((id, i) => routeIndexOf.set(id, i));

    function resolveSleep(sleepId) {
      // Returns {routeIdx, sleepId, anchorId (route node), spurMin (pre-padded), poi}.
      if (routeIndexOf.has(sleepId)) {
        // On-route node (e.g. new_york, san_diego).
        return { routeIdx: routeIndexOf.get(sleepId), sleepId, anchorId: sleepId, spurMin: 0, poi: null };
      }
      const poi = poiById.get(sleepId);
      if (poi && routeIndexOf.has(poi.anchor) && poi.spur_raw_minutes != null) {
        const padded = poi.spur_raw_minutes * (poi.spur_is_mountain ? 1.25 : 1.10);
        return { routeIdx: routeIndexOf.get(poi.anchor), sleepId, anchorId: poi.anchor, spurMin: padded, poi };
      }
      return null;
    }

    function worldPair(idA, idB) {
      const a = wpoints.get(idA);
      const b = wpoints.get(idB);
      if (!a || !b) return null;
      return [a.x, a.y, b.x, b.y];
    }

    // RV padding factors live HERE (display time), not in the data.
    // map.json stores raw Google Directions duration + an `is_mountain`
    // flag derived from the route summary; we multiply on read so the
    // factors stay tunable without re-fetching.
    const RV_PAD_INTERSTATE = 1.10;
    const RV_PAD_MOUNTAIN = 1.25;
    function padFactor(seg) {
      return seg && seg.is_mountain ? RV_PAD_MOUNTAIN : RV_PAD_INTERSTATE;
    }

    // Quick lookup: padded main-route segment minutes by (from, to) route ids.
    const segMinutes = new Map();
    mapData.segments.forEach(s => {
      if (s.raw_minutes != null) {
        segMinutes.set(`${s.from}|${s.to}`, s.raw_minutes * padFactor(s));
      }
    });
    function getMinutes(idA, idB) {
      const k = `${idA}|${idB}`;
      if (segMinutes.has(k)) return segMinutes.get(k);
      const r = `${idB}|${idA}`;
      if (segMinutes.has(r)) return segMinutes.get(r);
      return 0;
    }

    let prev = null;
    for (const d of itinerary.days) {
      const today = resolveSleep(d.sleep);
      if (!today) { prev = today; continue; }
      if (prev && prev.sleepId === today.sleepId) {
        // Multi-day stay; no drive on this day.
        continue;
      }
      if (!prev) { prev = today; continue; } // Day 1 has no prior drive.
      const segs = [];
      let totalMin = 0;
      // Spur back from yesterday's POI to its anchor.
      if (prev.poi) {
        const p = worldPair(prev.sleepId, prev.anchorId);
        if (p) {
          segs.push(p);
          totalMin += prev.spurMin;
        }
      }
      // Walk route[] from prev anchor → today anchor (forward).
      if (prev.routeIdx < today.routeIdx) {
        for (let i = prev.routeIdx; i < today.routeIdx; i++) {
          const a = mapData.route[i], b = mapData.route[i + 1];
          const p = worldPair(a, b);
          if (p) {
            segs.push(p);
            totalMin += getMinutes(a, b);
          }
        }
      } else if (prev.routeIdx > today.routeIdx) {
        for (let i = prev.routeIdx; i > today.routeIdx; i--) {
          const a = mapData.route[i], b = mapData.route[i - 1];
          const p = worldPair(a, b);
          if (p) {
            segs.push(p);
            totalMin += getMinutes(a, b);
          }
        }
      }
      // Today's spur from anchor out to POI.
      if (today.poi) {
        const p = worldPair(today.anchorId, today.sleepId);
        if (p) {
          segs.push(p);
          totalMin += today.spurMin;
        }
      }
      dayDrives.push({
        day: d.day,
        segments: segs,
        minutes: totalMin,
        fromSleepId: prev.sleepId,
        toSleepId: today.sleepId,
      });
      prev = today;
    }
  }

  // --------------- Sleep visibility helper (shared with hit-test) ---------------
  // A deactivated sleep is hidden from the SVG when zoomed-out enough.
  // Hit-tests + cursor logic must agree with this — otherwise the user
  // can click invisible dots.
  function isSleepVisible(l) {
    if (!l || l.kind !== "sleep") return false;
    const itinSleepIds = (window.rvLayered && window.rvLayered.merged)
      ? new Set(window.rvLayered.merged.map(d => d.sleepLocId))
      : new Set();
    const eff = (window.rvLayered ? window.rvLayered.effectiveLocation(l.id) : l) || l;
    const overrideActivated = (eff._override && typeof eff._override.activated === "boolean")
      ? eff._override.activated
      : null;
    const activated = overrideActivated !== null ? overrideActivated : itinSleepIds.has(l.id);
    if (activated) return true;
    return scale >= fitScale() * 4;
  }

  // --------------- Render ---------------
  function render() {
    svg.setAttribute("viewBox", `0 0 ${viewportW} ${viewportH}`);

    // Obstacles list — every fixed-position element gets a box here so
    // the label placer avoids them.
    const obstacles = [];
    // SVG fragments in z-order: stateOutlines (deepest background),
    // dayStrokes (wide alternating green/yellow wash per drive day),
    // bgLines (route + spurs), mainObjects (dots, emojis, fixed-position
    // child labels), movableLabels (drawn last so they layer above
    // everything).
    let stateOutlines = "", dayStrokes = "", bgLines = "", mainObjects = "", movableLabels = "";

    // ----- US state outlines (faintest background, optional) -----
    if (statePolygons.length) {
      let d = "";
      for (const ring of statePolygons) {
        // Skip ring entirely if all points lie far outside viewport (cheap
        // optimization for zoomed-in views).
        let anyInside = false;
        const pts = ring.map(([wx, wy]) => {
          const sp = worldToScreen(wx, wy);
          if (sp.x >= -50 && sp.x <= viewportW + 50 && sp.y >= -50 && sp.y <= viewportH + 50) {
            anyInside = true;
          }
          return sp;
        });
        if (!anyInside) continue;
        d += pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z ";
      }
      if (d) {
        stateOutlines += `<path d="${d}" stroke="#bcd0c4" stroke-width="0.8" fill="none" stroke-linejoin="round"/>`;
      }
    }

    // ----- Day-strokes (wide alternating green/yellow under the route) -----
    // Each labeled drive day gets a wide low-opacity stroke painted as a
    // path through its segments. The "Day N" text label is DEFERRED to
    // after the main objects are placed, so its anti-collision pass can
    // dodge the dots/emojis/labels we're about to draw.
    //
    // Days with no drive (multi-day stays) produce no stroke and no
    // label — by design.
    const dayLabelsToPlace = []; // {dd, segScreen, color} — placed after mainObjects
    if (dayDrives.length) {
      const colorA = "#2f8a6e"; // page --accent (green)
      const colorB = "#e6c34a"; // warm yellow tuned for mint background
      const STROKE_W = 22;
      const STROKE_OPACITY = 0.10;

      dayDrives.forEach((dd, idx) => {
        const color = (idx % 2 === 0) ? colorA : colorB;
        const segScreen = dd.segments.map(s => [
          worldToScreen(s[0], s[1]),
          worldToScreen(s[2], s[3]),
        ]);
        if (!segScreen.length) return;
        let d = "";
        segScreen.forEach(([a, b]) => {
          d += `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${b.x.toFixed(1)} ${b.y.toFixed(1)} `;
        });
        dayStrokes += `<path d="${d.trim()}" stroke="${color}" stroke-width="${STROKE_W}" stroke-opacity="${STROKE_OPACITY}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
        dayLabelsToPlace.push({ dd, segScreen, color });
      });
    }

    // ----- Main route line + spurs (background) -----
    {
      const pts = mapData.route.map(id => {
        const wp = wpoints.get(id);
        return worldToScreen(wp.x, wp.y);
      });
      const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
      bgLines += `<path d="${d}" stroke="#9bb5a8" stroke-width="2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    // v3: spurs are POI anchor -> POI true coords. Skip:
    //  - POIs whose anchor is essentially coincident (already on-route)
    //  - "orphan" POIs: anchor too far away (>ORPHAN_THRESHOLD_MI). These
    //    render as floating dots with no spur line and no connection to
    //    the route. They're still in the catalog for future reference but
    //    not connected to the trip's through-driving path.
    const ORPHAN_THRESHOLD_MI = 25;
    mapData.pois.forEach(p => {
      if (p.anchor_distance_mi != null && p.anchor_distance_mi < 0.1) return;
      if (p.anchor_distance_mi != null && p.anchor_distance_mi > ORPHAN_THRESHOLD_MI) return;
      const anchorWP = wpoints.get(p.anchor);
      const poiWP = wpoints.get(p.id);
      if (!anchorWP || !poiWP) return;
      const a = worldToScreen(anchorWP.x, anchorWP.y);
      const b = worldToScreen(poiWP.x, poiWP.y);
      const isMajor = p.kind === "major";
      if (isMajor) {
        bgLines += `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="#9bb5a8" stroke-width="2"/>`;
      } else {
        bgLines += `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="#c0d4c8" stroke-width="1.5" stroke-dasharray="3,3"/>`;
      }
    });

    // (Drive-time pills between majors were removed 2026-06-21 — the
    // per-day stroke labels now carry the time info, e.g. "Day 3 · 4h30m".
    // majorLegs[] is still computed above for potential future use.)

    // ----- Sleep spots: emoji + superscript temp (FIXED position, above-right) -----
    // RV nights show the inside-RV temp in its gradient color.
    // Hotel nights show the WOULD-BE inside-RV temp (same calculation),
    // so the gradient color still communicates "this is what we escaped"
    // without needing strikethrough — the 🏨 emoji already tells you
    // you're not sleeping in the RV.
    // Build a set of sleep ids that are currently used in the live
    // itinerary (window.rvLayered.merged). Sleeps NOT in this set render
    // at half opacity unless their override explicitly says activated.
    const itinSleepIds = new Set(
      ((window.rvLayered && window.rvLayered.merged) || []).map(d => d.sleepLocId)
    );
    // Hide deactivated sleeps when zoomed out. Threshold ≈ "Nebraska
    // wide" (about 4x the fit-whole-route base scale).
    const fitBase = fitScale();
    const DEACTIVATED_SHOW_AT = fitBase * 4;

    mapData.locations.forEach(l => {
      if (l.kind !== "sleep") return;
      const p = worldToScreen(wpoints.get(l.id).x, wpoints.get(l.id).y);
      const isHotel = l.sleep_type === "hotel";
      // Layer DB override if available.
      const eff = (window.rvLayered ? window.rvLayered.effectiveLocation(l.id) : l) || l;
      // Deleted = hidden entirely. Data stays in the DB (deleted_at set)
      // but the map shows nothing. (Was a red ❌ briefly; user found it ugly.)
      if (eff.deleted_at) return;
      const inItin = itinSleepIds.has(l.id);
      // Activated logic: explicit override wins; otherwise default true
      // if used in itinerary, false otherwise.
      const overrideActivated = (eff._override && typeof eff._override.activated === "boolean")
        ? eff._override.activated
        : null;
      const activated = overrideActivated !== null ? overrideActivated : inItin;
      // Hide deactivated emoji until zoomed in past the threshold.
      // (isSleepVisible() exposed below so hit-tests can match.)
      if (!activated && scale < DEACTIVATED_SHOW_AT) return;
      const emoji = isHotel ? "🏨" : "🚐";
      const groupOpacity = activated ? 1.0 : 0.45;
      const insideF = l.night_temp_f != null ? outsideToInside(l.night_temp_f) : null;
      // Tooltip text differs slightly between RV and hotel.
      let tip;
      if (insideF == null) {
        tip = `${l.name}${l.predicted_date ? " · " + l.predicted_date : ""}`;
      } else if (isHotel) {
        tip = `${l.name} · ${l.predicted_date} · would-be inside ${fmtTemp(insideF)}${window.rvTempUnit} in the RV (outside ${fmtTemp(l.night_temp_f)}${window.rvTempUnit}) — that's why we're in a hotel`;
      } else {
        tip = `${l.name} · ${l.predicted_date} · inside ${fmtTemp(insideF)}${window.rvTempUnit} (outside ${fmtTemp(l.night_temp_f)}${window.rvTempUnit})`;
      }
      mainObjects += `<g opacity="${groupOpacity}"><title>${escapeXml(tip)}</title>`;
      mainObjects += `<text x="${p.x.toFixed(1)}" y="${(p.y + 7).toFixed(1)}" font-size="20" text-anchor="middle" style="user-select:none;">${emoji}</text>`;
      // Emoji is roughly 20px wide centered on p.x, ~24px tall above p.y+7.
      obstacles.push({ x: p.x - 10, y: p.y - 13, w: 20, h: 24 });
      // Gold medal sits to the LEFT of the emoji for objectively-great sleep
      // spots (free dispersed + 7000+ ft + verified 24' fit + no cautions
      // + no reservations + no gate).
      if (l.medal === "gold") {
        const mx = p.x - 13;
        const my = p.y + 7;
        mainObjects += `<text x="${mx.toFixed(1)}" y="${my.toFixed(1)}" font-size="14" text-anchor="middle" style="user-select:none;">🥇</text>`;
        obstacles.push({ x: mx - 7, y: my - 12, w: 14, h: 16 });
      }
      if (insideF != null) {
        // SUPERSCRIPT: above-right of the emoji.
        const tempStr = fmtTemp(insideF);
        const color = tempColorInside(insideF);
        const tx = p.x + 10;       // right of emoji
        const ty = p.y - 7;        // above emoji baseline
        mainObjects += `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" font-size="11" fill="${color}" font-family="system-ui, sans-serif" font-weight="700" style="paint-order:stroke;stroke:white;stroke-width:2.5;stroke-linejoin:round;">${escapeXml(tempStr)}</text>`;
        const tw = estTextWidth(tempStr, 11);
        obstacles.push({ x: tx - 1, y: ty - 10, w: tw + 2, h: 12 });
      }
      mainObjects += `</g>`;
    });

    // ----- User-added locations (kind === "new" in DB only) -----
    // Render between major and minor in size: 4.5px dot or an emoji.
    // Soft-deleted ones render as a small red ❌.
    const userLocs = (window.rvLayered && window.rvLayered.merged) ? [] : [];
    // We don't have direct access to all DB locations from here cleanly —
    // rvLayered exposes effectiveLocation by id but not "list all". Use a
    // global set instead.
    if (window.rvUserLocations) {
      window.rvUserLocations.forEach(u => {
        if (u.lat == null || u.lon == null) return;
        if (u.deleted_at) return;     // deleted = hidden entirely
        const wp = project(u.lat, u.lon);
        const p = worldToScreen(wp.x, wp.y);
        if (u.emoji) {
          mainObjects += `<g><title>${escapeXml(u.name || u.id)}</title>`;
          mainObjects += `<text x="${p.x.toFixed(1)}" y="${(p.y + 6).toFixed(1)}" font-size="18" text-anchor="middle" style="user-select:none;">${u.emoji}</text>`;
          mainObjects += `</g>`;
          obstacles.push({ x: p.x - 9, y: p.y - 12, w: 18, h: 22 });
        } else {
          mainObjects += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="#d97b3a" stroke="white" stroke-width="2"><title>${escapeXml(u.name || u.id)}</title></circle>`;
          obstacles.push({ x: p.x - 6, y: p.y - 6, w: 12, h: 12 });
        }
      });
    }

    // ----- Minor + Major dots (fixed; labels deferred) -----
    // Also: major rain droplet+pct is FIXED position (anchored under the
    // dot for now) — turning into movable could come later if needed.
    const dotMarkers = [];  // {kind, l, p, dotR}
    mapData.locations.forEach(l => {
      if (l.kind === "major") {
        const p = worldToScreen(wpoints.get(l.id).x, wpoints.get(l.id).y);
        mainObjects += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5.5" fill="#2f8a6e" stroke="white" stroke-width="2"/>`;
        obstacles.push({ x: p.x - 7.5, y: p.y - 7.5, w: 15, h: 15 });
        dotMarkers.push({ kind: "major", l, p, dotR: 7.5 });
      } else if (l.kind === "minor") {
        const p = worldToScreen(wpoints.get(l.id).x, wpoints.get(l.id).y);
        mainObjects += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="#7a8a82" stroke="white" stroke-width="1.5"/>`;
        obstacles.push({ x: p.x - 4.5, y: p.y - 4.5, w: 9, h: 9 });
        dotMarkers.push({ kind: "minor", l, p, dotR: 4.5 });
      }
    });

    // Compose the label for each major: name + (separately) the droplet + rain pct.
    // To keep collision avoidance simple, treat the major's name + rain block
    // as a SINGLE composite movable block. Width = max(nameW, rainW), stacked.
    //
    // Placement priority: majors first (most important), then days, then
    // minors. Earlier placements claim better spots; later ones dodge them.
    // (Day labels are placed in their own loop below, between major+minor.)
    const majorsFirst = dotMarkers.filter(m => m.kind === "major");
    const minorsLast  = dotMarkers.filter(m => m.kind === "minor");
    [...majorsFirst].forEach(m => {
      const { kind, l, p, dotR } = m;
      const isMajor = kind === "major";
      const nameFS = isMajor ? 13 : 10;
      const nameStr = l.name;
      const nameW = estTextWidth(nameStr, nameFS);

      let blockW = nameW;
      let blockH = nameFS + 3;
      let hasRain = false;
      let rainW = 0;
      if (isMajor && l.wet_day_pct != null) {
        hasRain = true;
        const rainStr = `${Math.round(l.wet_day_pct)}%`;
        rainW = 12 + estTextWidth(rainStr, 11); // droplet + gap + text
        blockW = Math.max(blockW, rainW);
        blockH = nameFS + 3 + 14;
      }

      const tip = isMajor && l.predicted_date && l.wet_day_pct != null
        ? `${l.name} · ${l.predicted_date} · ${fmtRain(l.wet_day_pct)} rain`
        : l.name;

      // Multiple radii so the placer can push the label outward when the
      // close-in slots are taken (same idea as the day-label placement).
      const baseGap = dotR + 4;
      const radii = [baseGap, baseGap + 10, baseGap + 22, baseGap + 38, baseGap + 60, baseGap + 90];
      const cands = labelCandidates(p.x, p.y, blockW, blockH, dotR, 4, radii);
      const chosen = pickLeastOverlap(cands, obstacles) || cands[0];

      // Reserve the chosen box.
      obstacles.push(chosen);

      // Emit name text at chosen top-left + baseline.
      const nameX = chosen.x;
      const nameY = chosen.y + nameFS;  // baseline of first line
      const nameColor = isMajor ? "#1c2a25" : "#7a8a82";
      const nameWeight = isMajor ? 700 : 400;
      const nameStyle = isMajor ? "" : "font-style:italic;";

      movableLabels += `<g><title>${escapeXml(tip)}</title>`;
      movableLabels += `<text x="${nameX.toFixed(1)}" y="${nameY.toFixed(1)}" font-size="${nameFS}" font-weight="${nameWeight}" fill="${nameColor}" font-family="system-ui, sans-serif" style="${nameStyle}paint-order:stroke;stroke:white;stroke-width:${isMajor ? 3.5 : 2.5};stroke-linejoin:round;">${escapeXml(nameStr)}</text>`;

      if (hasRain) {
        const ry = chosen.y + nameFS + 3 + 11;  // baseline of rain text
        const rainStr = `${Math.round(l.wet_day_pct)}%`;
        // Droplet shape, 8px tall.
        const dropX = chosen.x + 4, dropY = ry - 3;
        const dropPath = `M ${dropX} ${dropY - 5} C ${dropX + 4} ${dropY - 1} ${dropX + 4} ${dropY + 3} ${dropX} ${dropY + 3} C ${dropX - 4} ${dropY + 3} ${dropX - 4} ${dropY - 1} ${dropX} ${dropY - 5} Z`;
        movableLabels += `<path d="${dropPath}" fill="#4a7fa0" stroke="white" stroke-width="0.8"/>`;
        movableLabels += `<text x="${(chosen.x + 12).toFixed(1)}" y="${ry.toFixed(1)}" font-size="11" fill="#4a7fa0" font-family="system-ui,sans-serif" font-weight="600" style="paint-order:stroke;stroke:white;stroke-width:2.5;stroke-linejoin:round;">${rainStr}</text>`;
      }
      movableLabels += `</g>`;
    });

    // ----- Day-label placement (uses same labelCandidates/pickLeastOverlap as majors) -----
    // For each drive day, anchor = midpoint of the longest segment in that
    // day's geometry. Two-line label: "Day N" on top, "Hh Mm" underneath
    // (narrower box → fits in more places when zoomed in). Multiple radii
    // so the placer pushes outward when close-in spots are taken.
    let dayLabels = "";
    if (dayLabelsToPlace.length) {
      const FS_TOP = 11;     // "Day N"
      const FS_BOT = 10;     // "1h45m"
      const LINE_GAP = 2;
      // We score against the same `obstacles` array everything else uses,
      // so day labels avoid majors, minors, sleep emojis, temp labels, etc.

      // Date for Day N = start_date + (N - 1) days, formatted as "Jul 7".
      const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      function dateForDay(n) {
        if (!itinerary || !itinerary.start_date) return `Day ${n}`;
        const [y, m, d] = itinerary.start_date.split("-").map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d + (n - 1)));
        return `${MONTHS[dt.getUTCMonth()]} ${dt.getUTCDate()}`;
      }
      for (const { dd, segScreen, color } of dayLabelsToPlace) {
        const topStr = dateForDay(dd.day);
        const botStr = dd.minutes > 0 ? fmtMinutes(dd.minutes) : "";
        const blockW = Math.max(
          estTextWidth(topStr, FS_TOP),
          botStr ? estTextWidth(botStr, FS_BOT) : 0
        ) + 4;
        const blockH = botStr ? (FS_TOP + LINE_GAP + FS_BOT) : FS_TOP;

        // Anchor at midpoint of longest segment; perpendicular orientation
        // determines whether "above"/"below" candidates flip sides nicely
        // (labelCandidates' 8 directions are screen-axis-aligned, which is
        // fine for our use).
        const segByLen = [...segScreen]
          .map(([a, b]) => ({ a, b, len: Math.hypot(b.x - a.x, b.y - a.y) }))
          .sort((p, q) => q.len - p.len);
        const best = segByLen[0];
        if (!best) continue;
        const cx = (best.a.x + best.b.x) / 2;
        const cy = (best.a.y + best.b.y) / 2;
        // Treat the stroke (22 px wide → 11 px radius) as our "dot".
        const anchorR = 11;

        const baseGap = anchorR + 4;
        const radii = [baseGap, baseGap + 12, baseGap + 26, baseGap + 44, baseGap + 68, baseGap + 100];
        const cands = labelCandidates(cx, cy, blockW, blockH, anchorR, 4, radii);
        const chosen = pickLeastOverlap(cands, obstacles) || cands[0];
        obstacles.push(chosen);

        // Emit: top line is "Day N" centered at chosen top-left + half-width;
        // bottom line is "Hh Mm" beneath it.
        const tx = chosen.x + chosen.w / 2;
        const topY = chosen.y + FS_TOP;
        dayLabels += `<text x="${tx.toFixed(1)}" y="${topY.toFixed(1)}" font-size="${FS_TOP}" font-weight="700" fill="${color}" text-anchor="middle" font-family="system-ui, sans-serif" style="paint-order:stroke;stroke:white;stroke-width:3;stroke-linejoin:round;">${escapeXml(topStr)}</text>`;
        if (botStr) {
          const botY = topY + LINE_GAP + FS_BOT;
          dayLabels += `<text x="${tx.toFixed(1)}" y="${botY.toFixed(1)}" font-size="${FS_BOT}" font-weight="600" fill="${color}" text-anchor="middle" font-family="system-ui, sans-serif" style="paint-order:stroke;stroke:white;stroke-width:3;stroke-linejoin:round;">${escapeXml(botStr)}</text>`;
        }
      }
    }

    // ----- Minors placed LAST (lowest priority) -----
    // Use the exact same loop body as majors, but with minor dot markers.
    // (Earlier we filtered dotMarkers into majorsFirst + minorsLast and
    // ran only majors; this is the minors pass.)
    minorsLast.forEach(m => {
      const { kind, l, p, dotR } = m;
      const isMajor = kind === "major"; // always false here
      const nameFS = 10;
      const nameStr = l.name;
      const nameW = estTextWidth(nameStr, nameFS);
      const blockW = nameW;
      const blockH = nameFS + 3;
      const tip = l.name;
      const baseGap = dotR + 4;
      const radii = [baseGap, baseGap + 8, baseGap + 18, baseGap + 32, baseGap + 50];
      const cands = labelCandidates(p.x, p.y, blockW, blockH, dotR, 4, radii);
      const chosen = pickLeastOverlap(cands, obstacles) || cands[0];
      obstacles.push(chosen);
      const nameX = chosen.x;
      const nameY = chosen.y + nameFS;
      movableLabels += `<g><title>${escapeXml(tip)}</title>`;
      movableLabels += `<text x="${nameX.toFixed(1)}" y="${nameY.toFixed(1)}" font-size="${nameFS}" font-weight="400" fill="#7a8a82" font-family="system-ui, sans-serif" style="font-style:italic;paint-order:stroke;stroke:white;stroke-width:2.5;stroke-linejoin:round;">${escapeXml(nameStr)}</text>`;
      movableLabels += `</g>`;
    });

    svg.innerHTML = stateOutlines + dayStrokes + bgLines + mainObjects + movableLabels + dayLabels;
  }

  function escapeXml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // --------------- Pan (single-pointer drag) ---------------
  // Pointer events handle mouse + single-finger touch uniformly.
  // For multi-touch pinch, we track two active pointers and switch
  // into pinch mode.
  const activePointers = new Map(); // pointerId -> {x, y}
  let pinchState = null; // {startDist, startScale, midScreen, midWorld}

  function midpoint(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  viewport.addEventListener("pointerdown", (e) => {
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    viewport.setPointerCapture(e.pointerId);
    if (activePointers.size === 2) {
      const [p1, p2] = [...activePointers.values()];
      const rect = viewport.getBoundingClientRect();
      const midScreen = midpoint(p1, p2);
      const localMid = { x: midScreen.x - rect.left, y: midScreen.y - rect.top };
      pinchState = {
        startDist: dist(p1, p2),
        startScale: scale,
        startOffsetX: offsetX,
        startOffsetY: offsetY,
        midWorld: screenToWorld(localMid.x, localMid.y),
      };
    }
  });

  viewport.addEventListener("pointermove", (e) => {
    if (!activePointers.has(e.pointerId)) return;
    const prev = activePointers.get(e.pointerId);
    const curr = { x: e.clientX, y: e.clientY };
    activePointers.set(e.pointerId, curr);

    if (activePointers.size === 2 && pinchState) {
      // Pinch-zoom: scale relative to startDist; keep midpoint world coord stable.
      const [p1, p2] = [...activePointers.values()];
      const newDist = dist(p1, p2);
      const factor = newDist / pinchState.startDist;
      const newScale = clampScale(pinchState.startScale * factor);
      scale = newScale;
      // Recompute offset to keep midWorld under the screen midpoint.
      const rect = viewport.getBoundingClientRect();
      const midScreen = midpoint(p1, p2);
      const localMidX = midScreen.x - rect.left;
      const localMidY = midScreen.y - rect.top;
      offsetX = localMidX - (pinchState.midWorld.wx - worldXMin) * scale;
      offsetY = localMidY - (pinchState.midWorld.wy - worldYMin) * scale;
      render();
      return;
    }

    if (activePointers.size === 1) {
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      offsetX += dx;
      offsetY += dy;
      render();
    }
  });

  function endPointer(e) {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) pinchState = null;
    try { viewport.releasePointerCapture(e.pointerId); } catch (_) {}
  }
  viewport.addEventListener("pointerup", endPointer);
  viewport.addEventListener("pointercancel", endPointer);
  viewport.addEventListener("pointerleave", endPointer);

  // --------------- Wheel zoom (desktop) ---------------
  viewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const wxBefore = (cx - offsetX) / scale + worldXMin;
    const wyBefore = (cy - offsetY) / scale + worldYMin;
    const factor = Math.exp(-e.deltaY * 0.0015);
    const newScale = clampScale(scale * factor);
    if (newScale === scale) return;
    scale = newScale;
    offsetX = cx - (wxBefore - worldXMin) * scale;
    offsetY = cy - (wyBefore - worldYMin) * scale;
    render();
  }, { passive: false });

  // --------------- Double-click / double-tap zoom-in ---------------
  let lastTapTime = 0;
  let lastTapX = 0, lastTapY = 0;
  viewport.addEventListener("dblclick", (e) => {
    zoomInAt(e.clientX, e.clientY);
  });
  // Touch double-tap: detect via two pointerdowns within 300ms in the same spot.
  viewport.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch") return;
    const now = Date.now();
    if (now - lastTapTime < 300 && Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY) < 30) {
      zoomInAt(e.clientX, e.clientY);
      lastTapTime = 0;
    } else {
      lastTapTime = now;
      lastTapX = e.clientX;
      lastTapY = e.clientY;
    }
  });
  function zoomInAt(clientX, clientY) {
    const rect = viewport.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    const wxBefore = (cx - offsetX) / scale + worldXMin;
    const wyBefore = (cy - offsetY) / scale + worldYMin;
    const newScale = clampScale(scale * 1.8);
    if (newScale === scale) return;
    scale = newScale;
    offsetX = cx - (wxBefore - worldXMin) * scale;
    offsetY = cy - (wyBefore - worldYMin) * scale;
    render();
  }

  // --------------- Resize ---------------
  let pendingResize = false;
  const ro = new ResizeObserver((entries) => {
    if (pendingResize) return;
    const entry = entries[0];
    const rect = entry.contentRect;
    const newW = Math.round(rect.width);
    const newH = Math.round(rect.height);
    if (newW === viewportW && newH === viewportH) return;
    pendingResize = true;
    requestAnimationFrame(() => {
      pendingResize = false;
      viewportW = newW;
      viewportH = newH;
      setInitialView();
      render();
    });
  });
  ro.observe(viewport);

  // --------------- React to site-wide unit changes ---------------
  window.addEventListener("rv:unit-change", () => render());

  // Re-render when itinerary.js finishes layering its data, so the
  // sleep-emoji opacity (activated vs not) reflects the live itinerary.
  window.addEventListener("rv:itinerary-ready", () => render());
  // Auth state also affects modals (logged-in vs out); a re-render isn't
  // strictly required, but covers any future affordances.
  window.addEventListener("rv:auth-change", () => render());

  // ============================================================
  // Map-click modal (Phase A)
  //
  // Click anywhere on the map → categorize what was clicked:
  //   - a location dot/emoji (catalog or user) → "location" target
  //   - on/near the route line → "route" target (add new stop here)
  //   - otherwise (background) → ignored
  //
  // Modal renders context-dependent options. Sleep changes / day insertion
  // happens through this modal (NOT through the day cards). The day cards
  // are markdown-edit only.
  // ============================================================
  let lastDownX = 0, lastDownY = 0, draggedDistance = 0;
  viewport.addEventListener("pointerdown", (e) => {
    lastDownX = e.clientX; lastDownY = e.clientY; draggedDistance = 0;
  });
  viewport.addEventListener("pointermove", (e) => {
    if (activePointers.has(e.pointerId)) {
      const dx = e.clientX - lastDownX, dy = e.clientY - lastDownY;
      draggedDistance = Math.max(draggedDistance, Math.hypot(dx, dy));
    }
  });
  viewport.addEventListener("click", (e) => {
    if (draggedDistance > 5) return; // suppress click after drag/pinch
    const rect = viewport.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    handleMapClick(sx, sy);
  });

  // ---- Hover "guide dot" along the route line ----
  // When the cursor is near the route (within ROUTE_HOVER_PX) and NOT
  // near a location, show a small orange dot snapping to the nearest
  // point on the line. The dot is purely visual feedback so the user
  // knows where a click would create a new location.
  const ROUTE_HOVER_PX = 18;
  let guideDotEl = null;
  function ensureGuideDot() {
    // render() does `svg.innerHTML = ...` which detaches our circle. Detect
    // that case (parentNode null OR not in svg anymore) and re-create.
    if (guideDotEl && guideDotEl.parentNode === svg) return guideDotEl;
    guideDotEl = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    guideDotEl.setAttribute("r", "5");
    guideDotEl.setAttribute("fill", "#3a7fb3");           // blue per request
    guideDotEl.setAttribute("stroke", "white");
    guideDotEl.setAttribute("stroke-width", "1.5");
    guideDotEl.setAttribute("opacity", "0.85");
    guideDotEl.style.pointerEvents = "none";
    svg.appendChild(guideDotEl);
    return guideDotEl;
  }
  function hideGuideDot() {
    if (guideDotEl && guideDotEl.parentNode === svg) {
      guideDotEl.setAttribute("opacity", "0");
    }
  }
  viewport.addEventListener("pointermove", (e) => {
    // Only show on devices with hover (skip touch panning).
    if (activePointers.size > 0) { hideGuideDot(); viewport.style.cursor = ""; return; }
    if (e.pointerType === "touch") return;
    const rect = viewport.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const locHit = findLocationHit(sx, sy);
    const routeHit = findRouteHit(sx, sy);
    // Cursor: pointer (one finger) when anything clickable is under us.
    viewport.style.cursor = (locHit || routeHit) ? "pointer" : "";
    // Hide the guide dot whenever the cursor is already over a clickable
    // location — the user is targeting that, not a new-stop-on-the-line.
    if (locHit || !routeHit) { hideGuideDot(); return; }
    const dot = ensureGuideDot();
    dot.setAttribute("cx", routeHit.screenX.toFixed(1));
    dot.setAttribute("cy", routeHit.screenY.toFixed(1));
    dot.setAttribute("opacity", "0.85");
  });
  viewport.addEventListener("pointerleave", () => {
    hideGuideDot();
    viewport.style.cursor = "";
  });

  // Hit-test: find the closest location to (sx, sy) within HIT_RADIUS_PX.
  // Hit radius depends on what's at the location: emoji-bearing dots
  // (sleep spots + user-added emoji stops) are visually larger so they
  // get a wider hit. Plain circle dots (majors/minors) use a tighter hit.
  // Returns the single closest hit (used for cursor / single-target ops).
  function findLocationHit(sx, sy) {
    const hits = findLocationHits(sx, sy);
    return hits.length ? hits[0] : null;
  }

  // Returns ALL locations within their respective hit radii, sorted by
  // distance (closest first). When multiple things cluster (e.g., a
  // sleep emoji next to a route minor at low zoom), we want to show a
  // disambiguation prompt rather than silently picking the closest.
  function findLocationHits(sx, sy) {
    const EMOJI_HIT_PX = 22;   // sleeps / emoji user stops
    const DOT_HIT_PX = 14;     // majors + minors + non-emoji user stops
    const out = [];
    function consider(p, distPx, locOrSynthetic) {
      const d = Math.hypot(p.x - sx, p.y - sy);
      if (d <= distPx) out.push({ dist: d, loc: locOrSynthetic });
    }
    // Catalog locations.
    mapData.locations.forEach(l => {
      const w = wpoints.get(l.id);
      if (!w) return;
      const isSleep = l.kind === "sleep";
      // Skip sleeps that the renderer is hiding (deactivated + zoomed out).
      if (isSleep && !isSleepVisible(l)) return;
      // Skip locations whose override soft-deleted them — the renderer
      // hides them, so the hit-test must too.
      const eff = window.rvLayered ? window.rvLayered.effectiveLocation(l.id) : l;
      if (eff && eff.deleted_at) return;
      const p = worldToScreen(w.x, w.y);
      consider(p, isSleep ? EMOJI_HIT_PX : DOT_HIT_PX, l);
    });
    // User-added (kind="new" DB rows). Render position is project(lat,lon).
    if (window.rvUserLocations) {
      window.rvUserLocations.forEach(u => {
        if (u.lat == null || u.lon == null) return;
        if (u.deleted_at) return;   // hidden = not clickable
        const wp = project(u.lat, u.lon);
        const p = worldToScreen(wp.x, wp.y);
        const hasEmoji = !!u.emoji;
        // Synthesize a "location"-shaped object for the modal to consume.
        const synthetic = {
          id: u.id,
          kind: "new",
          name: u.name,
          lat: u.lat,
          lon: u.lon,
          emoji: u.emoji,
          markdown: u.markdown,
          _isUserLocation: true,
        };
        consider(p, hasEmoji ? EMOJI_HIT_PX : DOT_HIT_PX, synthetic);
      });
    }
    out.sort((a, b) => a.dist - b.dist);
    return out.map(h => h.loc);
  }

  // Hit-test: is (sx, sy) near the main route polyline (within ROUTE_PX)?
  // Returns { onRoute: true, segIdx, t, fraction } or null.
  function findRouteHit(sx, sy) {
    const ROUTE_PX = 18;
    const route = mapData.route;
    // Compute cumulative time-fractions along the route so we can map
    // hit to total-route fraction.
    const totalRaw = mapData.total_route_raw_minutes || 1;
    let cumul = 0;
    let best = null;
    for (let i = 0; i < route.length - 1; i++) {
      const a = wpoints.get(route[i]);
      const b = wpoints.get(route[i+1]);
      if (!a || !b) continue;
      const sa = worldToScreen(a.x, a.y);
      const sb = worldToScreen(b.x, b.y);
      const dx = sb.x - sa.x, dy = sb.y - sa.y;
      const lenSq = dx*dx + dy*dy;
      let t = 0;
      if (lenSq > 0) {
        t = ((sx - sa.x) * dx + (sy - sa.y) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
      }
      const px = sa.x + t * dx, py = sa.y + t * dy;
      const d = Math.hypot(px - sx, py - sy);
      // The cumulative time at this hit:
      const segObj = mapData.segments.find(s => s.from === route[i] && s.to === route[i+1]);
      const segRaw = segObj && segObj.raw_minutes != null ? segObj.raw_minutes : 0;
      const fracAtHit = (cumul + t * segRaw) / totalRaw;
      if (d < ROUTE_PX && (!best || d < best.dist)) {
        best = { dist: d, segIdx: i, t, fraction: fracAtHit, screenX: px, screenY: py };
      }
      cumul += segRaw;
    }
    return best;
  }

  function handleMapClick(sx, sy) {
    const locHits = findLocationHits(sx, sy);
    if (locHits.length === 1) { openLocationModal(locHits[0]); return; }
    if (locHits.length > 1) { openDisambiguationModal(locHits); return; }
    const routeHit = findRouteHit(sx, sy);
    if (routeHit) { openRouteModal(routeHit); return; }
    // background click: nothing
  }

  // Shown when a click lands within hit range of multiple locations
  // (common when zoomed out — emojis cluster). Lets the user pick one.
  function openDisambiguationModal(hits) {
    let html = `<h2 class="rv-map-modal-title"><span class="rv-map-modal-title-text">Which one?</span></h2>`;
    html += `<p class="rv-map-modal-source">${hits.length} stops here — pick one to open.</p>`;
    html += `<div class="rv-map-modal-actions" style="flex-direction:column;align-items:stretch;">`;
    hits.forEach((loc, i) => {
      const name = loc.name || loc.id;
      const kind = loc.kind || "";
      html += `<button type="button" data-pick="${i}" style="text-align:left;justify-content:flex-start;">${escapeXml(name)} <span style="color:var(--ink-soft);font-weight:400;font-size:0.85em;">· ${escapeXml(kind)}</span></button>`;
    });
    html += `</div>`;
    openModalWith(html);
    const modal = document.getElementById("rv-map-modal");
    modal.querySelector(".rv-map-modal-body").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-pick]");
      if (!btn) return;
      const idx = Number(btn.dataset.pick);
      const loc = hits[idx];
      if (loc) openLocationModal(loc);
    }, { once: true });
  }

  // ---- Modal infrastructure ----
  function ensureModal() {
    let modal = document.getElementById("rv-map-modal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "rv-map-modal";
    modal.className = "rv-map-modal-overlay";
    modal.hidden = true;
    modal.innerHTML = `<div class="rv-map-modal" role="dialog" aria-modal="true">
      <button class="rv-map-modal-close" type="button" aria-label="Close">×</button>
      <div class="rv-map-modal-body"></div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal || e.target.classList.contains("rv-map-modal-close")) {
        modal.hidden = true;
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.hidden) modal.hidden = true;
    });
    return modal;
  }
  function openModalWith(html) {
    const modal = ensureModal();
    modal.querySelector(".rv-map-modal-body").innerHTML = html;
    modal.hidden = false;
  }

  // Find which "itinerary day" walks past this location/route fraction.
  // Returns { prevDay, nextDay } from window.rvItinerary (if loaded).
  function findDayContext(routeFraction) {
    const merged = (window.rvLayered && window.rvLayered.merged) || [];
    const layered = window.rvLayered;
    if (!merged.length || !layered) return { prevDay: null, nextDay: null };
    // For each day, the sleep's route_fraction is its endpoint. Days
    // sorted by route position (which is the same as itinerary order
    // EXCEPT for backtracks — Day 5 white_sands is east of Day 6 ABQ,
    // so this approximation may misorder. Phase A: use ordinal order
    // as the source of truth for "before/after").
    // Compute each day's endpoint fraction (works for catalog POIs,
    // route nodes, and user-added stops).
    const fracs = merged.map(d => fractionFor(d.sleepLocId));
    // prevDay = last day whose fraction <= routeFraction
    let prevDay = null, nextDay = null;
    for (let i = 0; i < merged.length; i++) {
      if (fracs[i] != null && fracs[i] <= routeFraction) prevDay = merged[i];
      if (fracs[i] != null && fracs[i] > routeFraction && !nextDay) nextDay = merged[i];
    }
    return { prevDay, nextDay };
  }

  // ---- Location modal ----
  function openLocationModal(loc) {
    const layered = window.rvLayered;
    const eff = layered ? layered.effectiveLocation(loc.id) : loc;
    const merged = layered ? layered.merged : [];
    const isCurrentSleep = merged.some(d => d.sleepLocId === loc.id);
    const isSoftDeleted = eff && eff.deleted_at;
    const canEdit = !!window.rvAuthUser;

    // A location is "on the trip's walked path" if it's a route node
    // (catalog.route includes it) OR if it's a POI used as a sleep this
    // trip. For non-route, non-sleep POIs, "extend/pull/insert" all
    // semantically mean "make this the new sleep" — that's valid.
    const isRouteNode = (mapData.route || []).includes(loc.id);

    // Title gets a pencil-edit affordance to its right (always visible,
    // not hover-gated, so it stays consistent with the other "this is
    // editable" icons on the site).
    let titleHtml = `<span class="rv-map-modal-title-text">${escapeXml(eff ? eff.name : loc.name)}</span>`;
    if (canEdit) {
      titleHtml += ` <button type="button" class="rv-map-modal-title-edit" data-act="edit" aria-label="Edit properties" title="Edit properties">✏️</button>`;
    }
    let html = `<h2 class="rv-map-modal-title">${titleHtml}</h2>`;
    if (eff && eff._source) {
      html += `<p class="rv-map-modal-source">Source: ${eff._source}${isSoftDeleted ? " · deleted" : ""}</p>`;
    }
    if (eff && eff.markdown) {
      html += `<div class="rv-map-modal-md">${layered.renderMarkdown(eff.markdown)}</div>`;
    } else if (eff && eff._notes) {
      html += `<div class="rv-map-modal-md"><em>${escapeXml(eff._notes)}</em></div>`;
    }
    if (!canEdit) {
      html += `<p class="rv-map-modal-hint"><em>Log in to edit, add stops, or mark days.</em></p>`;
    } else {
      html += `<div class="rv-map-modal-actions">`;
      // Itinerary-changing actions first; soft delete + deactivate sit
      // together at the end as quieter "modify the dot" actions.
      if (isCurrentSleep) {
        // We already sleep here — only meaningful action is staying an
        // extra night (insert a duplicate day).
        html += `<button type="button" data-act="add-rest-day">sleep here (add day)</button>`;
      } else if (isRouteNode) {
        // Route node we drive through but don't sleep at. The natural
        // action is "sleep here instead" — insert a new day.
        html += `<button type="button" data-act="insert-here">sleep here (add day)</button>`;
      } else {
        // Non-route, non-sleep POI: three flavors of "make this our sleep."
        html += `<button type="button" data-act="extend-prev">extend previous day</button>`;
        html += `<button type="button" data-act="pull-next">extend next day</button>`;
        html += `<button type="button" data-act="insert-here">sleep here (add day)</button>`;
      }
      html += `<button type="button" data-act="toggle-active" class="quiet">${eff && eff.activated === false ? "activate" : "deactivate"}</button>`;
      if (isSoftDeleted) {
        html += `<button type="button" data-act="restore" class="quiet">restore</button>`;
      } else {
        html += `<button type="button" data-act="soft-delete" class="danger">delete</button>`;
      }
      html += `</div>`;
    }
    openModalWith(html);

    const modal = document.getElementById("rv-map-modal");
    modal.querySelector(".rv-map-modal-body").addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === "edit") return openEditPropertiesModal(loc);
      if (act === "toggle-active") return toggleActivated(loc, eff);
      if (act === "extend-prev") return shiftDayEndpoint(loc, "prev");
      if (act === "pull-next") return shiftDayEndpoint(loc, "next");
      if (act === "insert-here" || act === "add-rest-day") return insertDayHere(loc);
      if (act === "end-day-here") return endDayHere(loc);
      if (act === "restore") return restoreLocation(loc);
      if (act === "soft-delete") return softDeleteLocation(loc);
    }, { once: true });
  }

  function openEditPropertiesModal(loc) {
    const layered = window.rvLayered;
    const eff = layered.effectiveLocation(loc.id);
    const name = eff && eff.name != null ? eff.name : (loc.name || "");
    const emoji = (eff && eff.emoji) || "";
    const md = (eff && eff.markdown) || "";
    const html = `
      <h2 class="rv-map-modal-title">Edit ${escapeXml(loc.name)}</h2>
      <form id="rv-map-edit-form">
        <label>Name <input type="text" name="name" value="${escapeXml(name)}" required></label>
        <label>Emoji
          <span class="rv-emoji-picker" data-input="emoji">
            <button type="button" data-emoji="">none</button>
            <button type="button" data-emoji="⭐">⭐</button>
            <button type="button" data-emoji="❤️">❤️</button>
            <button type="button" data-emoji="🔍">🔍</button>
            <button type="button" data-emoji="📍">📍</button>
            <button type="button" data-emoji="☕">☕</button>
            <button type="button" data-emoji="🍴">🍴</button>
            <button type="button" data-emoji="🛍️">🛍️</button>
          </span>
          <input type="text" name="emoji" value="${escapeXml(emoji)}" placeholder="or type any emoji">
        </label>
        <label>Notes (markdown)
          <textarea name="markdown" rows="6">${escapeXml(md)}</textarea>
        </label>
        <div class="rv-map-modal-actions">
          <button type="submit">Save</button>
          <button type="button" data-act="cancel">Cancel</button>
        </div>
      </form>`;
    openModalWith(html);
    const modal = document.getElementById("rv-map-modal");
    const form = modal.querySelector("#rv-map-edit-form");
    // Emoji-picker buttons.
    form.querySelectorAll(".rv-emoji-picker button").forEach(b => {
      b.addEventListener("click", () => {
        form.elements.emoji.value = b.dataset.emoji;
      });
    });
    modal.querySelector('[data-act="cancel"]').addEventListener("click", () => { modal.hidden = true; });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = {
        id: loc.id,
        kind: "override",
        name: form.elements.name.value.trim(),
        emoji: form.elements.emoji.value,
        markdown: form.elements.markdown.value,
        activated: true,
      };
      try {
        const res = await fetch("/rv/api/locations", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          // Already exists → PATCH instead.
          if (res.status === 500 || res.status === 409) {
            const res2 = await fetch("/rv/api/locations/" + encodeURIComponent(loc.id), {
              method: "PATCH",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: body.name, emoji: body.emoji, markdown: body.markdown, activated: true }),
            });
            if (!res2.ok) throw new Error("save failed");
          } else {
            throw new Error("save failed");
          }
        }
        modal.hidden = true;
        // Reload the page — simplest way to get the layered model rebuilt.
        location.reload();
      } catch (err) {
        alert("Save failed.");
      }
    });
  }

  async function toggleActivated(loc, eff) {
    const newVal = !(eff && eff.activated !== false);
    try {
      // Try PATCH first (in case an override row exists); fall back to POST.
      const res = await fetch("/rv/api/locations/" + encodeURIComponent(loc.id), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activated: !newVal }), // wait — newVal is the desired new state
      });
      if (!res.ok && res.status === 404) {
        // No override yet → create one.
        await fetch("/rv/api/locations", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: loc.id, kind: "override", activated: !newVal }),
        });
      }
      location.reload();
    } catch (err) { alert("Toggle failed."); }
  }

  async function shiftDayEndpoint(loc, which) {
    const merged = window.rvLayered.merged;
    if (!merged.length) return;
    const frac = fractionFor(loc.id);
    const { prevDay, nextDay } = findDayContext(frac == null ? 0 : frac);
    const target = which === "prev" ? prevDay : nextDay;
    if (!target) { alert("No day to shift."); return; }
    const oldSleepName = window.rvLayered.nameOf(target.sleepLocId);
    const newSleepName = loc.name;
    const label = which === "prev" ? "previous day" : "next day";
    if (!confirm(
      `Change Day ${target.dayNum}'s sleep (${label}) from "${oldSleepName}" to "${newSleepName}"?\n\n` +
      `This will recompute drive times for that day and the following day.`
    )) return;
    try {
      await fetch("/rv/api/itinerary", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day_id: target.dayId,
          sleep_loc_id: loc.id,
          markdown: target.markdown,
          ordinal: target.ordinal,
        }),
      });
      location.reload();
    } catch (err) { alert("Shift failed."); }
  }

  // Compute route-fraction for a location. For catalog POIs the field
  // is already stored; for route nodes (kind major/minor that ARE in
  // route[]) we sum segment raw_minutes up to that node.
  function fractionFor(locId) {
    const cat = mapData.locations.find(l => l.id === locId);
    if (cat && cat.route_fraction != null) return cat.route_fraction;
    // POI?
    const poi = mapData.pois.find(p => p.id === locId);
    if (poi) {
      // The POI's anchor is a route node; use that node's fraction.
      const anchorFrac = fractionFor(poi.anchor);
      if (anchorFrac != null) return anchorFrac;
    }
    // Route node — compute cumulative from segments.
    const route = mapData.route;
    const idx = route.indexOf(locId);
    if (idx < 0) return null;
    const totalRaw = mapData.total_route_raw_minutes || 1;
    let cumul = 0;
    for (let i = 0; i < idx; i++) {
      const s = mapData.segments.find(x => x.from === route[i] && x.to === route[i+1]);
      cumul += (s && s.raw_minutes != null) ? s.raw_minutes : 0;
    }
    return cumul / totalRaw;
  }

  // "End a day here" — find the day whose walked path includes this
  // location (the day that drives THROUGH it), and change that day's
  // sleep to here. The trailing days then start from this location.
  async function endDayHere(loc) {
    const merged = window.rvLayered.merged;
    const frac = fractionFor(loc.id);
    if (frac == null) { alert("Can't determine route position."); return; }
    const { prevDay, nextDay } = findDayContext(frac);
    // The day that drives THROUGH this location is nextDay (its sleep
    // is past this point, so its drive walks past here).
    const target = nextDay;
    if (!target) { alert("No day passes through this location."); return; }
    const oldSleepName = window.rvLayered.nameOf(target.sleepLocId);
    if (!confirm(
      `End Day ${target.dayNum} at "${loc.name}" instead of "${oldSleepName}"?\n\n` +
      `This will recompute drive times for Day ${target.dayNum} and the following day.`
    )) return;
    try {
      await fetch("/rv/api/itinerary", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day_id: target.dayId,
          sleep_loc_id: loc.id,
          markdown: target.markdown,
          ordinal: target.ordinal,
        }),
      });
      location.reload();
    } catch (err) { alert("End-day failed."); }
  }

  async function insertDayHere(loc) {
    const merged = window.rvLayered.merged;
    const frac = fractionFor(loc.id);
    const { prevDay, nextDay } = findDayContext(frac == null ? 0 : frac);
    let prev = prevDay, next = nextDay;
    // If the clicked location IS already a sleep, "add rest day" means
    // duplicate that day. Find the matching day by id and insert just
    // after it (between it and whatever comes next).
    const matchingDay = merged.find(d => d.sleepLocId === loc.id);
    if (matchingDay) {
      prev = matchingDay;
      const idx = merged.indexOf(matchingDay);
      next = merged[idx + 1] || null;
    }
    if (!prev) { alert("Couldn't determine where to insert."); return; }
    // Compute ordinal: midpoint between prev and next, or prev + 500
    // if next is missing (end of trip).
    const newOrdinal = next ? (prev.ordinal + next.ordinal) / 2 : prev.ordinal + 500;
    const newId = "ins_" + Math.random().toString(36).slice(2, 10);
    const insertAfter = prev.dayNum;
    const totalDays = merged.length;
    if (!confirm(
      `Insert a new day at "${loc.name}" after Day ${insertAfter}?\n\n` +
      `All following days (currently ${insertAfter + 1}–${totalDays}) will shift back by one, ` +
      `pushing the trip-end date one day later.`
    )) return;
    try {
      await fetch("/rv/api/itinerary", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day_id: newId,
          sleep_loc_id: loc.id,
          markdown: "",
          ordinal: newOrdinal,
        }),
      });
      location.reload();
    } catch (err) { alert("Insert failed."); }
  }

  async function softDeleteLocation(loc) {
    if (!confirm(`Delete "${loc.name}"?\n\nIt will be hidden from the map. You can restore it later by clicking the ❌.`)) return;
    try {
      // Need an override row to soft-delete a catalog location. POST first
      // (idempotent enough), then DELETE.
      await fetch("/rv/api/locations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: loc.id, kind: "override", activated: true }),
      }).catch(()=>{}); // ignore conflict
      await fetch("/rv/api/locations/" + encodeURIComponent(loc.id), {
        method: "DELETE",
        credentials: "include",
      });
      location.reload();
    } catch (err) { alert("Delete failed."); }
  }
  async function restoreLocation(loc) {
    try {
      await fetch("/rv/api/locations/" + encodeURIComponent(loc.id), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore: true }),
      });
      location.reload();
    } catch (err) { alert("Restore failed."); }
  }

  // ---- Route-line click modal ----
  function openRouteModal(hit) {
    const canEdit = !!window.rvAuthUser;
    if (!canEdit) {
      openModalWith(`<h2 class="rv-map-modal-title">Add a stop here</h2><p><em>Log in to add stops.</em></p>`);
      return;
    }
    const html = `
      <h2 class="rv-map-modal-title">Add a new location here</h2>
      <p class="rv-map-modal-source">On route at ${(hit.fraction * 100).toFixed(1)}% of the trip</p>
      <form id="rv-route-new-form">
        <label>Name <input type="text" name="name" required autofocus></label>
        <label>Emoji
          <span class="rv-emoji-picker" data-input="emoji">
            <button type="button" data-emoji="">none</button>
            <button type="button" data-emoji="⭐">⭐</button>
            <button type="button" data-emoji="❤️">❤️</button>
            <button type="button" data-emoji="🔍">🔍</button>
            <button type="button" data-emoji="📍">📍</button>
            <button type="button" data-emoji="☕">☕</button>
            <button type="button" data-emoji="🍴">🍴</button>
            <button type="button" data-emoji="🛍️">🛍️</button>
          </span>
          <input type="text" name="emoji" placeholder="or type any emoji">
        </label>
        <label>Notes (markdown)<textarea name="markdown" rows="4"></textarea></label>
        <div class="rv-map-modal-actions">
          <button type="submit">Add</button>
          <button type="button" data-act="cancel">Cancel</button>
        </div>
      </form>`;
    openModalWith(html);
    const modal = document.getElementById("rv-map-modal");
    const form = modal.querySelector("#rv-route-new-form");
    form.querySelectorAll(".rv-emoji-picker button").forEach(b => {
      b.addEventListener("click", () => { form.elements.emoji.value = b.dataset.emoji; });
    });
    modal.querySelector('[data-act="cancel"]').addEventListener("click", () => { modal.hidden = true; });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      // Estimate lat/lon for the new location: linear interpolation along
      // the clicked segment in true coords.
      const route = mapData.route;
      const a = mapData.locations.find(l => l.id === route[hit.segIdx]);
      const b = mapData.locations.find(l => l.id === route[hit.segIdx + 1]);
      const lat = a.lat + (b.lat - a.lat) * hit.t;
      const lon = a.lon + (b.lon - a.lon) * hit.t;
      const id = "user_" + Math.random().toString(36).slice(2, 10);
      try {
        await fetch("/rv/api/locations", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id, kind: "new",
            name: form.elements.name.value.trim(),
            lat, lon,
            route_fraction: hit.fraction,
            emoji: form.elements.emoji.value,
            markdown: form.elements.markdown.value,
            activated: true,
          }),
        });
        location.reload();
      } catch (err) { alert("Add failed."); }
    });
  }

  render();
})();
