// Shared page chrome: the login button + °C/°F toggle, the login modal,
// and the footer nav. This is the ONE copy of markup that used to be
// pasted into all five pages (and drifted — three footers lost their
// Checklists link before this file existed).
//
// MUST load before site-unit.js and auth.js: they getElementById the
// elements this script injects.
(function () {
  // Pages in canonical nav order. The footer renders every page except
  // the one you're on; the index link reads "Back to itinerary" when it
  // appears.
  const PAGES = [
    { href: "index.html",   label: "Back to itinerary" },
    { href: "prep.html",    label: "Checklists" },
    { href: "notes.html",   label: "Notes" },
    { href: "website.html", label: "Website" },
    { href: "admin.html",   label: "Admin" },
  ];
  window.rvSiteNav = PAGES;

  const CONTROLS_HTML = `
<div class="site-controls">
  <button class="site-login-btn" id="site-login-btn" type="button" aria-label="Log in">Log in</button>
  <div class="site-unit-toggle" id="site-unit-toggle" role="tablist" aria-label="Temperature unit (site-wide)">
    <button type="button" data-unit="C" role="tab" aria-selected="true">°C</button>
    <button type="button" data-unit="F" role="tab" aria-selected="false">°F</button>
  </div>
</div>`;

  const MODAL_HTML = `
<div class="site-modal-overlay" id="site-login-modal" hidden>
  <div class="site-modal" role="dialog" aria-modal="true" aria-labelledby="site-login-title">
    <button class="site-modal-close" id="site-login-close" type="button" aria-label="Close">×</button>
    <h2 id="site-login-title">Log in</h2>
    <form id="site-login-form">
      <label class="site-modal-field">
        <span>Username</span>
        <input type="text" name="username" autocomplete="username" required>
      </label>
      <label class="site-modal-field">
        <span>Password</span>
        <input type="password" name="password" autocomplete="current-password" required>
      </label>
      <p class="site-modal-error" id="site-login-error" hidden></p>
      <button class="site-modal-submit" type="submit">Log in</button>
    </form>
  </div>
</div>`;

  document.body.insertAdjacentHTML("afterbegin", MODAL_HTML);
  document.body.insertAdjacentHTML("afterbegin", CONTROLS_HTML);

  // ---- Footer nav (fills the empty <footer class="footer"> element) ----
  const footer = document.querySelector("footer.footer");
  if (footer) {
    const here = location.pathname.split("/").pop() || "index.html";
    const links = PAGES
      .filter(p => p.href !== here)
      .map(p => `<a href="${p.href}">${p.label}</a>`);
    footer.innerHTML = `<p>🦔 + 🐸 · ${links.join(" · ")}</p>`;
  }
})();
