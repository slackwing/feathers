// On-demand celebration rain. Call window.rvCelebrate() to start a 5s
// emoji shower. Re-calling while running:
//   - Extends the timer to 5s from now (no new layer, no doubling).
//   - Picks a NEW random theme so the visual changes.
//
// Themes always include 🦔 (hedgehog) and 🐸 (frog) — those are the
// constant cast. Each theme adds a few flavor emojis.
//
// Structurally mirrors assets/emoji-rain.js (the home-page auto-rain),
// but exposed as a reusable function instead of auto-firing on load.
//
// Respects prefers-reduced-motion (no-op).

(function () {
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Each theme always carries 🦔 + 🐸 plus 2-4 flavor emojis.
  // Picked at random per session of celebration. The first character of
  // each set is the "themed" anchor; the array order is just for taste.
  const THEMES = [
    ["🦔", "🐸", "🎉", "✨", "🎊"],          // party
    ["🦔", "🐸", "🌟", "💫", "⭐", "✨"],     // starry
    ["🦔", "🐸", "🌈", "🌸", "🍃", "🌼"],     // flora
    ["🦔", "🐸", "💚", "💛", "💗", "💙"],     // hearts
    ["🦔", "🐸", "🏕️", "🌲", "🏔️", "🚐"],    // rv vibes
    ["🦔", "🐸", "🥕", "🍓", "🍑", "🍇"],     // snacks
    ["🦔", "🐸", "🌞", "🌙", "☁️", "🌤️"],   // sky
  ];

  const FLUTTERS = ["rv-celeb-flutter-a", "rv-celeb-flutter-b", "rv-celeb-flutter-c"];
  const ACTIVE_MAX = 32;
  const SPAWN_INTERVAL_MS = 200;
  const CELEBRATION_MS = 5000;

  let injectedStyle = false;
  function injectStyle() {
    if (injectedStyle) return;
    injectedStyle = true;
    const style = document.createElement("style");
    style.id = "rv-celebrate-style";
    style.textContent = `
      @keyframes rv-celeb-fall {
        from { transform: translate3d(0, -40px, 0); }
        to   { transform: translate3d(0, calc(100vh + 80px), 0); }
      }
      @keyframes rv-celeb-flutter-a {
        0%   { transform: translateX(0)    rotate(-12deg); }
        25%  { transform: translateX(28px) rotate(14deg); }
        50%  { transform: translateX(-6px) rotate(-8deg); }
        75%  { transform: translateX(22px) rotate(18deg); }
        100% { transform: translateX(0)    rotate(-12deg); }
      }
      @keyframes rv-celeb-flutter-b {
        0%   { transform: translateX(0)     rotate(8deg); }
        33%  { transform: translateX(-32px) rotate(-22deg); }
        66%  { transform: translateX(18px)  rotate(16deg); }
        100% { transform: translateX(0)     rotate(8deg); }
      }
      @keyframes rv-celeb-flutter-c {
        0%   { transform: translateX(0)     rotate(0deg); }
        20%  { transform: translateX(14px)  rotate(20deg); }
        40%  { transform: translateX(-18px) rotate(-10deg); }
        60%  { transform: translateX(10px)  rotate(15deg); }
        80%  { transform: translateX(-22px) rotate(-18deg); }
        100% { transform: translateX(0)     rotate(0deg); }
      }
      .rv-celeb-outer {
        position: absolute;
        top: -40px;
        will-change: transform;
        animation-name: rv-celeb-fall;
        animation-timing-function: linear;
        animation-iteration-count: 1;
        animation-fill-mode: forwards;
      }
      .rv-celeb-inner {
        display: inline-block;
        user-select: none;
        will-change: transform;
        animation-timing-function: ease-in-out;
        animation-iteration-count: infinite;
      }
    `;
    document.head.appendChild(style);
  }

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  let layer = null;
  let spawnTimer = null;
  let stopTimer = null;
  let currentTheme = null;

  function ensureLayer() {
    if (layer) return;
    layer = document.createElement("div");
    layer.id = "rv-celebrate-layer";
    layer.style.cssText = [
      "position:fixed",
      "inset:0",
      "pointer-events:none",
      "z-index:1000",
      "overflow:hidden",
    ].join(";");
    document.body.appendChild(layer);
  }

  function spawn() {
    if (!layer || layer.childElementCount >= ACTIVE_MAX) return;
    const outer = document.createElement("div");
    const inner = document.createElement("span");
    outer.className = "rv-celeb-outer";
    inner.className = "rv-celeb-inner";
    inner.textContent = pick(currentTheme);

    const size = rand(20, 40);
    const leftPct = rand(0, 100);
    const fallDur = rand(4.5, 8.5);
    const flutterDur = rand(1.4, 3.0);
    outer.style.left = `${leftPct}%`;
    outer.style.animationDuration = `${fallDur}s`;
    inner.style.fontSize = `${size}px`;
    inner.style.opacity = "0.9";
    inner.style.animationName = pick(FLUTTERS);
    inner.style.animationDuration = `${flutterDur}s`;

    outer.appendChild(inner);
    layer.appendChild(outer);
    setTimeout(() => outer.remove(), fallDur * 1000 + 400);
  }

  function pickNewTheme() {
    if (THEMES.length === 1) {
      currentTheme = THEMES[0];
      return;
    }
    let next;
    do { next = pick(THEMES); } while (next === currentTheme);
    currentTheme = next;
  }

  function startOrExtend() {
    if (reducedMotion) return;
    injectStyle();
    ensureLayer();

    const isRunning = spawnTimer !== null;
    if (!isRunning) {
      // Fresh start: pick a theme, start spawning.
      pickNewTheme();
      spawnTimer = setInterval(spawn, SPAWN_INTERVAL_MS);
      // Initial burst so it feels immediate.
      for (let i = 0; i < 5; i++) setTimeout(spawn, i * 80);
    } else {
      // Already running: switch to a different theme.
      pickNewTheme();
    }

    // (Re)set the stop timer to 5s from now.
    if (stopTimer) clearTimeout(stopTimer);
    stopTimer = setTimeout(stop, CELEBRATION_MS);
  }

  function stop() {
    if (spawnTimer) { clearInterval(spawnTimer); spawnTimer = null; }
    if (stopTimer)  { clearTimeout(stopTimer);  stopTimer = null; }
    // Don't yank the layer immediately — let existing drops finish falling.
    const cleanup = setInterval(() => {
      if (!layer) { clearInterval(cleanup); return; }
      if (layer.childElementCount === 0) {
        clearInterval(cleanup);
        layer.remove();
        layer = null;
      }
    }, 800);
  }

  window.rvCelebrate = startOrExtend;
})();
