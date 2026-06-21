// Site-wide C/F temperature unit toggle.
//
// Reads/writes the rv_temp_unit cookie (default C). Wires the
// `.site-unit-toggle` element on every page. Dispatches a
// `rv:unit-change` window event whenever the user toggles, with
// `detail.unit = 'C' | 'F'`. Renderers listen for this and re-render.
//
// Defaults to C site-wide. Persists across page loads via cookie.

(function () {
  const COOKIE = "rv_temp_unit";
  function read() {
    const m = document.cookie.match(/(?:^|; )rv_temp_unit=([^;]+)/);
    if (m) return m[1] === "F" ? "F" : "C";
    return "C";
  }
  function write(u) {
    const oneYear = 60 * 60 * 24 * 365;
    document.cookie = `${COOKIE}=${u}; path=/; max-age=${oneYear}; SameSite=Lax`;
  }

  // Exposed globally so renderers can read without parsing cookies themselves.
  window.rvTempUnit = read();

  const toggle = document.getElementById("site-unit-toggle");
  if (!toggle) return;

  function apply() {
    toggle.querySelectorAll("button").forEach(b => {
      const active = b.dataset.unit === window.rvTempUnit;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
  }
  apply();

  toggle.querySelectorAll("button").forEach(b => {
    b.addEventListener("click", () => {
      const u = b.dataset.unit;
      if (u === window.rvTempUnit) return;
      window.rvTempUnit = u;
      write(u);
      apply();
      window.dispatchEvent(new CustomEvent("rv:unit-change", { detail: { unit: u } }));
    });
  });
})();
