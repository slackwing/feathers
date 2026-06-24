// sprinkle-bg.js — decorative SVG line-drawing background for the
// checklists page.
//
// 25 trip-themed icons (shoes, backpack, toothbrush, mug, sunglasses,
// compass, etc.). On page load, scatters them across the page
// background in a tileable seed pattern: random tile-local position,
// rotation, scale, then the tile repeats. Pointer-events: none, behind
// all content.
//
// Re-rolled on every load — same set of icons, different scatter each
// time. Lives behind .prep-page (z-index < 0) and the chosen color is
// a faint deep-frog-green stroke against the mint --bg.

(function () {
  // --- 25 line-drawing SVG paths (viewBox 100x100, stroke-only) ----
  // Each value is the *innards* of an <svg> tag (paths + circles), all
  // with stroke="currentColor" so we can tint them via CSS color.
  const ICONS = [
    // 1. hiking shoe
    `<path d="M10 65 L20 50 L45 50 L60 55 L78 60 Q90 62 90 70 L90 78 L12 78 Q8 78 8 74 Z"/>
     <path d="M25 50 L25 55 M35 50 L35 55 M55 55 L60 50"/>
     <path d="M20 78 L25 84 M40 78 L42 84 M65 78 L66 84"/>`,
    // 2. backpack
    `<rect x="25" y="20" width="50" height="65" rx="8"/>
     <path d="M30 20 Q30 8 50 8 Q70 8 70 20"/>
     <rect x="32" y="38" width="36" height="22" rx="3"/>
     <circle cx="50" cy="49" r="2"/>`,
    // 3. toothbrush
    `<path d="M15 50 L60 50 L75 45 L90 48 L90 52 L75 55 L60 50"/>
     <path d="M18 45 L18 55 M22 44 L22 56 M26 45 L26 55 M30 44 L30 56 M34 45 L34 55 M38 44 L38 56"/>`,
    // 4. coffee mug
    `<path d="M25 30 L25 75 Q25 85 35 85 L60 85 Q70 85 70 75 L70 30 Z"/>
     <path d="M70 40 Q88 40 88 55 Q88 70 70 70"/>
     <path d="M35 18 Q35 22 38 24 M45 16 Q45 20 48 22 M55 18 Q55 22 58 24"/>`,
    // 5. sunglasses
    `<ellipse cx="28" cy="55" rx="16" ry="13"/>
     <ellipse cx="72" cy="55" rx="16" ry="13"/>
     <path d="M44 55 L56 55"/>
     <path d="M12 50 L8 45 M88 50 L92 45"/>`,
    // 6. compass
    `<circle cx="50" cy="50" r="38"/>
     <path d="M50 22 L45 50 L50 78 L55 50 Z"/>
     <circle cx="50" cy="50" r="3"/>
     <path d="M50 14 L50 18 M50 82 L50 86 M14 50 L18 50 M82 50 L86 50"/>`,
    // 7. binoculars
    `<rect x="10" y="35" width="28" height="40" rx="5"/>
     <rect x="62" y="35" width="28" height="40" rx="5"/>
     <path d="M38 50 L62 50 M38 60 L62 60"/>
     <circle cx="24" cy="55" r="6"/>
     <circle cx="76" cy="55" r="6"/>`,
    // 8. camera
    `<rect x="10" y="28" width="80" height="55" rx="6"/>
     <circle cx="50" cy="55" r="16"/>
     <circle cx="50" cy="55" r="9"/>
     <rect x="32" y="22" width="20" height="8" rx="2"/>
     <circle cx="78" cy="38" r="2"/>`,
    // 9. map (folded)
    `<path d="M10 22 L35 30 L65 22 L90 30 L90 78 L65 70 L35 78 L10 70 Z"/>
     <path d="M35 30 L35 78 M65 22 L65 70"/>`,
    // 10. tent
    `<path d="M10 80 L50 18 L90 80 Z"/>
     <path d="M50 18 L50 80"/>
     <path d="M35 80 L50 60 L65 80"/>`,
    // 11. flashlight
    `<path d="M20 35 L50 35 L60 28 L80 28 L80 72 L60 72 L50 65 L20 65 Z"/>
     <path d="M20 50 L10 50 M20 42 L8 38 M20 58 L8 62"/>
     <circle cx="70" cy="50" r="6"/>`,
    // 12. water bottle
    `<path d="M35 18 L65 18 L65 28 Q72 32 72 40 L72 85 Q72 92 65 92 L35 92 Q28 92 28 85 L28 40 Q28 32 35 28 Z"/>
     <path d="M35 18 L35 28 M65 18 L65 28"/>
     <path d="M28 48 L72 48"/>`,
    // 13. mountains
    `<path d="M5 78 L25 45 L40 65 L58 35 L78 60 L95 78 Z"/>
     <path d="M25 45 L33 56 M58 35 L65 48"/>
     <circle cx="78" cy="22" r="6"/>`,
    // 14. sun
    `<circle cx="50" cy="50" r="18"/>
     <path d="M50 18 L50 26 M50 74 L50 82 M18 50 L26 50 M74 50 L82 50"/>
     <path d="M27 27 L33 33 M67 67 L73 73 M27 73 L33 67 M67 33 L73 27"/>`,
    // 15. cloud
    `<path d="M22 65 Q12 65 12 55 Q12 45 22 45 Q22 32 35 32 Q42 32 47 38 Q52 28 65 28 Q80 28 82 42 Q92 44 92 55 Q92 65 82 65 Z"/>`,
    // 16. cactus
    `<path d="M40 90 L40 35 Q40 22 50 22 Q60 22 60 35 L60 90 Z"/>
     <path d="M40 50 L25 50 Q15 50 15 60 L15 70 Q15 78 25 78"/>
     <path d="M60 42 L78 42 Q88 42 88 52 L88 60"/>`,
    // 17. RV (camper)
    `<rect x="8" y="35" width="60" height="40" rx="4"/>
     <path d="M68 50 L88 50 L92 60 L92 75 L68 75 Z"/>
     <circle cx="25" cy="80" r="6"/>
     <circle cx="78" cy="80" r="6"/>
     <rect x="14" y="42" width="14" height="14"/>
     <rect x="36" y="42" width="14" height="14"/>`,
    // 18. key
    `<circle cx="25" cy="50" r="14"/>
     <path d="M39 50 L88 50 L88 60 M75 50 L75 58 M65 50 L65 56"/>`,
    // 19. notebook
    `<rect x="20" y="12" width="60" height="76" rx="3"/>
     <path d="M30 12 L30 88 M30 26 L70 26 M30 38 L70 38 M30 50 L70 50 M30 62 L65 62"/>`,
    // 20. snack bar
    `<rect x="15" y="38" width="70" height="24" rx="4"/>
     <path d="M28 38 L28 62 M44 38 L44 62 M60 38 L60 62 M76 38 L76 62"/>
     <path d="M22 32 L25 38 M40 30 L42 38 M60 30 L62 38 M78 32 L80 38"/>`,
    // 21. flip flops / sandal
    `<path d="M30 18 Q44 18 44 32 L44 80 Q44 90 35 90 L25 90 Q16 90 16 80 L18 32 Q18 18 30 18 Z"/>
     <path d="M30 28 L24 38 M30 28 L36 38"/>
     <path d="M70 18 Q84 18 84 32 L82 80 Q82 90 73 90 L63 90 Q54 90 54 80 L54 32 Q54 18 70 18 Z"/>
     <path d="M70 28 L64 38 M70 28 L76 38"/>`,
    // 22. fish (river)
    `<path d="M14 50 Q30 30 60 30 Q82 30 90 50 Q82 70 60 70 Q30 70 14 50 Z"/>
     <path d="M90 50 L98 38 L98 62 Z"/>
     <circle cx="32" cy="48" r="2"/>
     <path d="M55 38 Q60 50 55 62"/>`,
    // 23. road sign
    `<rect x="20" y="22" width="60" height="36" rx="3"/>
     <path d="M50 58 L50 88"/>
     <path d="M30 35 L40 35 M30 45 L48 45 M52 35 L70 35 M55 45 L70 45"/>`,
    // 24. star (campfire spark)
    `<path d="M50 12 L58 38 L86 38 L63 54 L72 82 L50 65 L28 82 L37 54 L14 38 L42 38 Z"/>`,
    // 25. mug of stars / wine glass (cheers)
    `<path d="M30 18 L70 18 L70 30 Q70 50 50 50 Q30 50 30 30 Z"/>
     <path d="M50 50 L50 82 M35 86 L65 86"/>
     <path d="M50 28 L52 35 L58 35 L53 38 L55 44 L50 41 L45 44 L47 38 L42 35 L48 35 Z"/>`,
  ];

  // ----- config -----
  const TILE_SIZE = 1200;                 // px; pattern repeats every TILE_SIZE
  const ICONS_PER_TILE = 80;              // matched density to the larger tile
  const ICON_SIZE_MIN = 56;
  const ICON_SIZE_MAX = 96;
  const MIN_GAP_PX = 20;                  // minimum edge-to-edge gap between icons
  const MAX_PLACEMENT_ATTEMPTS = 80;      // tries per icon before giving up
  // Faint deep-frog-green: slightly darker than --bg, low opacity.
  const STROKE_COLOR = "#2f8a6e";
  const STROKE_OPACITY = 0.12;
  const STROKE_WIDTH = 1.4;               // in SVG-user units (we scale the SVG)

  function rand(min, max) { return min + Math.random() * (max - min); }

  // Rejection-sampling scatter: each icon is approximated as a circle of
  // radius = size/2 (since the source viewBox is 100x100, the rotated
  // bounding circle stays the same). Reject any placement that comes
  // within MIN_GAP_PX of an existing icon's bounding circle. Stop trying
  // after MAX_PLACEMENT_ATTEMPTS to avoid infinite loops in dense tiles.
  function makeTileSVG() {
    const placed = []; // [{cx, cy, r}]
    let inner = "";
    for (let i = 0; i < ICONS_PER_TILE; i++) {
      let cx, cy, size, r, ok = false;
      for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
        size = rand(ICON_SIZE_MIN, ICON_SIZE_MAX);
        r = size / 2;
        cx = rand(r, TILE_SIZE - r);
        cy = rand(r, TILE_SIZE - r);
        ok = true;
        for (const p of placed) {
          const dx = cx - p.cx, dy = cy - p.cy;
          const need = r + p.r + MIN_GAP_PX;
          if (dx * dx + dy * dy < need * need) { ok = false; break; }
        }
        if (ok) break;
      }
      if (!ok) continue; // couldn't fit; just skip and move on
      placed.push({ cx, cy, r });
      const iconPath = ICONS[Math.floor(Math.random() * ICONS.length)];
      const rot = rand(-25, 25);
      const scale = size / 100;
      inner += `<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${rot.toFixed(1)}) scale(${scale.toFixed(3)}) translate(-50 -50)">${iconPath}</g>`;
    }
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE_SIZE} ${TILE_SIZE}" width="${TILE_SIZE}" height="${TILE_SIZE}">` +
      `<g fill="none" stroke="${STROKE_COLOR}" stroke-opacity="${STROKE_OPACITY}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">${inner}</g>` +
      `</svg>`
    );
  }

  function dataUrl(svg) {
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  }

  function install() {
    if (!document.body) return;
    const tile = makeTileSVG();
    const bg = dataUrl(tile);
    // Body already has the mint --bg color from style.css. We layer the
    // SVG sprinkle on top of it, with the mint as the background color.
    // backgroundImage stacks over backgroundColor so the body's mint
    // base shows through the SVG (which has fully transparent fills).
    document.body.style.backgroundImage = bg;
    document.body.style.backgroundRepeat = "repeat";
    document.body.style.backgroundSize = `${TILE_SIZE}px ${TILE_SIZE}px`;
    // Attach as fixed so the pattern doesn't scroll out from under the
    // content. (Optional — comment out for a parallax-free look.)
    document.body.style.backgroundAttachment = "fixed";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
})();
