// ============================================================
// Route Map V2 — see MAP_V2_MECHANICS.md
//
// Data model: assets/map.json has
//   locations[]   (real places: major | minor | sleep)
//   junctions[]   (invisible nodes ON the main route line, anchors
//                  for off-route locations)
//   route[]       (ordered list of location-ids AND junction-ids
//                  that define the main route polyline)
//   segments[]    (per edge: { from, to, minutes, summary, ... })
//
// Render rules:
//   - main route line: polyline through route[] (junctions
//     transparent, no visible kink because they sit on the line)
//   - spurs: thin line from junction to its off-route location
//   - major dot: large green, bold label
//   - minor dot: small grey, italic small grey label
//   - junction: nothing
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

  // --------------- Lookup tables ---------------
  const locationById = new Map(mapData.locations.map(l => [l.id, l]));
  const junctionById = new Map(mapData.junctions.map(j => [j.id, j]));

  function coordOf(id) {
    if (locationById.has(id)) {
      const l = locationById.get(id);
      return { lat: l.lat, lon: l.lon };
    }
    if (junctionById.has(id)) {
      const j = junctionById.get(id);
      return { lat: j.lat, lon: j.lon };
    }
    throw new Error(`Unknown id: ${id}`);
  }

  // --------------- Projection: lat/lon → km (equirectangular) ---------------
  const allPoints = [
    ...mapData.locations.map(l => [l.lat, l.lon]),
    ...mapData.junctions.map(j => [j.lat, j.lon]),
  ];
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
  // wpoints: id -> {wx, wy}
  const wpoints = new Map();
  mapData.locations.forEach(l => wpoints.set(l.id, project(l.lat, l.lon)));
  mapData.junctions.forEach(j => wpoints.set(j.id, project(j.lat, j.lon)));

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
    const h = Math.floor(min / 60);
    const m = Math.round(min - h * 60);
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
      // Add the segment cost to the accumulator (segment from route[i] to route[i+1]).
      if (i < mapData.route.length - 1) {
        const seg = segMap.get(`${mapData.route[i]}|${mapData.route[i + 1]}`);
        if (seg && seg.minutes != null) accumMin += seg.minutes;
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
  // sitting on a dot of radius dotR. Each candidate is the TOP-LEFT of the
  // label box. Order = preference: right, upper-right, upper-left, left,
  // lower-right, lower-left, above, below.
  function labelCandidates(cx, cy, w, h, dotR, pad = 4) {
    const gap = dotR + pad;
    return [
      { x: cx + gap,            y: cy - h / 2 },                  // right
      { x: cx + gap * 0.71,     y: cy - h - gap * 0.71 + h / 2 }, // upper-right
      { x: cx - w - gap * 0.71, y: cy - h - gap * 0.71 + h / 2 }, // upper-left
      { x: cx - w - gap,        y: cy - h / 2 },                  // left
      { x: cx + gap * 0.71,     y: cy + gap * 0.71 + h / 2 - h }, // lower-right
      { x: cx - w - gap * 0.71, y: cy + gap * 0.71 + h / 2 - h }, // lower-left
      { x: cx - w / 2,          y: cy - h - gap },                // above
      { x: cx - w / 2,          y: cy + gap },                    // below
    ].map(p => ({ ...p, w, h }));
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

  // --------------- Render ---------------
  function render() {
    svg.setAttribute("viewBox", `0 0 ${viewportW} ${viewportH}`);

    // Obstacles list — every fixed-position element gets a box here so
    // the label placer avoids them.
    const obstacles = [];
    // SVG fragments in z-order: stateOutlines (deepest background),
    // bgLines (route + spurs), mainObjects (dots, emojis, fixed-position
    // child labels), movableLabels (drawn last so they layer above
    // everything).
    let stateOutlines = "", bgLines = "", mainObjects = "", movableLabels = "";

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

    // ----- Main route line + spurs (background) -----
    {
      const pts = mapData.route.map(id => {
        const wp = wpoints.get(id);
        return worldToScreen(wp.x, wp.y);
      });
      const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
      bgLines += `<path d="${d}" stroke="#9bb5a8" stroke-width="2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    mapData.junctions.forEach(j => {
      const a = worldToScreen(wpoints.get(j.id).x, wpoints.get(j.id).y);
      const b = worldToScreen(wpoints.get(j.for_location).x, wpoints.get(j.for_location).y);
      const targetLoc = locationById.get(j.for_location);
      const isMajor = targetLoc && targetLoc.kind === "major";
      if (isMajor) {
        bgLines += `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="#9bb5a8" stroke-width="2"/>`;
      } else {
        bgLines += `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="#c0d4c8" stroke-width="1.5" stroke-dasharray="3,3"/>`;
      }
    });

    // ----- Hour pills (drawn before labels, register as obstacles) -----
    majorLegs.forEach(leg => {
      const a = worldToScreen(wpoints.get(leg.from).x, wpoints.get(leg.from).y);
      const b = worldToScreen(wpoints.get(leg.to).x, wpoints.get(leg.to).y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const ox = -dy / len * 14, oy = dx / len * 14;
      const lx = mx + ox, ly = my + oy;
      const label = fmtMinutes(leg.minutes);
      const pillW = label.length * 7 + 10;
      mainObjects += `<g><rect x="${(lx - pillW / 2).toFixed(1)}" y="${(ly - 9).toFixed(1)}" width="${pillW}" height="16" rx="8" fill="white" opacity="0.94" stroke="#c9dfd2" stroke-width="0.7"/><text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" font-size="11" fill="#4a5a52" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="600">${escapeXml(label)}</text></g>`;
      obstacles.push({ x: lx - pillW / 2, y: ly - 9, w: pillW, h: 16 });
    });

    // ----- Sleep spots: emoji + superscript temp (FIXED position, above-right) -----
    mapData.locations.forEach(l => {
      if (l.kind !== "sleep") return;
      const p = worldToScreen(wpoints.get(l.id).x, wpoints.get(l.id).y);
      const isHotel = l.sleep_type === "hotel";
      const emoji = isHotel ? "🏨" : "🚐";
      const insideF = (!isHotel && l.night_temp_f != null) ? outsideToInside(l.night_temp_f) : null;
      const tip = !isHotel && l.night_temp_f != null && l.predicted_date
        ? `${l.name} · ${l.predicted_date} · inside ${fmtTemp(insideF)}${window.rvTempUnit} (outside ${fmtTemp(l.night_temp_f)}${window.rvTempUnit})`
        : `${l.name}${l.predicted_date ? " · " + l.predicted_date : ""}`;
      mainObjects += `<g><title>${escapeXml(tip)}</title>`;
      mainObjects += `<text x="${p.x.toFixed(1)}" y="${(p.y + 7).toFixed(1)}" font-size="20" text-anchor="middle" style="user-select:none;">${emoji}</text>`;
      // Emoji is roughly 20px wide centered on p.x, ~24px tall above p.y+7.
      obstacles.push({ x: p.x - 10, y: p.y - 13, w: 20, h: 24 });
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
    dotMarkers.forEach(m => {
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

      const cands = labelCandidates(p.x, p.y, blockW, blockH, dotR, 4);
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

    svg.innerHTML = stateOutlines + bgLines + mainObjects + movableLabels;
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

  render();
})();
