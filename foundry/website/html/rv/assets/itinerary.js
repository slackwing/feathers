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

  // Pick which date to display in eyebrows/data-date.
  // Default to the "leaning" date set; show both dates if they differ.
  const leaning = trip.trip.leaning || "early";
  const startDates = trip.start_dates; // {early, late}

  // Expand stops: each entry covers one or more nights at the same coord.
  // For display, we keep ONE card per stop entry (multi-night collapses).
  // The starting day-of-stop and date span are derived.
  const expanded = [];
  let day = 1;
  for (const stop of trip.stops) {
    expanded.push({
      stop,
      startDay: day,
      endDay: day + stop.nights - 1,
    });
    day += stop.nights;
  }

  // Map drives by from_day for quick lookup
  const drivesByFrom = new Map(trip.drives.map(d => [d.from_day, d]));

  // ---- date helpers ----
  function dateForDay(dayNum, which) {
    // dayNum is 1-indexed; offset 0 = start date
    const start = new Date(startDates[which] + "T00:00:00");
    start.setDate(start.getDate() + (dayNum - 1));
    return start;
  }
  function shortDate(d) {
    // "Jul 6"
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  function dateRange(startD, endD) {
    if (startD.toDateString() === endD.toDateString()) return shortDate(startD);
    return `${shortDate(startD)}–${endD.getDate()}`;
  }

  // ---- render helpers ----
  function renderStopCard(entry) {
    const { stop, startDay, endDay } = entry;
    const earlyStart = dateForDay(startDay, "early");
    const earlyEnd   = dateForDay(endDay, "early");
    const earlyRange = dateRange(earlyStart, earlyEnd);

    // data-date attribute uses leaning's range for the timeline rail
    const railStart = dateForDay(startDay, leaning);
    const railEnd   = dateForDay(endDay, leaning);
    const railRange = dateRange(railStart, railEnd);

    const dayLabel = stop.nights > 1
      ? `Days ${startDay}–${endDay}`
      : `Day ${startDay}`;

    // Activities rendered as <li> items.
    const activities = (stop.activities_md || [])
      .map(line => `<li>${line}</li>`)
      .join("\n          ");

    const isArrival = stop.sleep_type === "home";
    const sectionClass = isArrival ? "stop arrival" : "stop";

    return `
    <section class="${sectionClass}" id="day-${startDay}" data-label="${escapeAttr(stop.short_name || stop.label)}" data-date="${railRange}">
      <div class="stop-header">
        <p class="stop-eyebrow">${stop.eyebrow ? stop.eyebrow : `${dayLabel} · ${earlyRange}`}</p>
        <h2>${stop.heading || stop.short_name || stop.label}</h2>
      </div>
      <div class="stop-card">
        <ul class="activities">
          ${activities}
        </ul>
      </div>
    </section>`;
  }

  function renderDriveCard(drive) {
    const earlyDate = dateForDay(drive.to_day, "early");
    const railDate  = dateForDay(drive.to_day, leaning);
    const earlyRange = shortDate(earlyDate);
    const railRange  = shortDate(railDate);
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
    const heroStart = shortDate(dateForDay(1, leaning));
    const heroEnd   = shortDate(dateForDay(lastDay, leaning));
    const startYear = dateForDay(1, leaning).getFullYear();
    const leanText = leaning === "early" ? " (leaning early)" : " (leaning late)";
    subtitle.innerHTML = `San Diego → New York City<br>${heroStart} – ${heroEnd}, ${startYear}${leanText} · <a href="weather.html" style="color:var(--accent)">weather &amp; rain analysis</a>`;
  }
})();
