// RV life achievements widget.
//
// Reads the "rv life achievements" section from /rv/api/prep (the
// same DB rows the checklist page uses) and renders each item as an
// achievement card. Logged-in users get a "Mark as Achieved!" button
// on hover / tap that PATCHes the item to done=true through the same
// endpoint. Everyone can view.

(function () {
  const PREP_URL = "/rv/api/prep";
  const SECTION_ID = "rv_life_achievements_courtesy_of_kat_nic";

  const gridEl = document.getElementById("ach-grid");
  const progressEl = document.getElementById("ach-progress");
  if (!gridEl) return;

  // Emoji per item id — chosen to fit the vibe of each achievement.
  // Ids come from the prep DB and are stable across renames of the
  // display text, so this map keeps working when text is edited.
  const EMOJI_BY_ID = {
    146: "🗄️",   // Drawer Madness
    147: "🔄",   // Maneuver
    148: "🚔",   // Knock
    149: "💡",   // Dashboard Light Scare
    150: "🛌",   // Compartment Carriage
    160: "👣",   // Learning the Van (foot-towel-as-face-towel)
    151: "🏖️",   // Dune
    152: "🍺",   // Law Breaker
    153: "🎫",   // Risk Taker
    154: "🌄",   // View
    155: "🌅",   // Surprise
    156: "🥵",   // Heat
    157: "🚽",   // Number One Problem
    158: "💦",   // Foot Soak
    159: "🥱",   // Morning Run (PJs / just woke up)
  };
  const DEFAULT_EMOJI = "🎯";

  let items = [];
  let canEdit = false;

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Parse "**Title** - Description" — the shape every row uses.
  // Falls back to (text, "") if the pattern isn't matched.
  function splitItemText(text) {
    const m = String(text || "").match(/^\*\*(.+?)\*\*\s*[-–—]\s*(.+)$/s);
    if (!m) return { title: text || "", desc: "" };
    return { title: m[1].trim(), desc: m[2].trim() };
  }

  // ----- Auth wiring -----
  function applyAuthUI() {
    canEdit = !!window.rvAuthUser;
    gridEl.classList.toggle("can-edit", canEdit);
  }
  window.addEventListener("rv:auth-resolved", () => { applyAuthUI(); render(); });
  window.addEventListener("rv:auth-change", () => { applyAuthUI(); render(); });
  applyAuthUI();

  // ----- Data fetch -----
  async function load() {
    try {
      const r = await fetch(PREP_URL, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const rows = data.items || [];
      items = rows
        .filter(x => x.section === SECTION_ID || x.section_id === SECTION_ID)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      render();
    } catch (err) {
      gridEl.innerHTML = `<p class="ach-loading">Couldn't load achievements.</p>`;
    }
  }

  function render() {
    if (!items.length) {
      gridEl.innerHTML = `<p class="ach-loading">No achievements yet.</p>`;
      updateProgress(0, 0);
      return;
    }
    const done = items.filter(it => it.done).length;
    updateProgress(done, items.length);

    const cards = items.map(it => {
      const { title, desc } = splitItemText(it.text);
      const emoji = EMOJI_BY_ID[it.id] || DEFAULT_EMOJI;
      const stateClass = it.done ? "is-unlocked" : "is-locked";
      const badge = it.done
        ? `<span class="ach-badge">🏆 Unlocked!</span>`
        : "";
      const btn = !it.done
        ? `<button type="button" class="ach-mark-btn" data-mark="${it.id}">Mark as Achieved!</button>`
        : `<button type="button" class="ach-mark-btn ach-mark-btn-undo" data-unmark="${it.id}">Undo</button>`;
      return `
        <div class="ach-card ${stateClass}" data-id="${it.id}">
          <div class="ach-emoji" aria-hidden="true">${emoji}</div>
          <div class="ach-body">
            <div class="ach-title">${esc(title)}</div>
            <div class="ach-desc">${esc(desc)}</div>
            ${badge}
          </div>
          ${btn}
        </div>
      `;
    }).join("");
    gridEl.innerHTML = cards;

    // Wire click handlers per card.
    gridEl.querySelectorAll(".ach-mark-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.mark || btn.dataset.unmark);
        const marking = !!btn.dataset.mark;
        const it = items.find(x => x.id === id);
        if (!it) return;
        const { title } = splitItemText(it.text);
        const prompt = marking
          ? `Mark "${title}" as achieved?`
          : `Un-achieve "${title}"?`;
        if (!window.confirm(prompt)) return;
        toggleDone(id, marking);
      });
    });
  }

  function updateProgress(done, total) {
    if (!progressEl) return;
    progressEl.textContent = total > 0 ? `${done} / ${total} unlocked` : "";
  }

  async function toggleDone(id, newDone) {
    const it = items.find(x => x.id === id);
    if (!it) return;
    // Optimistic update so the card flips immediately.
    it.done = newDone;
    render();
    try {
      const r = await fetch(PREP_URL + "/" + id, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: newDone }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    } catch (err) {
      // Revert on failure.
      it.done = !newDone;
      render();
      window.alert("Couldn't save. Try again?");
    }
  }

  load();
})();
