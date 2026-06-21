// ============================================================
// Itinerary renderer — reads trip.json and renders day cards.
// Replaces hardcoded HTML day sections. Emits the same structure
// that script.js (timeline rail) expects: .stop / .drive sections
// with data-label and data-date attributes.
// ============================================================

(async function () {
  const tripRes = await fetch("assets/trip.json");
  const trip = await tripRes.json();

  const target = document.getElementById("itinerary");
  if (!target) {
    console.error("itinerary.js: no #itinerary target element");
    return;
  }

  const startDate = trip.start_dates.early;

  // Expand stops: each entry covers one or more nights at the same coord.
  // For display, we keep ONE card per stop entry (multi-night collapses).
  // The starting day-of-stop and date span are derived.
  // Soft-deleted stops (dropped_at set) are filtered out.
  const activeStops = trip.stops.filter(s => !s.dropped_at);
  const expanded = [];
  let day = 1;
  for (const stop of activeStops) {
    expanded.push({
      stop,
      startDay: day,
      endDay: day + stop.nights - 1,
    });
    day += stop.nights;
  }

  // Map drives by from_day for quick lookup. Filter out dropped drives.
  const drivesByFrom = new Map(
    trip.drives.filter(d => !d.dropped_at).map(d => [d.from_day, d])
  );

  // ---- date helpers ----
  function dateForDay(dayNum) {
    // dayNum is 1-indexed; offset 0 = start date
    const start = new Date(startDate + "T00:00:00");
    start.setDate(start.getDate() + (dayNum - 1));
    return start;
  }
  function shortDate(d) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  function dateRange(startD, endD) {
    if (startD.toDateString() === endD.toDateString()) return shortDate(startD);
    return `${shortDate(startD)}–${endD.getDate()}`;
  }

  // ---- render helpers ----
  function renderStopCard(entry) {
    const { stop, startDay, endDay } = entry;
    const dateStart = dateForDay(startDay);
    const dateEnd   = dateForDay(endDay);
    const railRange = dateRange(dateStart, dateEnd);

    const dayLabel = stop.nights > 1
      ? `Days ${startDay}–${endDay}`
      : `Day ${startDay}`;

    // Render facts. Section-header kind → <p class="lead">; everything else
    // is an <li>. Adjacent <li>s get wrapped in a single <ul class="activities">
    // so the visual matches the pre-migration look exactly.
    //
    // Soft-deleted facts (dropped_at set) are filtered out.
    // Provenance metadata (author/confidence/pinned) is intentionally NOT
    // surfaced in the UI per the user's spec.
    const facts = (stop.facts || []).filter(f => !f.dropped_at);
    const rendered = renderFacts(facts);

    const isArrival = stop.sleep_type === "home";
    const sectionClass = isArrival ? "stop arrival" : "stop";

    return `
    <section class="${sectionClass}" id="day-${startDay}" data-label="${escapeAttr(stop.short_name || stop.label)}" data-date="${railRange}">
      <div class="stop-header">
        <p class="stop-eyebrow">${stop.eyebrow ? stop.eyebrow : `${dayLabel} · ${railRange}`}</p>
        <h2>${stop.heading || stop.short_name || stop.label}</h2>
      </div>
      <div class="stop-card">
        ${rendered}
      </div>
    </section>`;
  }

  // Render an array of facts as a sequence of <ul> blocks and section headers.
  // Section headers (kind=section_header) break the list and render as
  // <p class="lead">. Consecutive non-header facts collapse into one <ul>.
  function renderFacts(facts) {
    let out = "";
    let buffer = [];
    function flush() {
      if (buffer.length === 0) return;
      out += `<ul class="activities">\n          ${buffer.map(t => `<li>${t}</li>`).join("\n          ")}\n        </ul>\n`;
      buffer = [];
    }
    for (const f of facts) {
      if (f.kind === "section_header") {
        flush();
        out += `<p class="lead">${f.text}</p>\n`;
      } else {
        buffer.push(f.text);
      }
    }
    flush();
    return out;
  }

  function renderDriveCard(drive) {
    const railRange = shortDate(dateForDay(drive.to_day));
    return `
    <section class="drive" data-label="→ ${escapeAttr(drive.to_label)}" data-date="${railRange}">
      <div class="drive-inner">
        <span class="drive-icon">🚐</span>
        <p>${drive.notes_html}<br><span class="meta">~${drive.miles} mi · ~${drive.hours} hr · ${drive.route}</span></p>
      </div>
    </section>`;
  }

  // ---- emit alternating stop/drive structure ----
  let html = "";
  for (let i = 0; i < expanded.length; i++) {
    const entry = expanded[i];
    html += renderStopCard(entry);
    // After this stop, if there's a drive that starts on entry.endDay, render it
    const drive = drivesByFrom.get(entry.endDay);
    if (drive) {
      html += renderDriveCard(drive);
    }
  }

  target.innerHTML = html;

  // ---- helpers ----
  function escapeAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Build the timeline rail from rendered sections (replaces script.js logic
  // since we want timeline rail to depend on rendered DOM, which only exists
  // after this script runs).
  const sections = Array.from(target.querySelectorAll(".stop, .drive"));
  const timelineList = document.querySelector(".timeline-list");
  if (timelineList && sections.length > 0) {
    timelineList.innerHTML = "";
    const items = sections.map((section) => {
      const li = document.createElement("li");
      const label = section.dataset.label || "";
      const date  = section.dataset.date || "";
      li.innerHTML = `<span class="timeline-label">${label}</span>${date ? `<span class="timeline-date">${date}</span>` : ""}`;
      if (section.classList.contains("drive")) li.classList.add("is-drive");
      li.addEventListener("click", () => {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      timelineList.appendChild(li);
      return { section, li };
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const idx = sections.indexOf(entry.target);
        if (idx < 0) return;
        items.forEach((it, i) => it.li.classList.toggle("is-active", i === idx));
      });
    }, {
      rootMargin: "-40% 0px -55% 0px",
      threshold: 0,
    });
    sections.forEach((s) => observer.observe(s));
  }

  // ---- update hero subtitle with derived date range ----
  const subtitle = document.querySelector(".hero-text .subtitle");
  if (subtitle) {
    const lastDay = expanded[expanded.length - 1].endDay;
    const heroStart = shortDate(dateForDay(1));
    const heroEnd   = shortDate(dateForDay(lastDay));
    const startYear = dateForDay(1).getFullYear();
    subtitle.innerHTML = `San Diego → New York City<br>${heroStart} – ${heroEnd}, ${startYear} · <a href="weather.html" style="color:var(--accent)">weather &amp; rain analysis</a> · <a href="prep.html" style="color:var(--accent)">prep checklist</a>`;
  }
})();
