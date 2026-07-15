// Notes — single shared markdown document.
//
// Public read (GET /rv/api/note). Logged-in users get an Edit button
// that swaps the rendered view for a <textarea>. Saving PUTs back to
// the server and re-renders.

(async function () {
  const API_URL = "/rv/api/note";
  const root = document.getElementById("notes-root");
  const editBtn = document.getElementById("notes-edit-btn");
  const loginHint = document.getElementById("notes-login-hint");
  const loginHintBtn = document.getElementById("notes-login-hint-btn");
  const toastEl = document.getElementById("notes-toast");
  if (!root) return;

  // Open all rendered <a> in a new tab via DOMPurify hook.
  if (typeof DOMPurify !== "undefined") {
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if (node.tagName === "A" && node.hasAttribute("href")) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    });
  }

  let serverMarkdown = "";
  let editing = false;
  let canEdit = false;

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("is-shown");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove("is-shown"), 1800);
  }

  function renderMarkdown(src) {
    if (typeof marked === "undefined") return escapeHtml(src);
    // Pre-process: turn "IMG_xxxx.jpeg/heic" lines (used in source
    // text where photos used to live) into a styled "missing image"
    // chip rather than an empty paragraph.
    const preprocessed = src.replace(
      /^([A-Z][A-Z0-9_]*\.(?:jpe?g|heic|png|gif))\s*$/gim,
      (_m, name) => `<span class="notes-missing-image">image missing: ${name}</span>`,
    );
    const raw = marked.parse(preprocessed, { breaks: true });
    return (typeof DOMPurify !== "undefined") ? DOMPurify.sanitize(raw) : raw;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function renderView() {
    root.classList.remove("notes-loading");
    if (!serverMarkdown.trim()) {
      root.innerHTML = `<p class="notes-loading">No notes yet.${canEdit ? " Click <strong>Edit</strong> to add some." : ""}</p>`;
      return;
    }
    root.innerHTML = `<div class="notes-view">${renderMarkdown(serverMarkdown)}</div>`;
  }

  function renderEditor() {
    root.classList.remove("notes-loading");
    root.innerHTML = `
      <textarea class="notes-editor" id="notes-editor" spellcheck="true"></textarea>
      <div class="notes-actions">
        <button type="button" id="notes-cancel">Cancel</button>
        <button type="button" class="primary" id="notes-save">Save</button>
      </div>
    `;
    const ta = document.getElementById("notes-editor");
    ta.value = serverMarkdown;
    ta.focus();
    document.getElementById("notes-cancel").addEventListener("click", () => {
      editing = false;
      editBtn.textContent = "Edit";
      renderView();
    });
    document.getElementById("notes-save").addEventListener("click", () => save(ta.value));
    // Ctrl/Cmd+S inside the textarea saves.
    ta.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save(ta.value);
      }
    });
  }

  async function save(newMarkdown) {
    let status = "?";
    try {
      const r = await fetch(API_URL, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: newMarkdown }),
      });
      status = r.status;
      if (!r.ok) {
        const body = await r.text();
        throw new Error(`HTTP ${r.status} ${body.slice(0, 200)}`);
      }
      const data = await r.json();
      serverMarkdown = data.markdown || "";
      editing = false;
      editBtn.textContent = "Edit";
      renderView();
      toast("Saved.");
    } catch (err) {
      console.error("notes save failed:", err);
      toast(`Save failed (${status}). ${status === 401 ? "Try logging in again." : ""}`);
    }
  }

  async function load() {
    try {
      const r = await fetch(API_URL, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      serverMarkdown = data.markdown || "";
    } catch (err) {
      root.innerHTML = `<p class="notes-loading">Couldn't load notes (${escapeHtml(String(err.message || err))}).</p>`;
      return;
    }
    applyAuthUI();
    renderView();
  }

  function applyAuthUI() {
    canEdit = !!window.rvAuthUser;
    if (canEdit) {
      editBtn.hidden = false;
      loginHint.hidden = true;
    } else {
      editBtn.hidden = true;
      loginHint.hidden = false;
    }
  }

  editBtn.addEventListener("click", () => {
    editing = !editing;
    if (editing) {
      editBtn.textContent = "Viewing source";
      renderEditor();
    } else {
      editBtn.textContent = "Edit";
      renderView();
    }
  });

  if (loginHintBtn) {
    loginHintBtn.addEventListener("click", () => {
      const btn = document.getElementById("site-login-btn");
      if (btn) btn.click();
    });
  }

  // Re-evaluate auth-driven UI when auth state lands or changes.
  window.addEventListener("rv:auth-resolved", () => {
    applyAuthUI();
    if (!editing) renderView();
  });
  window.addEventListener("rv:auth-change", () => {
    applyAuthUI();
    if (!editing) renderView();
  });

  load();
})();
