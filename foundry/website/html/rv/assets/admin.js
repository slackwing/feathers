// Admin page — small CRUD UI over the dunkin_participant table.
// Anyone can VIEW the list (matches the rest of the site's read-open
// posture). Only logged-in users see + can use the edit / add / delete
// controls.

(async function () {
  const API_URL = "/rv/api/dunkin/participants";
  const root = document.getElementById("admin-dunkin-root");
  const addForm = document.getElementById("admin-add-form");
  const loginHint = document.getElementById("admin-login-hint");
  const loginHintBtn = document.getElementById("admin-login-hint-btn");
  const toastEl = document.getElementById("admin-toast");
  if (!root) return;

  let participants = [];
  let canEdit = false;

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("is-shown");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove("is-shown"), 2000);
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function initial(name) {
    return (name || "?").charAt(0).toUpperCase();
  }

  // Rough contrast helper for the color chip's text — flip to dark ink
  // on pale colors so the letter stays visible.
  function chipTextColor(hex) {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return "#fff";
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum > 170 ? "#1c2a25" : "#fff";
  }

  function renderChip(p) {
    return `<span class="admin-avatar-chip" style="background:${esc(p.color)}; color:${chipTextColor(p.color)};">${esc(initial(p.name))}</span>`;
  }

  function render() {
    root.classList.remove("admin-loading");
    if (!participants.length) {
      root.innerHTML = `<p class="admin-empty">No participants yet.</p>`;
      return;
    }
    const rows = participants.map(p => `
      <div class="admin-participant" data-id="${esc(p.id)}">
        ${renderChip(p)}
        <input type="text" data-field="name" value="${esc(p.name)}" ${canEdit ? "" : "disabled"}>
        <input type="number" data-field="guess" value="${p.guess}" min="0" step="1" ${canEdit ? "" : "disabled"}>
        <input type="color" data-field="color" value="${esc(p.color)}" ${canEdit ? "" : "disabled"}>
        <div class="admin-actions">
          ${canEdit ? `<button type="button" class="admin-btn primary" data-act="save">Save</button>
                       <button type="button" class="admin-btn danger" data-act="delete" aria-label="Delete">✕</button>` : ""}
        </div>
      </div>
    `).join("");
    root.innerHTML = `<div class="admin-participants">${rows}</div>`;

    // Wire per-row events.
    root.querySelectorAll(".admin-participant").forEach(el => {
      const id = el.dataset.id;
      el.addEventListener("input", (e) => {
        // Update the letter-chip color live as the user picks.
        if (e.target.dataset.field === "color") {
          const chip = el.querySelector(".admin-avatar-chip");
          chip.style.background = e.target.value;
          chip.style.color = chipTextColor(e.target.value);
        }
        if (e.target.dataset.field === "name") {
          const chip = el.querySelector(".admin-avatar-chip");
          chip.textContent = initial(e.target.value);
        }
      });
      el.addEventListener("click", (e) => {
        const act = e.target.dataset.act;
        if (act === "save") return saveRow(id, el);
        if (act === "delete") return deleteRow(id, el);
      });
    });
  }

  async function load() {
    try {
      const r = await fetch(API_URL, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      participants = data.participants || [];
      applyAuthUI();
      render();
    } catch (err) {
      root.innerHTML = `<p class="admin-empty">Couldn't load participants.</p>`;
    }
  }

  function applyAuthUI() {
    canEdit = !!window.rvAuthUser;
    if (canEdit) {
      loginHint.hidden = true;
      addForm.hidden = false;
    } else {
      loginHint.hidden = false;
      addForm.hidden = true;
    }
  }

  async function saveRow(id, el) {
    const name = el.querySelector('[data-field="name"]').value.trim();
    const guess = parseInt(el.querySelector('[data-field="guess"]').value, 10);
    const color = el.querySelector('[data-field="color"]').value;
    if (!name) return toast("Name can't be empty.");
    if (!Number.isFinite(guess) || guess < 0) return toast("Guess must be a non-negative number.");
    try {
      const r = await fetch(API_URL + "/" + encodeURIComponent(id), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, guess, color }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const updated = await r.json();
      const idx = participants.findIndex(p => p.id === id);
      if (idx !== -1) participants[idx] = updated;
      toast("Saved.");
    } catch (err) {
      toast("Save failed.");
    }
  }

  async function deleteRow(id, el) {
    const p = participants.find(x => x.id === id);
    if (!p) return;
    if (!confirm(`Delete ${p.name}? This can't be undone.`)) return;
    try {
      const r = await fetch(API_URL + "/" + encodeURIComponent(id), {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok && r.status !== 204) throw new Error(`HTTP ${r.status}`);
      participants = participants.filter(x => x.id !== id);
      render();
      toast("Deleted.");
    } catch (err) {
      toast("Delete failed.");
    }
  }

  // ---- Add form ----
  const newChip = document.getElementById("new-chip");
  const newName = document.getElementById("new-name");
  const newGuess = document.getElementById("new-guess");
  const newColor = document.getElementById("new-color");
  const newSave = document.getElementById("new-save");

  function slugify(name) {
    return String(name || "").toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40);
  }

  if (newName) {
    newName.addEventListener("input", () => {
      newChip.textContent = initial(newName.value);
    });
  }
  if (newColor) {
    newColor.addEventListener("input", () => {
      newChip.style.background = newColor.value;
      newChip.style.color = chipTextColor(newColor.value);
    });
  }
  if (newSave) {
    newSave.addEventListener("click", async () => {
      const name = newName.value.trim();
      const guess = parseInt(newGuess.value, 10);
      const color = newColor.value;
      if (!name) return toast("Name required.");
      if (!Number.isFinite(guess) || guess < 0) return toast("Guess must be a non-negative number.");
      let baseId = slugify(name);
      if (!baseId) baseId = "bettor_" + Date.now();
      // Nudge with a suffix if the id already exists.
      let id = baseId;
      let n = 2;
      while (participants.some(p => p.id === id)) {
        id = baseId + "_" + n++;
      }
      try {
        const r = await fetch(API_URL, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, name, guess, color }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const created = await r.json();
        participants.push(created);
        newName.value = "";
        newGuess.value = "";
        newColor.value = "#4a7fa0";
        newChip.style.background = "#4a7fa0";
        newChip.style.color = "#fff";
        newChip.textContent = "?";
        render();
        toast(`Added ${created.name}.`);
      } catch (err) {
        toast("Add failed.");
      }
    });
  }

  // Login hint's "log in" button routes to the site-wide login modal.
  if (loginHintBtn) {
    loginHintBtn.addEventListener("click", () => {
      const b = document.getElementById("site-login-btn");
      if (b) b.click();
    });
  }

  window.addEventListener("rv:auth-resolved", () => { applyAuthUI(); render(); });
  window.addEventListener("rv:auth-change", () => { applyAuthUI(); render(); });

  load();
})();
