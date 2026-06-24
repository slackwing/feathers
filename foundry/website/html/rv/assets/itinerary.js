// ============================================================
// Itinerary renderer (Phase A: editable, override-layered)
//
// Reads:
//   - assets/itinerary.json   — static seed itinerary (canonical baseline)
//   - assets/map.json         — locations, route, segments, pois
//   - /rv/api/itinerary       — DB overrides per day_id
//   - /rv/api/locations       — DB location overrides + new locations
//
// Layers DB over static; renders one card per day in the compact format:
//
//   Day N · Sunday, Jul 5 — Start → End  (3h00m)
//   <markdown body>
//
// When start == end, collapse to a single name and omit drive time.
// Logged-in users can click the pencil to edit the markdown body
// (textarea → blur saves to /rv/api/itinerary).
//
// Day-card editing here is itinerary-markdown ONLY; sleep changes and
// "add new stop" / "extend day" / etc. happen via the map (map-v2.js).
// ============================================================

(async function () {
  const target = document.getElementById("itinerary");
  if (!target) return;

  // ---- load everything in parallel ----
  const [staticItin, mapData, dbItin, dbLocs] = await Promise.all([
    fetch("assets/itinerary.json").then(r => r.json()),
    fetch("assets/map.json").then(r => r.json()),
    fetch("/rv/api/itinerary").then(r => r.ok ? r.json() : { days: [] }).catch(() => ({ days: [] })),
    fetch("/rv/api/locations").then(r => r.ok ? r.json() : { locations: [] }).catch(() => ({ locations: [] })),
  ]);

  // Expose the merged model on window so map-v2.js can use it.
  window.rvItinerary = null;
  window.rvLayered = null;

  // ============================================================
  // 1. Layer DB locations over the static catalog.
  // ============================================================
  // Result: locById/poiById maps that reflect catalog patched by DB.
  // Soft-deleted overrides fall through to catalog. Soft-deleted "new"
  // locations render with a red ❌ but stay clickable to restore.
  // ============================================================
  const catalogLocsById = new Map(mapData.locations.map(l => [l.id, l]));
  const catalogPoisById = new Map(mapData.pois.map(p => [p.id, p]));

  const dbLocsById = new Map((dbLocs.locations || []).map(l => [l.id, l]));

  // User-added (kind=="new") locations: surface to window so map-v2 can
  // render them. Includes soft-deleted ones (map-v2 chooses how to draw
  // them — typically a small red ❌).
  window.rvUserLocations = (dbLocs.locations || []).filter(l => l.kind === "new");

  function effectiveLocation(id) {
    const cat = catalogLocsById.get(id);
    const db = dbLocsById.get(id);
    if (!cat && !db) return null;
    if (cat && (!db || db.deleted_at)) {
      // No active override → use the catalog as-is.
      return { ...cat, _source: "catalog" };
    }
    if (!cat && db && db.kind === "new") {
      // Brand-new user location. Promote DB fields to top-level. We
      // synthesize the shape map-v2 expects.
      return {
        id: db.id,
        kind: "new",
        name: db.name,
        lat: db.lat,
        lon: db.lon,
        emoji: db.emoji || "",
        sleep_type: db.sleep_type || null,
        activated: db.activated,
        markdown: db.markdown || "",
        deleted_at: db.deleted_at,
        route_fraction: db.route_fraction,
        _source: "user",
      };
    }
    // Catalog + active override → merge (override non-null fields win).
    return {
      ...cat,
      name: db.name != null ? db.name : cat.name,
      lat: db.lat != null ? db.lat : cat.lat,
      lon: db.lon != null ? db.lon : cat.lon,
      sleep_type: db.sleep_type != null ? db.sleep_type : cat.sleep_type,
      emoji: db.emoji != null ? db.emoji : (cat.emoji || ""),
      markdown: db.markdown != null ? db.markdown : (cat.markdown || ""),
      activated: db.activated,
      _source: "override",
      _override: db,
    };
  }

  // Build a quick lookup of name for any id (catalog or user).
  function nameOf(id) {
    const eff = effectiveLocation(id);
    return eff ? eff.name : id;
  }

  // Day-card / timeline display name: the override's day_card_label if
  // non-blank, else the location's canonical name. The route map keeps
  // using nameOf() so the dot tooltip and the map labels stay canonical.
  function dayCardLabelOf(id) {
    const eff = effectiveLocation(id);
    if (!eff) return id;
    if (eff._override && eff._override.day_card_label && eff._override.day_card_label.trim() !== "") {
      return eff._override.day_card_label;
    }
    if (eff.day_card_label && eff.day_card_label.trim() !== "") {
      return eff.day_card_label;
    }
    return eff.name;
  }

  // ============================================================
  // 2. Layer DB itinerary over the static itinerary.
  // ============================================================
  // Each static day gets a synthetic id `static_N`. DB rows keyed by
  // `static_N` patch (sleep_loc_id, markdown). DB rows with UUID id are
  // brand-new inserted days. Final ordered list sorts by `ordinal`
  // (static day N has ordinal N*1000; inserts get midpoints).
  // ============================================================
  const dbByDayId = new Map((dbItin.days || []).map(d => [d.day_id, d]));

  // Merge static + DB. Each row keeps a reference back to its DB row (if
  // any) so we can write back via PATCH. Markdown defaults: bullet-join
  // the static notes.
  const merged = [];

  // Step 1: add all static days. If a DB row exists for static_N, layer
  // it. If a DB row exists for static_N but the SLEEP was changed or
  // markdown overridden, those fields win.
  staticItin.days.forEach((sd, idx) => {
    const dayId = `static_${sd.day}`;
    const dbRow = dbByDayId.get(dayId);
    // Compute defaults from static.
    const defaultSleep = sd.sleep;
    const defaultMarkdown = (sd.notes || []).map(n => `- ${n}`).join("\n");
    const ordinal = dbRow && dbRow.ordinal != null ? dbRow.ordinal : sd.day * 1000;
    merged.push({
      dayId,
      sleepLocId: (dbRow && dbRow.sleep_loc_id) || defaultSleep,
      markdown: (dbRow && dbRow.markdown != null) ? dbRow.markdown : defaultMarkdown,
      ordinal,
      isStatic: true,
      staticDay: sd.day,
      _dbRow: dbRow || null,
    });
  });

  // Step 2: add all DB-only (inserted) rows.
  (dbItin.days || []).forEach(dr => {
    if (dr.day_id.startsWith("static_")) return; // already handled
    merged.push({
      dayId: dr.day_id,
      sleepLocId: dr.sleep_loc_id || null,
      markdown: dr.markdown || "",
      ordinal: dr.ordinal,
      isStatic: false,
      _dbRow: dr,
    });
  });

  // Sort by ordinal; assign live day numbers (1, 2, 3, ...).
  merged.sort((a, b) => a.ordinal - b.ordinal || a.dayId.localeCompare(b.dayId));
  merged.forEach((d, i) => { d.dayNum = i + 1; });

  window.rvItinerary = merged;

  // ============================================================
  // 3. Drive-time recompute (from layered catalog).
  // ============================================================
  // Per Phase A spec: client-side recompute on every load. Walks
  // map.json's route + segments + pois with the same logic the renderer
  // uses, but always layered.
  // ============================================================
  const route = mapData.route;
  const routeIdx = new Map(route.map((r, i) => [r, i]));
  const segMap = new Map();
  mapData.segments.forEach(s => {
    if (s.raw_minutes != null) {
      segMap.set(`${s.from}|${s.to}`, s);
    }
  });
  const PAD_INTERSTATE = 1.10;
  const PAD_MOUNTAIN = 1.25;
  function paddedSeg(s) {
    if (!s || s.raw_minutes == null) return 0;
    return s.raw_minutes * (s.is_mountain ? PAD_MOUNTAIN : PAD_INTERSTATE);
  }

  // POI lookup (catalog + DB-new); resolves to {anchor, spurMinPadded}.
  function resolveSleepAnchor(sleepId) {
    if (!sleepId) return null;
    if (routeIdx.has(sleepId)) {
      return { anchor: sleepId, spurMin: 0, routeIdx: routeIdx.get(sleepId), kind: "on-route" };
    }
    // Catalog POI?
    const cp = catalogPoisById.get(sleepId);
    if (cp && cp.spur_raw_minutes != null && routeIdx.has(cp.anchor)) {
      const padded = cp.spur_raw_minutes * (cp.spur_is_mountain ? PAD_MOUNTAIN : PAD_INTERSTATE);
      return { anchor: cp.anchor, spurMin: padded, routeIdx: routeIdx.get(cp.anchor), kind: "poi" };
    }
    // User location with route_fraction? Approximate as the route node
    // closest to that fraction along the cumulative time.
    const eff = effectiveLocation(sleepId);
    if (eff && eff._source === "user" && eff.route_fraction != null) {
      // Find the route segment that contains this fraction. Compute
      // cumulative raw minutes along route, then locate the fraction.
      let cumul = 0;
      const total = mapData.total_route_raw_minutes || 1;
      const targetMins = eff.route_fraction * total;
      for (let i = 0; i < route.length - 1; i++) {
        const s = segMap.get(`${route[i]}|${route[i+1]}`);
        const min = s ? s.raw_minutes : 0;
        if (cumul + min >= targetMins || i === route.length - 2) {
          // The new stop is between route[i] and route[i+1]. We treat it
          // as if anchored to route[i] with a spur of (targetMins -
          // cumul) padded.
          const spurRaw = Math.max(0, targetMins - cumul);
          const isMtn = s && s.is_mountain;
          return {
            anchor: route[i],
            spurMin: spurRaw * (isMtn ? PAD_MOUNTAIN : PAD_INTERSTATE),
            routeIdx: i,
            kind: "user-on-route",
          };
        }
        cumul += min;
      }
    }
    return null;
  }

  function dayDriveMinutes(fromSleepId, toSleepId) {
    if (!fromSleepId || !toSleepId) return null;
    if (fromSleepId === toSleepId) return 0;
    const a = resolveSleepAnchor(fromSleepId);
    const b = resolveSleepAnchor(toSleepId);
    if (!a || !b) return null;
    let total = a.spurMin + b.spurMin;
    const i = a.routeIdx, j = b.routeIdx;
    if (i < j) {
      for (let n = i; n < j; n++) total += paddedSeg(segMap.get(`${route[n]}|${route[n+1]}`));
    } else if (i > j) {
      for (let n = i; n > j; n--) total += paddedSeg(segMap.get(`${route[n]}|${route[n-1]}`));
    }
    return total;
  }

  // Annotate each day with its drive minutes (from yesterday's sleep).
  merged.forEach((d, i) => {
    if (i === 0) { d.driveMin = null; return; }
    d.driveMin = dayDriveMinutes(merged[i-1].sleepLocId, d.sleepLocId);
  });

  // ============================================================
  // 4. Date helpers.
  // ============================================================
  const startDate = staticItin.start_date;
  function dateForDay(n) {
    const [y, m, d] = startDate.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + (n - 1)));
    return dt;
  }
  const WEEKDAY = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function formatHeader(dt) {
    return `${WEEKDAY[dt.getUTCDay()]}, ${MONTH_SHORT[dt.getUTCMonth()]} ${dt.getUTCDate()}`;
  }
  function fmtDriveMins(min) {
    if (min == null) return "";
    const r = Math.round(min);
    if (r < 60) return `${r}m`;
    const h = Math.floor(r / 60);
    const m = r - h * 60;
    return m === 0 ? `${h}h` : `${h}h${m}m`;
  }
  function shortRailDate(dt) {
    return `${MONTH_SHORT[dt.getUTCMonth()]} ${dt.getUTCDate()}`;
  }

  // ============================================================
  // 5. Minimal markdown renderer.
  // ============================================================
  // Supports: bullet lists (- foo), **bold**, *italic*, `code`,
  // [text](url), and blank-line paragraph breaks. Escapes HTML first.
  // ============================================================
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function renderInline(s) {
    let out = escapeHtml(s);
    // Bold + italic (bold first so the regex isn't ambiguous).
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return out;
  }
  function renderMarkdown(md) {
    if (!md || !md.trim()) return "";
    const lines = md.split("\n");
    let html = "";
    let inUl = false;
    let pending = [];
    function flushPara() {
      if (pending.length) {
        html += `<p>${pending.map(renderInline).join("<br>")}</p>`;
        pending = [];
      }
    }
    function closeList() {
      if (inUl) { html += "</ul>"; inUl = false; }
    }
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, "");
      if (/^\s*-\s+/.test(line)) {
        flushPara();
        if (!inUl) { html += "<ul>"; inUl = true; }
        html += `<li>${renderInline(line.replace(/^\s*-\s+/, ""))}</li>`;
      } else if (line === "") {
        closeList();
        flushPara();
      } else {
        closeList();
        pending.push(line);
      }
    }
    closeList();
    flushPara();
    return html;
  }

  // ============================================================
  // 6. Render day cards.
  // ============================================================
  let canEdit = false;

  function dayCardHTML(d, prevD) {
    const dt = dateForDay(d.dayNum);
    const startId = prevD ? prevD.sleepLocId : d.sleepLocId; // Day 1: start == sleep
    const endId = d.sleepLocId;
    const startName = dayCardLabelOf(startId);
    const endName = dayCardLabelOf(endId);
    const collapsed = startId === endId;
    const drive = d.driveMin;
    const driveStr = (!collapsed && drive != null && drive > 0) ? fmtDriveMins(drive) : "";
    let headerRight;
    if (collapsed) {
      headerRight = escapeHtml(endName);
    } else {
      headerRight = `${escapeHtml(startName)} <span class="day-arrow">→</span> ${escapeHtml(endName)}` +
                    (driveStr ? ` <span class="day-drive">${escapeHtml(driveStr)} <span class="day-drive-icon">🚐</span></span>` : "");
    }
    const railLabel = collapsed ? endName : `${startName} → ${endName}`;
    const railDate = shortRailDate(dt);
    const bodyHtml = renderMarkdown(d.markdown);
    return `
      <section class="day-card" id="day-${d.dayNum}" data-day-id="${d.dayId}" data-label="${escapeAttr(railLabel)}" data-date="${escapeAttr(railDate)}">
        <header class="day-card-header">
          <span class="day-card-num">Day ${d.dayNum}</span>
          <span class="day-card-sep">·</span>
          <span class="day-card-date">${escapeHtml(formatHeader(dt))}</span>
          <span class="day-card-sep">—</span>
          <span class="day-card-route">${headerRight}</span>
          <button type="button" class="day-card-edit" data-action="edit-markdown" aria-label="Edit notes" title="Edit notes">✏️</button>
        </header>
        <div class="day-card-body" data-empty="${bodyHtml ? "0" : "1"}">${bodyHtml || '<span class="day-card-empty">(no notes)</span>'}</div>
      </section>`;
  }
  function escapeAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function render() {
    let html = "";
    let prev = null;
    for (const d of merged) {
      html += dayCardHTML(d, prev);
      prev = d;
    }
    target.innerHTML = html;
    // (Re)build the timeline rail.
    buildTimeline();
  }

  // ---- timeline rail ----
  function buildTimeline() {
    const list = document.querySelector(".timeline-list");
    if (!list) return;
    list.innerHTML = "";
    const sections = Array.from(target.querySelectorAll(".day-card"));
    const items = sections.map((section, i) => {
      const li = document.createElement("li");
      // data-num drives the numbered circle on mobile via CSS content:attr().
      li.dataset.num = String(i + 1);
      li.innerHTML = `<span class="timeline-label">${section.dataset.label || ""}</span>` +
                     (section.dataset.date ? `<span class="timeline-date">${section.dataset.date}</span>` : "");
      li.addEventListener("click", () => section.scrollIntoView({ behavior: "smooth", block: "start" }));
      list.appendChild(li);
      return { section, li };
    });
    if (window._rvTimelineObs) try { window._rvTimelineObs.disconnect(); } catch (_) {}
    window._rvTimelineObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const idx = sections.indexOf(e.target);
        if (idx < 0) return;
        items.forEach((it, i) => it.li.classList.toggle("is-active", i === idx));
      });
    }, { rootMargin: "-40% 0px -55% 0px", threshold: 0 });
    sections.forEach(s => window._rvTimelineObs.observe(s));
  }

  // ============================================================
  // 7. Edit markdown (click pencil → textarea → save).
  // ============================================================
  target.addEventListener("click", (e) => {
    if (!canEdit) return;
    const btn = e.target.closest('[data-action="edit-markdown"]');
    if (!btn) return;
    const card = btn.closest(".day-card");
    if (!card) return;
    const dayId = card.dataset.dayId;
    const day = merged.find(d => d.dayId === dayId);
    if (!day) return;
    startMarkdownEdit(card, day);
  });

  function startMarkdownEdit(card, day) {
    const body = card.querySelector(".day-card-body");
    if (!body || body.querySelector("textarea")) return;

    // Two editable fields live here:
    //   1) day_card_label for the day's SLEEP location. Defaults to the
    //      location's canonical name; if the user changes it, we PATCH
    //      the override row's day_card_label. (Editing the START name
    //      requires editing the *previous* day, because the start is
    //      derived from the prior sleep.)
    //   2) markdown body — same flow as before.
    const sleepLoc = effectiveLocation(day.sleepLocId);
    const canonicalName = sleepLoc ? sleepLoc.name : day.sleepLocId;
    const initialLabel = dayCardLabelOf(day.sleepLocId);

    body.innerHTML = "";
    const labelWrap = document.createElement("div");
    labelWrap.className = "day-card-editor-label-wrap";
    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.className = "day-card-editor-label";
    labelInput.value = initialLabel;
    labelInput.placeholder = canonicalName;
    labelInput.title = `Display label for "${canonicalName}" in day cards + timeline (leave blank to use canonical name)`;
    labelWrap.appendChild(labelInput);
    body.appendChild(labelWrap);

    const ta = document.createElement("textarea");
    ta.className = "day-card-editor";
    ta.value = day.markdown || "";
    ta.rows = Math.max(3, ta.value.split("\n").length + 1);
    body.appendChild(ta);

    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);

    let finished = false;
    async function save() {
      if (finished) return; finished = true;

      // ---- label save (only if changed AND differs from canonical) ----
      const newLabelRaw = labelInput.value.trim();
      const newLabel = newLabelRaw === canonicalName ? "" : newLabelRaw;
      const oldLabel = (sleepLoc && sleepLoc._override && sleepLoc._override.day_card_label) || "";
      if (newLabel !== oldLabel) {
        try {
          // Try PATCH first (assumes override row exists). We always
          // include `restore: true` so editing a label on a previously
          // soft-deleted override row brings it back to active —
          // otherwise the label saves but effectiveLocation() ignores
          // it because it sees the deleted_at flag.
          const patchBody = newLabel === ""
            ? { clear_day_card_label: true, restore: true }
            : { day_card_label: newLabel, restore: true };
          const r = await fetch("/rv/api/locations/" + encodeURIComponent(day.sleepLocId), {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patchBody),
          });
          if (!r.ok && r.status === 404) {
            // Override row doesn't exist yet — create it.
            await fetch("/rv/api/locations", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: day.sleepLocId,
                kind: "override",
                day_card_label: newLabel || null,
                activated: true,
              }),
            });
          }
        } catch (err) {
          alert("Saving the label failed — please refresh.");
        }
      }

      // ---- markdown save ----
      const newMd = ta.value;
      const oldMd = day.markdown || "";
      if (newMd !== oldMd) {
        day.markdown = newMd;
        try {
          const res = await fetch("/rv/api/itinerary", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              day_id: day.dayId,
              sleep_loc_id: day.sleepLocId,
              markdown: newMd,
              ordinal: day.ordinal,
            }),
          });
          if (!res.ok) throw new Error("save failed");
        } catch (err) {
          day.markdown = oldMd;
          alert("Saving notes failed — reverted.");
        }
      }

      // Re-render the body. If the label changed, do a full reload so
      // all day cards + timeline pick up the new value consistently.
      if (newLabel !== oldLabel) {
        location.reload();
        return;
      }
      body.innerHTML = renderMarkdown(day.markdown || "") || '<span class="day-card-empty">(no notes)</span>';
      body.dataset.empty = day.markdown ? "0" : "1";
    }
    function cancel() {
      if (finished) return; finished = true;
      const md = day.markdown || "";
      body.innerHTML = renderMarkdown(md) || '<span class="day-card-empty">(no notes)</span>';
      body.dataset.empty = md ? "0" : "1";
    }
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); cancel(); }
      else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); save(); }
    }
    labelInput.addEventListener("keydown", onKey);
    ta.addEventListener("keydown", onKey);
    // Save when focus leaves both fields. Track with a microtask so
    // tabbing between the two doesn't trigger a save.
    function maybeBlurSave() {
      setTimeout(() => {
        if (finished) return;
        if (document.activeElement === labelInput || document.activeElement === ta) return;
        save();
      }, 0);
    }
    labelInput.addEventListener("blur", maybeBlurSave);
    ta.addEventListener("blur", maybeBlurSave);
  }

  // ============================================================
  // 8. Auth state — toggle pencil visibility.
  // ============================================================
  function applyAuthState() {
    canEdit = !!window.rvAuthUser;
    target.classList.toggle("can-edit", canEdit);
  }
  window.addEventListener("rv:auth-resolved", applyAuthState);
  window.addEventListener("rv:auth-change", applyAuthState);
  applyAuthState();

  // ============================================================
  // 9. First render.
  // ============================================================
  render();

  // Expose helpers for map-v2.js to consume.
  window.rvLayered = {
    effectiveLocation,
    nameOf,
    dayCardLabelOf,
    merged,
    dayDriveMinutes,
    resolveSleepAnchor,
    renderMarkdown,
  };
  window.dispatchEvent(new CustomEvent("rv:itinerary-ready"));

  // ============================================================
  // 10. Update hero subtitle date range.
  // ============================================================
  const subtitle = document.querySelector(".hero-text .subtitle");
  if (subtitle) {
    const lastDay = merged.length;
    const startDt = dateForDay(1);
    const endDt = dateForDay(lastDay);
    const startStr = `${MONTH_SHORT[startDt.getUTCMonth()]} ${startDt.getUTCDate()}`;
    const endStr = `${MONTH_SHORT[endDt.getUTCMonth()]} ${endDt.getUTCDate()}`;
    const yr = startDt.getUTCFullYear();
    subtitle.innerHTML = `San Diego → New York City<br>${startStr} – ${endStr}, ${yr}<span class="prep-link-wrap"> · <a href="prep.html" class="prep-link" style="color:var(--accent)">checklists!</a></span>`;
  }
})();
