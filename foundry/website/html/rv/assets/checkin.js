// Check-in: logged-in user clicks the button in the hero, browser
// prompts for location permission, we POST it to /rv/api/checkins,
// and the map renders the LATEST check-in as a pulsing blue dot.
//
// Public read (anyone sees where we are on the map). Auth write.

(function () {
  const API_URL = "/rv/api/checkins";
  const btn = document.getElementById("hero-checkin-btn");

  // ----- Auth-driven button visibility -----
  function applyAuthUI() {
    if (!btn) return;
    btn.hidden = !window.rvAuthUser;
  }
  window.addEventListener("rv:auth-resolved", applyAuthUI);
  window.addEventListener("rv:auth-change", applyAuthUI);
  applyAuthUI();

  // ----- Loading the latest check-in for the map -----
  // Exposed on window so map-v2.js can render it. We fetch once at
  // load and again after a successful check-in.
  async function loadLatest() {
    try {
      const r = await fetch(API_URL, { credentials: "include" });
      if (!r.ok) return;
      const data = await r.json();
      window.rvLatestCheckin = data.latest || null;
      window.dispatchEvent(new CustomEvent("rv:checkin-updated"));
    } catch (_) {
      // Non-fatal — map just won't show a dot.
    }
  }
  loadLatest();

  // ----- Click handler: geolocate + POST -----
  function toast(msg) {
    // Reuse the tiny inline toast we use elsewhere; if there's no
    // container, fall back to alert(). Keeps the UI quiet.
    let el = document.getElementById("rv-checkin-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "rv-checkin-toast";
      el.className = "rv-checkin-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-shown");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("is-shown"), 2400);
  }

  if (btn) {
    btn.addEventListener("click", async () => {
      if (!navigator.geolocation) {
        toast("Your browser doesn't support location.");
        return;
      }
      const originalLabel = btn.querySelector(".hero-checkin-label").textContent;
      btn.disabled = true;
      btn.querySelector(".hero-checkin-label").textContent = "locating…";

      // getCurrentPosition wrapped in a promise for cleaner error flow.
      const position = await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ ok: true, p }),
          (err) => resolve({ ok: false, err }),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
        );
      });

      if (!position.ok) {
        btn.disabled = false;
        btn.querySelector(".hero-checkin-label").textContent = originalLabel;
        const err = position.err;
        if (err && err.code === 1) toast("Location permission denied.");
        else if (err && err.code === 3) toast("Location took too long — try again.");
        else toast("Couldn't get your location.");
        return;
      }

      const { latitude: lat, longitude: lon, accuracy } = position.p.coords;
      btn.querySelector(".hero-checkin-label").textContent = "saving…";
      try {
        const r = await fetch(API_URL, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lon, accuracy_m: accuracy || null }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        await loadLatest();
        toast("Checked in! 📍");
      } catch (err) {
        toast(`Save failed. ${err.message || ""}`);
      } finally {
        btn.disabled = false;
        btn.querySelector(".hero-checkin-label").textContent = originalLabel;
      }
    });
  }
})();
