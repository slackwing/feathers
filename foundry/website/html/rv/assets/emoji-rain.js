// Temporary fun: rain 🦔 and 🐸 emojis down the home page background.
// Each drop FLUTTERS (sideways sway + rotation wobble) as it falls.
//
// Per Abi's house rules: rain only for ~5 seconds on page load, then stop
// spawning new drops (existing ones finish their fall and self-clean).
//
// Pointer-events: none so they don't block clicks. Fixed positioning so
// they fall over the whole viewport regardless of scroll. Low z-index so
// the map, hero, and content all sit above. To remove entirely: delete
// the <script src="assets/emoji-rain.js"> line in index.html.

(function () {
  // Skip entirely if user prefers reduced motion.
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // Inject one shared <style> block with the flutter keyframes.
  // We define several "flutter variants" so drops don't all wobble in
  // perfect sync — each emoji picks one randomly.
  const style = document.createElement("style");
  style.textContent = `
    @keyframes emoji-rain-fall {
      from { transform: translate3d(0, -40px, 0); }
      to   { transform: translate3d(0, calc(100vh + 80px), 0); }
    }
    @keyframes emoji-rain-flutter-a {
      0%   { transform: translateX(0)    rotate(-12deg); }
      25%  { transform: translateX(28px) rotate(14deg); }
      50%  { transform: translateX(-6px) rotate(-8deg); }
      75%  { transform: translateX(22px) rotate(18deg); }
      100% { transform: translateX(0)    rotate(-12deg); }
    }
    @keyframes emoji-rain-flutter-b {
      0%   { transform: translateX(0)     rotate(8deg); }
      33%  { transform: translateX(-32px) rotate(-22deg); }
      66%  { transform: translateX(18px)  rotate(16deg); }
      100% { transform: translateX(0)     rotate(8deg); }
    }
    @keyframes emoji-rain-flutter-c {
      0%   { transform: translateX(0)     rotate(0deg); }
      20%  { transform: translateX(14px)  rotate(20deg); }
      40%  { transform: translateX(-18px) rotate(-10deg); }
      60%  { transform: translateX(10px)  rotate(15deg); }
      80%  { transform: translateX(-22px) rotate(-18deg); }
      100% { transform: translateX(0)     rotate(0deg); }
    }
    /* The drop is two nested divs:
         outer  → fall animation (straight down)
         inner  → flutter animation (sideways + rotate)
       Stacking two animations on transform is illegal (latter wins), so
       we split them across two elements. */
    .emoji-rain-outer {
      position: absolute;
      top: -40px;
      will-change: transform;
      animation-name: emoji-rain-fall;
      animation-timing-function: linear;
      animation-iteration-count: 1;
      animation-fill-mode: forwards;
    }
    .emoji-rain-inner {
      display: inline-block;
      user-select: none;
      will-change: transform;
      animation-timing-function: ease-in-out;
      animation-iteration-count: infinite;
    }
  `;
  document.head.appendChild(style);

  const layer = document.createElement("div");
  layer.id = "emoji-rain-layer";
  layer.style.cssText = [
    "position:fixed",
    "inset:0",
    "pointer-events:none",
    "z-index:1",
    "overflow:hidden",
  ].join(";");
  document.body.appendChild(layer);

  const EMOJIS = ["🦔", "🐸"];
  const FLUTTERS = ["emoji-rain-flutter-a", "emoji-rain-flutter-b", "emoji-rain-flutter-c"];
  const ACTIVE_MAX = 28;
  const SPAWN_INTERVAL_MS = 250;   // denser, since we only have 5s
  const SPAWN_WINDOW_MS = 5000;    // stop spawning after this

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function spawn() {
    if (layer.childElementCount >= ACTIVE_MAX) return;

    const outer = document.createElement("div");
    const inner = document.createElement("span");
    outer.className = "emoji-rain-outer";
    inner.className = "emoji-rain-inner";
    inner.textContent = pick(EMOJIS);

    const size = rand(16, 36);
    const leftPct = rand(0, 100);
    const fallDur = rand(7, 14);                 // seconds top → bottom
    const flutterDur = rand(1.6, 3.2);           // seconds per flutter loop
    const flutterName = pick(FLUTTERS);

    outer.style.left = `${leftPct}%`;
    outer.style.animationDuration = `${fallDur}s`;

    inner.style.fontSize = `${size}px`;
    inner.style.opacity = "0.85";
    inner.style.animationName = flutterName;
    inner.style.animationDuration = `${flutterDur}s`;

    outer.appendChild(inner);
    layer.appendChild(outer);

    // Clean up after the fall finishes.
    setTimeout(() => outer.remove(), fallDur * 1000 + 400);
  }

  const spawnTimer = setInterval(spawn, SPAWN_INTERVAL_MS);
  for (let i = 0; i < 6; i++) setTimeout(spawn, i * 120);

  // Abi's house rules: rain stops after SPAWN_WINDOW_MS.
  // Existing drops finish their fall naturally; layer cleans itself up
  // once it's empty.
  setTimeout(() => {
    clearInterval(spawnTimer);
    // Tidy up the layer container once all drops have evaporated.
    const cleanupCheck = setInterval(() => {
      if (layer.childElementCount === 0) {
        clearInterval(cleanupCheck);
        layer.remove();
        style.remove();
      }
    }, 1000);
  }, SPAWN_WINDOW_MS);
})();
