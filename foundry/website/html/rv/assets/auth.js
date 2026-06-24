// Site-wide auth client.
//
// Talks to hobby-server's rv project (https://github.com/slackwing/hobby-server) via
// /rv/api/{me,login,logout}. Wires the global #site-login-btn and
// #site-login-modal. Other scripts can:
//
//   - Read window.rvAuthUser           (string|null) at any time
//   - Read window.rvAuthResolved       (true once /api/me has returned)
//   - Listen for "rv:auth-resolved"    (fires once on initial /api/me)
//   - Listen for "rv:auth-change"      (fires on every login/logout)
//   - Call window.rvOpenLoginModal()   to programmatically open the modal
//
// Conventions:
//   - The login button toggles between "Log in" and the username + a
//     click-to-log-out behavior.
//   - (The checklists link is always visible — read-only for logged-out
//     users — so we no longer hide .prep-link-wrap on logout.)

(function () {
  const API_BASE = "/rv/api";  // Apache proxies this to the Go server

  window.rvAuthUser = null;
  window.rvAuthResolved = false;

  const loginBtn = document.getElementById("site-login-btn");
  const modal = document.getElementById("site-login-modal");
  const closeBtn = document.getElementById("site-login-close");
  const form = document.getElementById("site-login-form");
  const errorEl = document.getElementById("site-login-error");

  function setError(msg) {
    if (!errorEl) return;
    if (msg) {
      errorEl.textContent = msg;
      errorEl.hidden = false;
    } else {
      errorEl.hidden = true;
      errorEl.textContent = "";
    }
  }

  function openModal() {
    if (!modal) return;
    setError(null);
    modal.hidden = false;
    const usernameInput = form ? form.querySelector('input[name="username"]') : null;
    if (usernameInput) usernameInput.focus();
  }
  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
  }
  window.rvOpenLoginModal = openModal;

  function updateLoginButton() {
    if (!loginBtn) return;
    if (window.rvAuthUser) {
      loginBtn.textContent = `${window.rvAuthUser} · Log out`;
      loginBtn.setAttribute("aria-label", "Log out");
    } else {
      loginBtn.textContent = "Log in";
      loginBtn.setAttribute("aria-label", "Log in");
    }
  }
  function applyAuthState() {
    updateLoginButton();
  }

  async function fetchMe() {
    try {
      const res = await fetch(`${API_BASE}/me`, { credentials: "same-origin" });
      if (res.ok) {
        const body = await res.json();
        window.rvAuthUser = body.username || null;
      } else {
        window.rvAuthUser = null;
      }
    } catch (_) {
      // Network error or server down — treat as logged out, don't crash UI.
      window.rvAuthUser = null;
    }
    window.rvAuthResolved = true;
    applyAuthState();
    window.dispatchEvent(new CustomEvent("rv:auth-resolved", { detail: { user: window.rvAuthUser } }));
  }

  async function login(username, password) {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.status === 401) {
        setError("Invalid username or password.");
        return;
      }
      if (!res.ok) {
        setError(`Server error (${res.status}). Try again.`);
        return;
      }
      const body = await res.json();
      window.rvAuthUser = body.username || username;
      applyAuthState();
      window.dispatchEvent(new CustomEvent("rv:auth-change", { detail: { user: window.rvAuthUser } }));
      closeModal();
      if (form) form.reset();
    } catch (e) {
      setError("Couldn't reach the server. Try again in a moment.");
    }
  }

  async function logout() {
    try {
      await fetch(`${API_BASE}/logout`, {
        method: "POST",
        credentials: "same-origin",
      });
    } catch (_) {
      // Even if the server call fails, clear the client state.
    }
    window.rvAuthUser = null;
    applyAuthState();
    window.dispatchEvent(new CustomEvent("rv:auth-change", { detail: { user: null } }));
  }

  // ---- Wire UI ----
  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      if (window.rvAuthUser) {
        if (confirm("Log out?")) logout();
      } else {
        openModal();
      }
    });
  }
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();  // backdrop click
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.hidden) closeModal();
  });
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const username = (fd.get("username") || "").toString().trim();
      const password = (fd.get("password") || "").toString();
      if (!username || !password) return;
      login(username, password);
    });
  }

  applyAuthState();  // Initial state: logged out (until fetchMe resolves)
  fetchMe();
})();
