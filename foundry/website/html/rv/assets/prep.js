// Prep checklist — reads assets/prep.json, renders a flat list with
// dependency arrows, persists check state to localStorage.
//
// Storage shape: localStorage["rv_prep_checks"] = {"item_id": true, ...}
// Items with depends_on are disabled until their parent is checked.
// Dependent items render with a ↳ arrow before the text.

(async function () {
  const root = document.getElementById("prep-root");
  const progressEl = document.getElementById("prep-progress");
  const authRequired = document.getElementById("prep-auth-required");
  const content = document.getElementById("prep-content");
  const loginPromptBtn = document.getElementById("prep-login-prompt-btn");
  if (!root) return;

  // ---- Gate: only render the checklist when logged in. auth.js sets
  //      window.rvAuthUser (string|null) and fires "rv:auth-change" on
  //      login/logout. We wait for at least one resolution.
  function showAuthRequired() {
    if (authRequired) authRequired.hidden = false;
    if (content) content.hidden = true;
  }
  function showContent() {
    if (authRequired) authRequired.hidden = true;
    if (content) content.hidden = false;
  }
  function applyAuthState() {
    if (window.rvAuthUser) {
      showContent();
    } else {
      showAuthRequired();
    }
  }
  // Wait for auth resolution before first paint.
  if (window.rvAuthResolved) {
    applyAuthState();
  } else {
    showAuthRequired();
    window.addEventListener("rv:auth-resolved", applyAuthState, { once: true });
  }
  window.addEventListener("rv:auth-change", applyAuthState);
  if (loginPromptBtn) {
    loginPromptBtn.addEventListener("click", () => {
      if (typeof window.rvOpenLoginModal === "function") window.rvOpenLoginModal();
    });
  }

  const STORAGE_KEY = "rv_prep_checks";

  function loadChecks() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch (_) {
      return {};
    }
  }
  function saveChecks(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  const data = await (await fetch("assets/prep.json")).json();
  let checks = loadChecks();

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function render() {
    let html = "";
    for (const section of data.sections) {
      const items = data.items.filter(it => it.section === section.id);
      if (!items.length) continue;
      html += `<div class="prep-section">`;
      html += `<h2>${escapeHtml(section.title)}</h2>`;
      html += `<ul class="prep-list">`;
      for (const it of items) {
        const isDependent = !!it.depends_on;
        const parentChecked = !it.depends_on || !!checks[it.depends_on];
        const isLocked = isDependent && !parentChecked;
        const isDone = !!checks[it.id];

        const cls = [
          "prep-item",
          isDependent ? "is-dependent" : "",
          isLocked ? "is-locked" : "",
          isDone ? "is-done" : "",
        ].filter(Boolean).join(" ");

        html += `<li class="${cls}" data-id="${escapeHtml(it.id)}">`;
        html += `<input type="checkbox" ${isDone ? "checked" : ""} ${isLocked ? "disabled" : ""} aria-label="${escapeHtml(it.text)}">`;
        if (isDependent) {
          // ↳ arrow points from above to the text → cues "depends on the one above"
          html += `<span class="prep-dep-arrow" aria-hidden="true">↳</span>`;
        }
        html += `<span class="prep-text">`;
        if (it.date) {
          html += `<span class="prep-date">${escapeHtml(it.date)}</span>`;
        }
        html += `${escapeHtml(it.text)}</span>`;
        html += `</li>`;
      }
      html += `</ul></div>`;
    }
    root.innerHTML = html;

    // Update progress summary.
    const total = data.items.length;
    const done = data.items.filter(it => checks[it.id]).length;
    progressEl.textContent = `${done} / ${total} done`;
  }

  function onChange(e) {
    if (e.target.tagName !== "INPUT" || e.target.type !== "checkbox") return;
    const li = e.target.closest(".prep-item");
    if (!li) return;
    const id = li.dataset.id;
    checks[id] = e.target.checked;
    saveChecks(checks);
    // Re-render so dependents update lock state.
    render();
  }

  render();
  root.addEventListener("change", onChange);
})();
