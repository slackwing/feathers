// Prep checklist — server-backed.
//
// Public read (GET /rv/api/prep). Logged-in users can:
//   - Toggle done (checkbox)
//   - Edit text inline (pencil)
//   - Delete (trash + confirm)
//   - Reorder via drag handle (SortableJS, PATCH sort_order to midpoint of neighbors)
//   - Add new item per section (form at bottom)
//
// Date syntax: write `@M/D` anywhere in the text. The renderer extracts
// it and shows a styled pill with the auto-computed day-of-week for the
// current year. Stored raw in `text` server-side.
//
// Optimistic updates with revert + toast on failure.

(async function () {
  const API_BASE = "/rv/api/prep";

  const root = document.getElementById("prep-root");
  const progressEl = document.getElementById("prep-progress");
  const loginHint = document.getElementById("prep-login-hint");
  const loginHintBtn = document.getElementById("prep-login-hint-btn");
  const toastEl = document.getElementById("prep-toast");
  if (!root) return;

  // ---- state ----
  // Sections live in the DB now (prep_section table). Frontend fetches
  // them from GET /prep alongside items. The order in `sections` is the
  // render order (server sorts by sort_order, sort_order).
  let sections = [];          // [{ id, title, sort_order, ... }]
  let items = [];             // server-truth array (sorted by section, sort_order)
  let canEdit = false;

  // ---- collapse state (localStorage) ----
  const COLLAPSE_KEY = "rv_prep_collapsed_v1";
  function loadCollapsed() {
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch (_) { return new Set(); }
  }
  function saveCollapsed(set) {
    try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...set])); } catch (_) {}
  }
  let collapsedSections = loadCollapsed();
  function isCollapsed(sectionId) { return collapsedSections.has(sectionId); }
  function toggleCollapsed(sectionId) {
    if (collapsedSections.has(sectionId)) collapsedSections.delete(sectionId);
    else collapsedSections.add(sectionId);
    saveCollapsed(collapsedSections);
  }

  // ---- toast ----
  let toastTimer = null;
  function toast(msg, ms = 2500) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("is-shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-shown"), ms);
  }

  // ---- date pill rendering ----
  // "@M/D" → { match, m, d, dow, formatted } | null
  function parseDateToken(text) {
    const m = text.match(/@(\d{1,2})\/(\d{1,2})/);
    if (!m) return null;
    const month = parseInt(m[1], 10);
    const day   = parseInt(m[2], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const year = new Date().getFullYear();
    const d = new Date(year, month - 1, day);
    if (d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    const dow = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()];
    return { match: m[0], formatted: `${dow} ${month}/${day}` };
  }

  // Strip the "@M/D" token (and the single space after, if any) from text
  // before rendering as the item label.
  function stripDateToken(text, match) {
    if (!match) return text;
    return text.replace(match + " ", "").replace(match, "").trim();
  }

  // ---- HTML helpers ----
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ---- API ----
  async function apiFetch(path, opts = {}) {
    const res = await fetch(API_BASE + path, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
      ...opts,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${res.status}: ${text || res.statusText}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  async function fetchAll() {
    const data = await apiFetch("", { method: "GET" });
    sections = (data.sections || []).slice();
    items = (data.items || []).slice();
    // Backwards-compat fallback: if the server didn't return sections
    // (pre-003 migration), reconstruct from item.section distinct values.
    if (!sections.length && items.length) {
      const seen = new Map();
      let order = 1000;
      items.forEach(it => {
        if (!seen.has(it.section)) {
          seen.set(it.section, order);
          order += 1000;
        }
      });
      sections = [...seen.entries()].map(([id, sort_order]) => ({
        id, title: id, sort_order,
      }));
    }
  }

  // ---- render ----
  function render() {
    let html = "";
    sections.forEach((section, idx) => {
      const sectionItems = items.filter(it => it.section === section.id);
      const collapsed = isCollapsed(section.id);
      const isFirst = idx === 0;
      const isLast = idx === sections.length - 1;
      html += `<div class="prep-section${collapsed ? " is-collapsed" : ""}" data-section="${section.id}">`;
      // Section header row: collapse toggle + title (+ rename/up/down/delete if editing).
      html += `<div class="prep-section-header">`;
      html += `<button type="button" class="prep-section-toggle" data-action="toggle-section" aria-label="${collapsed ? "Expand" : "Collapse"}" title="${collapsed ? "Expand" : "Collapse"}">${collapsed ? "▶" : "▼"}</button>`;
      html += `<h2 class="prep-section-title">${escapeHtml(section.title)}<span class="prep-section-count">${sectionItems.filter(it => it.done).length} / ${sectionItems.length}</span></h2>`;
      if (canEdit) {
        html += `<div class="prep-section-actions">`;
        html += `<button type="button" class="prep-action-btn" data-action="move-section-up" ${isFirst ? "disabled" : ""} aria-label="Move section up" title="Move up">↑</button>`;
        html += `<button type="button" class="prep-action-btn" data-action="move-section-down" ${isLast ? "disabled" : ""} aria-label="Move section down" title="Move down">↓</button>`;
        html += `<button type="button" class="prep-action-btn" data-action="rename-section" aria-label="Rename section" title="Rename">✏️</button>`;
        html += `<button type="button" class="prep-action-btn" data-action="delete-section" aria-label="Delete section" title="Delete section (only if empty)">🗑️</button>`;
        html += `</div>`;
      }
      html += `</div>`;
      // Body (hidden when collapsed).
      html += `<div class="prep-section-body">`;
      html += `<ul class="prep-list" data-section="${section.id}">`;
      for (const it of sectionItems) {
        html += renderItem(it);
      }
      html += `</ul>`;
      if (canEdit) {
        html += `
          <form class="prep-add" data-section="${section.id}">
            <input type="text" name="text" placeholder="Add to “${escapeHtml(section.title)}” (use @7/22 for a date)" required>
            <button type="submit">Add</button>
          </form>`;
      }
      html += `</div>`;
      html += `</div>`;
    });

    // "Add section" form at the bottom — auth only.
    if (canEdit) {
      html += `
        <form class="prep-add prep-add-section" data-action="add-section">
          <input type="text" name="title" placeholder="Add a new section…" required>
          <button type="submit">Add section</button>
        </form>`;
    }
    root.innerHTML = html;

    // Update progress.
    updateProgress();

    if (canEdit) {
      wireSortables();
    }
  }

  function renderItem(it) {
    const dt = parseDateToken(it.text);
    const labelText = dt ? stripDateToken(it.text, dt.match) : it.text;
    const cls = ["prep-item", it.done ? "is-done" : "", canEdit ? "is-editable" : ""].filter(Boolean).join(" ");
    let inner = "";
    if (canEdit) {
      inner += `<span class="prep-handle" aria-hidden="true" title="Drag to reorder">✥</span>`;
    }
    inner += `<input type="checkbox" ${it.done ? "checked" : ""} ${canEdit ? "" : "disabled"} aria-label="Mark done">`;
    inner += `<span class="prep-text-wrap">`;
    inner += `<span class="prep-text">`;
    if (dt) inner += `<span class="prep-date">${escapeHtml(dt.formatted)}</span>`;
    inner += `${escapeHtml(labelText)}</span>`;
    if (canEdit) {
      inner += `
        <span class="prep-actions">
          <button type="button" class="prep-action-btn" data-action="edit" aria-label="Edit" title="Edit">✏️</button>
          <button type="button" class="prep-action-btn" data-action="delete" aria-label="Delete" title="Delete">🗑️</button>
        </span>`;
    }
    inner += `</span>`;
    return `<li class="${cls}" data-id="${it.id}">${inner}</li>`;
  }

  // ---- SortableJS wiring ----
  let sortables = [];
  function wireSortables() {
    // Tear down any existing instances first.
    sortables.forEach(s => s.destroy());
    sortables = [];
    if (typeof Sortable === "undefined") return;
    root.querySelectorAll(".prep-list").forEach(ul => {
      sortables.push(new Sortable(ul, {
        // Only the ✥ icon initiates drag. Plain taps on the row scroll
        // the page (especially important on iPad), and taps on the
        // checkbox fire as a normal change event — no double-tap needed.
        handle: ".prep-handle",
        animation: 140,
        ghostClass: "sortable-ghost",
        chosenClass: "sortable-chosen",
        // Allow drag between the two section lists.
        group: "prep",
        onEnd: handleDragEnd,
      }));
    });
  }

  async function handleDragEnd(evt) {
    const li = evt.item;
    const id = Number(li.dataset.id);
    const ul = li.parentElement;
    const newSection = ul.dataset.section;

    // Compute new sort_order: midpoint of neighbors. If at top, half of
    // next; if at bottom, last + 1000; if alone, 1000.
    const siblings = Array.from(ul.children);
    const idx = siblings.indexOf(li);
    const prev = idx > 0 ? findItem(Number(siblings[idx - 1].dataset.id)) : null;
    const next = idx < siblings.length - 1 ? findItem(Number(siblings[idx + 1].dataset.id)) : null;
    let newSort;
    if (prev && next) newSort = (prev.sort_order + next.sort_order) / 2;
    else if (prev)   newSort = prev.sort_order + 1000;
    else if (next)   newSort = next.sort_order - 1000;
    else             newSort = 1000;

    const it = findItem(id);
    if (!it) return;
    const oldSort = it.sort_order;
    const oldSection = it.section;

    // Optimistic update.
    it.sort_order = newSort;
    it.section = newSection;
    resortItems();

    try {
      await apiFetch(`/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ sort_order: newSort, section: newSection }),
      });
    } catch (err) {
      it.sort_order = oldSort;
      it.section = oldSection;
      resortItems();
      render();
      toast("Reorder failed — reverted.");
    }
  }

  function findItem(id) { return items.find(x => x.id === id); }

  function resortItems() {
    items.sort((a, b) => {
      if (a.section !== b.section) return a.section.localeCompare(b.section);
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.id - b.id;
    });
  }

  // ---- click / change wiring ----
  root.addEventListener("change", async (e) => {
    if (e.target.type !== "checkbox") return;
    if (!canEdit) return;
    const li = e.target.closest(".prep-item");
    if (!li) return;
    const id = Number(li.dataset.id);
    const it = findItem(id);
    if (!it) return;
    const newDone = e.target.checked;
    const oldDone = it.done;
    it.done = newDone;
    li.classList.toggle("is-done", newDone);
    updateProgress();

    // Trigger celebration on check (not uncheck).
    if (newDone && !oldDone && window.rvCelebrate) {
      window.rvCelebrate();
    }

    try {
      await apiFetch(`/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ done: newDone }),
      });
    } catch (err) {
      it.done = oldDone;
      e.target.checked = oldDone;
      li.classList.toggle("is-done", oldDone);
      updateProgress();
      toast("Save failed — reverted.");
    }
  });

  root.addEventListener("click", async (e) => {
    // Section collapse toggle: works regardless of canEdit.
    const toggleBtn = e.target.closest('[data-action="toggle-section"]');
    if (toggleBtn) {
      const sectionEl = toggleBtn.closest(".prep-section");
      if (sectionEl) {
        const sid = sectionEl.dataset.section;
        toggleCollapsed(sid);
        sectionEl.classList.toggle("is-collapsed");
        // Flip the arrow + aria label.
        const collapsed = sectionEl.classList.contains("is-collapsed");
        toggleBtn.textContent = collapsed ? "▶" : "▼";
        toggleBtn.setAttribute("aria-label", collapsed ? "Expand" : "Collapse");
        toggleBtn.setAttribute("title", collapsed ? "Expand" : "Collapse");
      }
      return;
    }

    if (!canEdit) return;

    // Section-level action buttons.
    const sectionBtn = e.target.closest('.prep-section-actions .prep-action-btn');
    if (sectionBtn) {
      const sectionEl = sectionBtn.closest(".prep-section");
      const sid = sectionEl.dataset.section;
      const action = sectionBtn.dataset.action;
      if (action === "move-section-up") moveSection(sid, -1);
      else if (action === "move-section-down") moveSection(sid, +1);
      else if (action === "rename-section") renameSection(sid);
      else if (action === "delete-section") deleteSection(sid);
      return;
    }

    // Item-level action buttons.
    const btn = e.target.closest(".prep-action-btn");
    if (!btn) return;
    const li = btn.closest(".prep-item");
    if (!li) return;
    const id = Number(li.dataset.id);
    const action = btn.dataset.action;
    if (action === "edit") startEdit(li, id);
    else if (action === "delete") confirmDelete(li, id);
  });

  // ---- section operations ----

  async function moveSection(sectionId, direction) {
    const idx = sections.findIndex(s => s.id === sectionId);
    if (idx < 0) return;
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sections.length) return;
    // New sort_order = midpoint between neighbors. Simplest: swap with neighbor.
    const a = sections[idx];
    const b = sections[swapIdx];
    const aOldSort = a.sort_order;
    const bOldSort = b.sort_order;
    // Optimistic swap.
    a.sort_order = bOldSort;
    b.sort_order = aOldSort;
    sections.sort((x, y) => x.sort_order - y.sort_order || x.id.localeCompare(y.id));
    render();
    try {
      await Promise.all([
        apiFetch(`/sections/${a.id}`, { method: "PATCH", body: JSON.stringify({ sort_order: a.sort_order }) }),
        apiFetch(`/sections/${b.id}`, { method: "PATCH", body: JSON.stringify({ sort_order: b.sort_order }) }),
      ]);
    } catch (err) {
      // Revert.
      a.sort_order = aOldSort;
      b.sort_order = bOldSort;
      sections.sort((x, y) => x.sort_order - y.sort_order || x.id.localeCompare(y.id));
      render();
      toast("Reorder failed — reverted.");
    }
  }

  async function renameSection(sectionId) {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;
    const newTitle = prompt("Rename section:", sec.title);
    if (!newTitle || newTitle.trim() === "" || newTitle.trim() === sec.title) return;
    const oldTitle = sec.title;
    sec.title = newTitle.trim();
    render();
    try {
      await apiFetch(`/sections/${sec.id}`, { method: "PATCH", body: JSON.stringify({ title: sec.title }) });
    } catch (err) {
      sec.title = oldTitle;
      render();
      toast("Rename failed — reverted.");
    }
  }

  async function deleteSection(sectionId) {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;
    const itemCount = items.filter(it => it.section === sectionId).length;
    if (itemCount > 0) {
      alert(`Can't delete "${sec.title}" — it has ${itemCount} item(s). Move or delete those first.`);
      return;
    }
    if (!confirm(`Delete section "${sec.title}"?`)) return;
    const oldSections = sections.slice();
    sections = sections.filter(s => s.id !== sectionId);
    render();
    try {
      await apiFetch(`/sections/${sectionId}`, { method: "DELETE" });
    } catch (err) {
      sections = oldSections;
      render();
      toast("Delete failed — reverted.");
    }
  }

  function slugifySection(title) {
    const slug = title.toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40);
    return slug || `section_${Date.now()}`;
  }

  function startEdit(li, id) {
    const it = findItem(id);
    if (!it) return;
    const wrap = li.querySelector(".prep-text-wrap");
    if (!wrap) return;
    // Replace the text span with an input prefilled with the raw text
    // (including any @M/D token, so the user can edit it).
    const input = document.createElement("input");
    input.type = "text";
    input.className = "prep-edit-input";
    input.value = it.text;
    const actions = wrap.querySelector(".prep-actions");
    wrap.innerHTML = "";
    wrap.appendChild(input);
    if (actions) wrap.appendChild(actions);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);

    let finished = false;
    async function save() {
      if (finished) return; finished = true;
      const newText = input.value.trim();
      if (!newText) { cancel(); return; }
      if (newText === it.text) { rerender(); return; }
      const oldText = it.text;
      it.text = newText;
      try {
        await apiFetch(`/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ text: newText }),
        });
        rerender();
      } catch (err) {
        it.text = oldText;
        rerender();
        toast("Save failed — reverted.");
      }
    }
    function cancel() {
      if (finished) return; finished = true;
      rerender();
    }
    function rerender() {
      // Replace just this li in place so we don't lose scroll position.
      const fresh = document.createElement("div");
      fresh.innerHTML = renderItem(it);
      li.replaceWith(fresh.firstElementChild);
    }
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); save(); }
      else if (e.key === "Escape") { e.preventDefault(); cancel(); }
    });
    input.addEventListener("blur", save);
  }

  async function confirmDelete(li, id) {
    const it = findItem(id);
    if (!it) return;
    if (!confirm(`Delete this item?\n\n"${it.text}"`)) return;
    // Optimistic remove.
    const oldItems = items.slice();
    items = items.filter(x => x.id !== id);
    li.remove();
    updateProgress();
    try {
      await apiFetch(`/${id}`, { method: "DELETE" });
    } catch (err) {
      items = oldItems;
      render();
      toast("Delete failed — reverted.");
    }
  }

  root.addEventListener("submit", async (e) => {
    if (!e.target.classList.contains("prep-add")) return;
    e.preventDefault();
    if (!canEdit) return;

    // Branch: "Add a new section" form.
    if (e.target.dataset.action === "add-section") {
      const input = e.target.querySelector('input[name="title"]');
      const title = input.value.trim();
      if (!title) return;
      const id = slugifySection(title);
      // Avoid id collisions: if taken, append a number.
      let finalId = id;
      let n = 2;
      while (sections.some(s => s.id === finalId)) {
        finalId = `${id}_${n++}`;
      }
      const lastSort = sections.length ? sections[sections.length - 1].sort_order : 0;
      const sort_order = lastSort + 1000;
      try {
        const created = await apiFetch("/sections", {
          method: "POST",
          body: JSON.stringify({ id: finalId, title, sort_order }),
        });
        sections.push(created);
        sections.sort((x, y) => x.sort_order - y.sort_order || x.id.localeCompare(y.id));
        render();
      } catch (err) {
        toast("Add section failed.");
      }
      return;
    }

    // Default: "Add item" form within a section.
    const section = e.target.dataset.section;
    const input = e.target.querySelector('input[name="text"]');
    const text = input.value.trim();
    if (!text) return;
    // Compute sort_order: last item in this section + 1000.
    const inSection = items.filter(x => x.section === section);
    const lastSort = inSection.length ? inSection[inSection.length - 1].sort_order : 0;
    const sort_order = lastSort + 1000;
    try {
      const created = await apiFetch("", {
        method: "POST",
        body: JSON.stringify({ section, text, sort_order }),
      });
      items.push(created);
      resortItems();
      render();
    } catch (err) {
      toast("Add failed.");
    }
  });

  function updateProgress() {
    const total = items.length;
    const done = items.filter(it => it.done).length;
    progressEl.textContent = `${done} / ${total} done`;
    // Per-section counts in the header.
    sections.forEach(section => {
      const sectionItems = items.filter(it => it.section === section.id);
      const sDone = sectionItems.filter(it => it.done).length;
      const countEl = root.querySelector(`.prep-section[data-section="${section.id}"] .prep-section-count`);
      if (countEl) countEl.textContent = `${sDone} / ${sectionItems.length}`;
    });
  }

  // ---- auth state ----
  function applyAuthState() {
    canEdit = !!window.rvAuthUser;
    if (loginHint) loginHint.hidden = canEdit;
    render();
  }
  if (loginHintBtn) {
    loginHintBtn.addEventListener("click", () => {
      if (typeof window.rvOpenLoginModal === "function") window.rvOpenLoginModal();
    });
  }
  window.addEventListener("rv:auth-resolved", applyAuthState);
  window.addEventListener("rv:auth-change", applyAuthState);

  // ---- initial load ----
  try {
    await fetchAll();
  } catch (err) {
    progressEl.textContent = "Failed to load checklist.";
    return;
  }
  // Render once now; auth might still be resolving but the public read
  // already worked. applyAuthState will re-render with edit affordances
  // when auth resolves.
  if (window.rvAuthResolved) applyAuthState();
  else render();
})();
