/* Hunter Website — retro window manager, taskbar, start menu, pixel helpers.
   Shared by the hxh pages. Windows are floating + draggable at >= 900px,
   stacked in flow on phones (see retro.css). */
const Retro = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const wins = new Map();
  let zTop = 10, activeId = null, desktop = null, taskbar = null, startmenu = null, backdropEl = null;
  let menuItems = null;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const floating = () => matchMedia("(min-width: 900px)").matches && !document.body.classList.contains("nofloat");
  // The desktop runs under a CSS zoom (retro.css); pointer/viewport
  // pixels must be divided by it to land in layout pixels.
  const zoom = () => parseFloat(getComputedStyle(document.body).zoom) || 1;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // ---------- pixel icons (ASCII grids) ----------
  const PAL = {
    k: "#0b0a08", p: "#e8dcc3", w: "#fff6e0", d: "#c4b48f", r: "#c8102e", h: "#ff2444",
    o: "#ff7518", g: "#58e05c", y: "#ffd166", b: "#37d0ff", n: "#9a9a9a",
    v: "#c8a2ff", u: "#7c4dff", N: "#1d3557", G: "#d9a520",
  };
  const ICONS = {
    x: [
      "r......r",
      "rr....rr",
      ".rr..rr.",
      "..rrrr..",
      "..rrrr..",
      ".rr..rr.",
      "rr....rr",
      "r......r",
    ],
    pumpkin: [
      ".....gg.....",
      "....gg......",
      "..oooooooo..",
      ".oooooooooo.",
      "oookoooookoo",
      "ookkkookkkoo",
      "oooooooooooo",
      "ookoooooooko",
      "ookkkkkkkkoo",
      ".ookkkkkkoo.",
      ".oooooooooo.",
      "..oooooooo..",
    ],
    envelope: [
      "kkkkkkkkkkkkkkkk",
      "kppppppppppppppk",
      "kkppppppppppppkk",
      "kpkppppppppppkpk",
      "kppkppppppppkppk",
      "kpppkpprrppkpppk",
      "kppppkprrpkppppk",
      "kpppppkkkkpppppk",
      "kppppppppppppppk",
      "kppppppppppppppk",
      "kkkkkkkkkkkkkkkk",
    ],
    folder: [
      ".kkkkkkk........",
      ".kyyyyyyk.......",
      ".kyyyyyyykkkkkkk",
      ".kyyyyyyyyyyyyyk",
      ".kkkkkkkkkkkkkkk",
      ".kyyyyyyyyyyyyyk",
      ".kyyyyyyyyyyyyyk",
      ".kyyyyyyyyyyyyyk",
      ".kyyyyyyyyyyyyyk",
      ".kyyyyyyyyyyyyyk",
      ".kkkkkkkkkkkkkkk",
    ],
    card: [
      "kkkkkkkkkkkkkkkk",
      "kwwwwwwwwwwwwwwk",
      "kwrrrrrrrrrrrrwk",
      "kwwwwwwwwwwwwwwk",
      "kwbbbbwwkkkkkwwk",
      "kwbbbbwwwwwwwwwk",
      "kwbbbbwwkkkwwwwk",
      "kwwwwwwwwwwwwwwk",
      "kwwwwkkkkkkkwwwk",
      "kwwwwwwwwwwwwwwk",
      "kkkkkkkkkkkkkkkk",
    ],
    question: [
      "kkkkkkkkkkkk",
      "kyyyyyyyyyyk",
      "kyyykkkkyyyk",
      "kyykyyyykyyk",
      "kyyyyyyykyyk",
      "kyyyyyykyyyk",
      "kyyyyykyyyyk",
      "kyyyyykyyyyk",
      "kyyyyyyyyyyk",
      "kyyyyykyyyyk",
      "kyyyyyyyyyyk",
      "kkkkkkkkkkkk",
    ],
    db: [
      "..kkkkkkkkkk..",
      ".kbbbbbbbbbbk.",
      ".kbbbbbbbbbbk.",
      "..kkkkkkkkkk..",
      ".kbbbbbbbbbbk.",
      ".kbbbbbbbbbbk.",
      "..kkkkkkkkkk..",
      ".kbbbbbbbbbbk.",
      ".kbbbbbbbbbbk.",
      "..kkkkkkkkkk..",
    ],
    crt: [
      "kkkkkkkkkkkk",
      "kggggggggggk",
      "kgkkkkkkkkgk",
      "kggggggggggk",
      "kgkkkkkkkkgk",
      "kggggggggggk",
      "kkkkkkkkkkkk",
      "....kkkk....",
      "..kkkkkkkk..",
    ],
    hourglass: [
      "kkkkkkkk",
      ".kyyyyk.",
      ".kyyyyk.",
      "..kyyk..",
      "..kppk..",
      ".kpyypk.",
      ".kyyyyk.",
      "kkkkkkkk",
    ],
    // purple square's blocky violet tee (boot splash logo)
    tee: [
      ".uuuuuu....uuuuuu.",
      "uvvvvvvuuuuvvvvvvu",
      "uvvvvvvvvvvvvvvvvu",
      "uvvvvvvvvvvvvvvvvu",
      "uvvvvvvvvvvvvvvvvu",
      "uuuuuvvvvvvvvuuuuu",
      "....uvvvvvvvvu....",
      "....uvvvvvvvvu....",
      "....uvvvvvvvvu....",
      "....uvvvvvvvvu....",
      "....uvvvvvvvvu....",
      "....uvvvvvvvvu....",
      "....uvvvvvvvvu....",
      "....uuuuuuuuuu....",
    ],
    // the Greed Island style binder: navy boards, gold clasps, ring emblem
    book: [
      ".kkkkkkkkkkkkk..",
      ".kNNNNNNNNNNNkG.",
      ".kNNNNNNNNNNNkG.",
      ".kNNNgggNNNNNk..",
      ".kNNgNNNgNNNNk..",
      ".kNNNgggNNNNNk..",
      ".kNNNNNNNNNNNkG.",
      ".kNNNNNNNNNNNkG.",
      ".kNNNNNNNNNNNk..",
      ".kkkkkkkkkkkkk..",
    ],
    door: [
      "kkkkkkk...",
      "kpppppk...",
      "kpppppk...",
      "kpppppkrr.",
      "kpppkpkrrr",
      "kpppppkrr.",
      "kpppppk...",
      "kpppppk...",
      "kkkkkkk...",
    ],
  };
  // Integer-scaled so pixels stay crisp: an 8-wide grid at size 16 is 2x.
  function icon(name, size = 16, pal = null) {
    const rows = ICONS[name] || ICONS.x;
    const h = rows.length, w = rows[0].length;
    const k = Math.max(1, Math.floor(size / w));
    const colors = pal ? { ...PAL, ...pal } : PAL;
    let rects = "";
    rows.forEach((row, y) => [...row].forEach((c, x) => {
      if (colors[c]) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${colors[c]}"/>`;
    }));
    return `<svg class="px" viewBox="0 0 ${w} ${h}" width="${w * k}" height="${h * k}" aria-hidden="true">${rects}</svg>`;
  }

  // Emoji drawn on a tiny canvas and upscaled nearest-neighbour = a pixel sprite.
  function sprite(emoji, n = 16) {
    const c = document.createElement("canvas");
    c.className = "px"; c.width = n; c.height = n;
    const g = c.getContext("2d");
    g.font = `${Math.round(n * 0.8)}px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif`;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(emoji, n / 2, n / 2 + n * 0.06);
    // Kill anti-aliasing and snap to the 216-colour web palette so it reads
    // as pixel art rather than a blurry upscale.
    const d = g.getImageData(0, 0, n, n), px = d.data;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 110) { px[i + 3] = 0; continue; }
      px[i + 3] = 255;
      px[i] = Math.round(px[i] / 51) * 51;
      px[i + 1] = Math.round(px[i + 1] / 51) * 51;
      px[i + 2] = Math.round(px[i + 2] / 51) * 51;
    }
    g.putImageData(d, 0, 0);
    return c;
  }

  // Circular initials avatar from the shared-auth profile fields
  // (initial + color, both set by the admin). Text flips to ink on pale
  // colours — same luminance rule as the rv admin page.
  function textColorFor(hex) {
    if (!/^#[0-9a-f]{6}$/i.test(hex || "")) return "#fff6e0";
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 170 ? "#0b0a08" : "#fff6e0";
  }
  function avatar(acct, cls = "") {
    const color = acct?.color || "#9a9a9a";
    return `<span class="avatar ${cls}" style="--c:${esc(color)};--t:${textColorFor(color)}" title="${esc(acct?.display_name || "")}">${esc(acct?.initial || "?")}</span>`;
  }
  // Remember the logged-in user; the Start menu shows them in its
  // header (Windows style), nothing in the tray.
  let currentUser = null;
  function setUser(acct) { currentUser = acct || null; }

  // ---------- windows ----------
  function register(el, o = {}) {
    const id = el.id;
    const w = {
      el, id,
      title: el.dataset.title || "", icon: el.dataset.icon || "x",
      closable: !el.hasAttribute("data-noclose"), task: !el.hasAttribute("data-notask"),
      static: el.hasAttribute("data-static") || el.classList.contains("static"),
      open: !el.hidden, min: false, onClose: null, ...o,
    };
    if (w.static) el.classList.add("static");
    if (el.dataset.width) el.style.width = el.dataset.width + "px";
    if (el.hasAttribute("data-chromeless")) el.classList.add("chromeless");
    if (!$(".tbar", el) && !el.hasAttribute("data-chromeless")) {
      const tb = document.createElement("div");
      tb.className = "tbar";
      // The crimson × app icon would vanish on the crimson title bar, so
      // it is drawn in cream there.
      tb.innerHTML = `<span class="ico">${icon(w.icon, 16, w.icon === "x" ? { r: "#fff6e0" } : null)}</span><span class="ttl">${esc(w.title)}</span>`
        + (w.static ? "" : `<button class="tbtn min" title="Minimize" type="button">_</button><button class="tbtn maxb" title="Maximize" type="button">□</button>`)
        + (w.closable ? `<button class="tbtn close" title="Close" type="button">×</button>` : "");
      el.prepend(tb);
      $(".min", tb)?.addEventListener("click", e => { e.stopPropagation(); minimize(id); });
      $(".maxb", tb)?.addEventListener("click", e => { e.stopPropagation(); toggleMax(id); });
      $(".close", tb)?.addEventListener("click", e => { e.stopPropagation(); close(id); });
      drag(el, tb);
    }
    el.addEventListener("pointerdown", () => focus(id), true);
    wireMenus(el);
    wins.set(id, w);
    return el;
  }

  function spawn({ id, title, icon: ic = "x", cls = "", width, html, onClose, noclose = false, notask = false }) {
    const el = document.createElement("div");
    el.className = "win " + cls; el.id = id; el.hidden = true;
    el.dataset.title = title; el.dataset.icon = ic;
    if (width) el.dataset.width = width;
    if (noclose) el.setAttribute("data-noclose", "");
    if (notask) el.setAttribute("data-notask", "");
    el.innerHTML = `<div class="body">${html}</div>`;
    desktop.append(el);
    register(el, { onClose });
    return el;
  }

  function focus(id) {
    const w = wins.get(id);
    if (!w || w.el.hidden) return;
    if (activeId !== id) {
      wins.forEach(x => x.el.classList.add("inactive"));
      w.el.classList.remove("inactive");
      activeId = id;
    }
    if (!w.static) w.el.style.zIndex = ++zTop;
    renderTasks();
  }

  // jank: true paints the empty frame first, the menu bar ~90ms later,
  // the body ~200ms in — a 90s machine drawing a window. Returns a
  // promise that resolves once the content is visible.
  async function open(id, at, { scroll = true, jank = false } = {}) {
    const w = wins.get(id);
    if (!w) return;
    const wasHidden = w.el.hidden;
    if (jank && !reduced) w.el.classList.add("loading");
    w.el.hidden = false; w.min = false; w.open = true;
    if (floating() && !w.static) {
      if (at) place(w.el, at);
      else if (!w.el.dataset.placed) place(w.el, { x: 150 + (wins.size % 6) * 35, y: 30 + (wins.size % 6) * 35 });
    }
    focus(id);
    fit();
    if (scroll && !floating() && wasHidden && !w.el.classList.contains("profile")) {
      w.el.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    }
    if (jank && !reduced) {
      await wait(90);
      w.el.classList.replace("loading", "loading2");
      await wait(110);
      w.el.classList.remove("loading2");
    }
  }
  // Position a window without opening it (so a later open lands there).
  function placeWin(id, at) {
    const w = wins.get(id);
    if (w && floating() && !w.static) place(w.el, at);
  }
  function place(el, { x, y, w }) {
    if (w) el.style.width = w + "px";
    el.style.left = Math.max(0, Math.round(x)) + "px";
    el.style.top = Math.max(0, Math.round(y)) + "px";
    el.dataset.placed = "1";
  }
  function close(id) {
    const w = wins.get(id);
    if (!w) return;
    w.el.hidden = true; w.open = false; w.min = false;
    if (activeId === id) { activeId = null; focusTop(); }
    renderTasks(); fit();
    w.onClose?.();
  }
  function minimize(id) {
    const w = wins.get(id);
    if (!w) return;
    w.el.hidden = true; w.min = true;
    if (activeId === id) { activeId = null; focusTop(); }
    renderTasks(); fit();
  }
  function focusTop() {
    let best = null;
    wins.forEach(w => { if (!w.el.hidden && !w.static && (!best || +w.el.style.zIndex > +best.el.style.zIndex)) best = w; });
    if (best) focus(best.id);
  }
  function toggleMax(id) {
    const w = wins.get(id);
    if (!w) return;
    w.el.classList.toggle("max");
    focus(id); fit();
  }

  function drag(el, handle) {
    let sx, sy, ox, oy, moving = false;
    handle.addEventListener("pointerdown", e => {
      if (e.button !== 0 || e.target.closest(".tbtn") || !floating() || el.classList.contains("max") || el.classList.contains("static")) return;
      moving = true; sx = e.clientX; sy = e.clientY; ox = el.offsetLeft; oy = el.offsetTop;
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    handle.addEventListener("pointermove", e => {
      if (!moving) return;
      const snap = v => Math.round(v / 4) * 4, z = zoom();
      const x = snap(ox + (e.clientX - sx) / z), y = snap(oy + (e.clientY - sy) / z);
      el.style.left = Math.min(desktop.clientWidth - 80, Math.max(80 - el.offsetWidth, x)) + "px";
      el.style.top = Math.max(0, y) + "px";
    });
    const end = () => { if (!moving) return; moving = false; fit(); };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

  // Grow the desktop so the page scrolls to the lowest window.
  function fit() {
    if (!desktop) return;
    if (!floating()) { desktop.style.minHeight = ""; return; }
    let bottom = 0;
    wins.forEach(w => { if (w.el.hidden || w.static) return; bottom = Math.max(bottom, w.el.offsetTop + w.el.offsetHeight); });
    desktop.style.minHeight = Math.max(innerHeight / zoom(), bottom + 24 + 48) + "px";
  }
  function relayout() {
    if (!floating()) { fit(); return; }
    wins.forEach(w => {
      if (w.static || w.el.hidden) return;
      const maxX = desktop.clientWidth - 80;
      if (w.el.offsetLeft > maxX) w.el.style.left = Math.max(0, desktop.clientWidth - w.el.offsetWidth - 16) + "px";
    });
    fit();
  }

  // ---------- menus ----------
  function wireMenus(root) {
    root.querySelectorAll(".menu > button").forEach(b => b.addEventListener("click", e => {
      e.stopPropagation();
      const m = b.parentElement, was = m.classList.contains("open");
      closeMenus(); closeStart();
      if (!was) m.classList.add("open");
    }));
    root.querySelectorAll(".dd button").forEach(b => b.addEventListener("click", () => closeMenus()));
  }
  function closeMenus() { document.querySelectorAll(".menu.open").forEach(m => m.classList.remove("open")); }

  function startMenu(items) { menuItems = items; }
  function renderStart() {
    if (!startmenu || !menuItems) return;
    const items = typeof menuItems === "function" ? menuItems() : menuItems;
    const head = currentUser
      ? `<div class="user">${avatar(currentUser, "lg")}<span class="name">${esc(currentUser.display_name || currentUser.username || "")}</span></div>`
      : "";
    startmenu.innerHTML = `${head}<div class="row"><div class="band">HUNTER×HALLOWEEN</div><div class="items"></div></div>`;
    const box = $(".items", startmenu);
    items.forEach(it => {
      if (it === "sep") { box.append(document.createElement("hr")); return; }
      const b = document.createElement("button");
      b.type = "button";
      if (it.check) { b.classList.add("chk"); b.classList.toggle("on", !!it.check()); }
      if (it.icon) b.innerHTML = icon(it.icon, 16);
      b.append(it.label);
      b.addEventListener("click", () => { closeStart(); it.onclick?.(); });
      box.append(b);
    });
  }
  function toggleStart() {
    if (!startmenu) return;
    const open = startmenu.classList.contains("open");
    closeMenus();
    if (open) closeStart(); else { renderStart(); startmenu.classList.add("open"); $("#startbtn")?.classList.add("pressed"); }
  }
  function closeStart() { startmenu?.classList.remove("open"); $("#startbtn")?.classList.remove("pressed"); }

  // ---------- taskbar ----------
  function renderTasks() {
    const box = taskbar && $(".tasks", taskbar);
    if (!box) return;
    box.innerHTML = "";
    wins.forEach((w, id) => {
      if (!w.task || w.static || !w.open) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn task" + (id === activeId && !w.min ? " pressed" : "");
      b.innerHTML = icon(w.icon, 16) + `<span>${esc(w.title)}</span>`;
      b.title = w.title;
      b.addEventListener("click", () => { if (id === activeId && !w.min) minimize(id); else open(id); });
      box.append(b);
    });
  }
  function tickClock() {
    const c = taskbar && $(".clock", taskbar);
    if (c) c.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // ---------- crt / backdrop / toast / typewriter / boot ----------
  function crtOn() { try { return localStorage.getItem("hxh.crt") !== "0"; } catch { return true; } }
  function setCRT(on) {
    document.body.classList.toggle("crt", on);
    try { localStorage.setItem("hxh.crt", on ? "1" : "0"); } catch {}
    document.querySelectorAll("[data-crt]").forEach(x => x.classList.toggle("on", on));
  }
  function backdrop(on, onClick) {
    if (!backdropEl) return;
    backdropEl.classList.toggle("on", on);
    backdropEl.onclick = on ? onClick : null;
  }

  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    if (!t) return;
    $(".body", t).textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
  }

  // runs: string | { t, tag, cls, title }. Returns { skip }.
  function type(el, runs, { speed = 16, onDone, instant = false } = {}) {
    const seq = runs.map(r => typeof r === "string" ? { t: r } : r);
    const node = (r, text) => {
      const n = document.createElement(r.tag || "span");
      if (r.cls) n.className = r.cls;
      if (r.title) n.title = r.title;
      n.textContent = text;
      return n;
    };
    let ri = 0, ci = 0, span = null, timer = null, done = false;
    const finish = () => {
      if (done) return;
      done = true; clearInterval(timer);
      el.innerHTML = ""; seq.forEach(r => el.append(node(r, r.t)));
      el.classList.remove("cur"); onDone?.();
    };
    el.innerHTML = "";
    if (reduced || instant) { finish(); return { skip: finish }; }
    el.classList.add("cur");
    timer = setInterval(() => {
      if (ri >= seq.length) { finish(); return; }
      const r = seq[ri];
      if (!span) { span = node(r, ""); el.append(span); }
      span.textContent += r.t[ci++];
      if (ci >= r.t.length) { ri++; ci = 0; span = null; }
    }, speed);
    return { skip: finish };
  }

  // { splash: { html, ms }, lines: [{ text, ok, wait, pause }], speed }
  // — an optional publisher splash, then BIOS-style lines. Click to skip.
  function boot({ splash, badge, lines = [], speed = 12, tail = 600 } = {}) {
    const el = $("#boot");
    if (!el || reduced) return Promise.resolve();
    return new Promise(res => {
      let done = false;
      const finish = () => { if (done) return; done = true; el.classList.remove("on"); el.onclick = null; res(); };
      el.classList.add("on"); el.innerHTML = ""; el.onclick = finish;
      if (badge) {
        const b = document.createElement("div");
        b.className = "badge"; b.innerHTML = badge;
        el.append(b);
      }
      (async () => {
        if (splash) {
          const sp = document.createElement("div");
          sp.className = "splash"; sp.innerHTML = splash.html;
          el.append(sp);
          await wait(splash.ms || 900);
          if (done) return;
          sp.remove();
        }
        for (const l of lines) {
          if (done) return;
          const d = document.createElement("div");
          d.className = "cur"; el.append(d);
          for (const ch of l.text) { if (done) return; d.textContent += ch; await wait(speed); }
          if (l.ok) { await wait(l.wait || 300); if (done) return; d.textContent += " OK"; }
          d.classList.remove("cur");
          await wait(l.pause || 100);
        }
        const d = document.createElement("div");
        d.className = "cur"; el.append(d);
        await wait(tail);
        finish();
      })();
    });
  }

  // ---------- wallpaper: pixel-art Whale Island ----------
  // Drawn procedurally at 320x180 and scaled up with image-rendering:
  // pixelated. Original art (inspired by the island's silhouette: a
  // forested hump, a low tail with the harbour town and lighthouse).
  // Sea sparkles, clouds drift very slowly, a flock of birds crosses
  // now and then. 8 fps; static under prefers-reduced-motion.
  function wallpaper(canvas) {
    if (!canvas) return;
    const W = 320, H = 180, HZ = 112;   // horizon row
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    const layer = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; return c; };
    const px = (g, x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
    // deterministic hash so the island is the same every visit
    const hash = (x, y = 0) => { let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

    // sky
    const sky = layer(), sg = sky.getContext("2d");
    const SKY = ["#2456a4", "#2f6cc0", "#3f86d6", "#5aa2e6", "#86c0f0"];
    for (let y = 0; y < HZ; y++) {
      const f = y / HZ * SKY.length, i = Math.min(SKY.length - 1, Math.floor(f)), frac = f - i;
      for (let x = 0; x < W; x++) {
        // 2-row checker dither at each band boundary
        const dither = frac > 0.8 && i < SKY.length - 1 && (x + y) % 2 === 0;
        px(sg, x, y, SKY[dither ? i + 1 : i]);
      }
    }

    // sea (with the island's dark reflection under its footprint)
    const sea = layer(), eg = sea.getContext("2d");
    const SEA = ["#2c73b5", "#245f9c", "#1c4b80", "#163b66"];
    const seaBand = y => y < HZ + 8 ? 0 : y < HZ + 22 ? 1 : y < HZ + 44 ? 2 : 3;
    for (let y = HZ; y < H; y++) for (let x = 0; x < W; x++) {
      let b = seaBand(y);
      const edge = [HZ + 8, HZ + 22, HZ + 44].some(e => y === e - 1) && (x + y) % 2 === 0;
      if (edge) b = Math.min(3, b + 1);
      let col = SEA[b];
      if (hash(Math.floor(x / 6), y) < 0.045) col = SEA[Math.min(3, b + 1)];   // short horizontal wave streaks
      if (y < HZ + 7 && x > 96 && x < 240 && (x + y) % 2 === 0) col = SEA[Math.min(3, b + 1)]; // reflection
      px(eg, x, y, col);
    }

    // island
    const isl = layer(), ig = isl.getContext("2d");
    const GREEN = ["#24552b", "#2f6f35", "#3f8c42", "#7cc26a"];
    const hump = (x, c, h, w) => h * Math.exp(-(((x - c) / w) ** 2));
    const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
    const height = x => {
      if (x < 88 || x > 240) return 0;
      const taper = smooth((x - 88) / 14) * smooth((240 - x) / 4);
      // broad rounded hump (flattened gaussian), a low back that dips to a
      // neck, then the tail lifts at the tip like a raised fluke (after
      // the reference) — the rock spire stands on that lift
      const hump = 38 * Math.pow(Math.exp(-(((x - 134) / 34) ** 2)), 0.7);
      const back = 11 * smooth((x - 96) / 30) * smooth((222 - x) / 14);
      const fluke = 17 * smooth((x - 206) / 22) * smooth((238 - x) / 6);
      const h = Math.max(hump, back, fluke) + Math.floor(hash(x) * 3);
      return Math.round(h * taper);
    };
    const hs = Array.from({ length: W }, (_, x) => height(x));
    for (let x = 0; x < W; x++) {
      const h = hs[x];
      if (!h) continue;
      const slope = (hs[x + 1] || 0) - (hs[x - 1] || 0);   // >0: rising to the right (faces left/sun)
      for (let y = HZ - h; y < HZ; y++) {
        const d = y - (HZ - h);                            // depth below the ridge
        let col;
        if (d === 0) col = GREEN[3];
        else if (d < 3 && slope > 0) col = GREEN[2];
        else if (slope < -1 && d < h * 0.6) col = (x + y) % 2 ? GREEN[0] : GREEN[1];
        else col = hash(x, y) < 0.35 ? GREEN[0] : GREEN[1];
        px(ig, x, y, col);
      }
      px(ig, x, HZ - 1, x > 98 && x < 236 ? "#c9b88a" : GREEN[0]);   // beach strip
    }
    // harbour town on the low tail
    const ROOF = ["#c8102e", "#ff7518", "#c8102e", "#e8dcc3", "#ff7518", "#c8102e", "#7c4dff", "#c8102e"];
    [154, 159, 165, 170, 176, 182, 188, 194].forEach((x, i) => {
      const w = i % 3 === 1 ? 4 : 3, top = HZ - 5 - (i % 2);
      ig.fillStyle = ROOF[i]; ig.fillRect(x, top, w, 1);
      ig.fillStyle = "#efe3c8"; ig.fillRect(x, top + 1, w, HZ - 1 - (top + 1));
      px(ig, x + 1, HZ - 2, "#0b0a08");
    });
    // the tail: a pale rock spire rising from the knoll at the island's
    // tip — wide at the base, tapering, leaning outward like a raised
    // fluke (after the reference) — with a little surf at the point
    const SP = 18, sx0 = 229, base = HZ - hs[sx0] + 2;   // foot sunk 2px into the green
    for (let k = 0; k < SP; k++) {                       // k = 0 is the top
      const t = k / (SP - 1);
      const w = 1 + Math.round(5 * Math.pow(t, 1.4));     // 1px tip → 6px foot
      const cx = sx0 + Math.round(3 * (1 - t));           // top leans 3px outward
      const y = base - SP + 1 + k;
      for (let dx = -Math.floor(w / 2); dx < w - Math.floor(w / 2); dx++) {
        const f = (dx + Math.floor(w / 2)) / Math.max(1, w - 1);   // 0 = lit left edge, 1 = shaded right edge
        px(ig, cx + dx, y, k === 0 ? "#fff6e0" : f < 0.35 ? "#f1e6cc" : f < 0.8 ? "#dccb9f" : "#b8a071");
      }
    }
    for (const dx of [-3, -2, 3]) { px(ig, sx0 + dx, base - 1, GREEN[2]); px(ig, sx0 + dx, base - 2, GREEN[1]); }   // scrub over the foot
    for (const x of [238, 239, 241, 242]) px(ig, x, HZ - 1, "#fff6e0");         // surf at the tip
    // pier into the sea
    ig.fillStyle = "#8b6d4b"; ig.fillRect(172, HZ, 14, 1); px(ig, 185, HZ + 1, "#8b6d4b"); px(ig, 174, HZ + 1, "#8b6d4b");

    // clouds (after the pixel-sky reference): clusters of round lobes
    // top AND bottom — a scalloped underside, not a flat base — in a
    // pale lilac-white, a lilac shadow that follows the lower scallops,
    // and white highlight blobs in the upper lobes.
    const CLOUD = { base: "#f1ebf8", shade: "#d8cdea", shade2: "#c9bde0", hi: "#ffffff" };
    const makeCloud = (lobes, w, h) => {
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const g = c.getContext("2d");
      const within = (x, y, l) => ((x - l[0]) / l[2]) ** 2 + ((y - l[1]) / (l[2] * .85)) ** 2 <= 1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const inside = lobes.filter(l => within(x, y, l));
        if (!inside.length) continue;
        // shadow along the real underside only: the pixel sits in the lower
        // part of every lobe holding it AND nothing of the cloud lies a few
        // pixels below it (so notches between the top lobes stay bright)
        const below = k => lobes.some(l => within(x, y + k, l));
        const low = inside.every(l => y > l[1] + l[2] * .15) && !below(6);
        const lower = low && !below(3);
        const hi = !low && inside.some(l => ((x - l[0] + l[2] * .18) / (l[2] * .52)) ** 2 + ((y - l[1] + l[2] * .22) / (l[2] * .45)) ** 2 <= 1);
        px(g, x, y, lower ? CLOUD.shade2 : low ? CLOUD.shade : hi ? CLOUD.hi : CLOUD.base);
      }
      return c;
    };
    // [cx, cy, r] lobes: a top row of big ones, a bottom row of smaller
    // ones tucked under them
    const clouds = [
      { img: makeCloud([[14, 11, 10], [28, 8, 12], [43, 10, 11], [56, 13, 8], [9, 17, 7], [22, 19, 8], [36, 19, 8], [49, 18, 8], [60, 17, 6]], 70, 27), x: 18, y: 12, v: 0.10 },
      { img: makeCloud([[9, 8, 7], [19, 6, 9], [29, 9, 7], [6, 13, 5], [15, 14, 6], [25, 14, 6], [33, 13, 5]], 40, 20), x: 128, y: 42, v: 0.06 },
      { img: makeCloud([[16, 14, 13], [34, 9, 15], [52, 12, 13], [66, 16, 9], [10, 21, 8], [25, 24, 9], [42, 24, 9], [58, 23, 8], [70, 21, 6]], 80, 33), x: 214, y: 6, v: 0.08 },
      { img: makeCloud([[7, 6, 5], [14, 4, 6], [21, 6, 5], [5, 10, 4], [12, 11, 4], [19, 10, 4]], 27, 15), x: 300, y: 60, v: 0.05 },
      { img: makeCloud([[10, 9, 8], [21, 6, 10], [33, 9, 8], [42, 12, 6], [7, 15, 6], [18, 17, 7], [30, 17, 7], [40, 16, 5]], 50, 23), x: 66, y: 70, v: 0.07 },
      { img: makeCloud([[6, 5, 5], [13, 4, 6], [5, 9, 4], [12, 10, 4]], 20, 13), x: 178, y: 30, v: 0.09 },
    ];

    // glitter (after the sea reference): a narrow inverted bell hanging
    // from the horizon — about 65% of the sea deep at the centre, nothing
    // at the sides — with a short strip along the horizon. Brightest and
    // clumpy near the top, easing off with depth, and a scatter of
    // stragglers beyond the curve so the edge isn't perfect; each
    // candidate pixel twinkles on its own 2-4 frame clock.
    let flock = null, nextFlock = 60, tick = 0;
    const GX = W * 0.5, GS = 40, GD = 44;                 // a narrow bell: σ = 12% of the width
    const bell = (x, k = 1) => Math.exp(-(((x - GX) / (GS * k)) ** 2) / 2);
    const glints = [];
    for (let y = HZ; y < H; y++) for (let x = 0; x < W; x++) {
      const d = y - HZ, dmax = GD * bell(x);
      let dens;
      if (d <= dmax) {
        // inside the bell: brightest at the horizon, easing off with depth
        const t = d / dmax;
        dens = 0.55 * Math.pow(1 - t, 1.4) * (0.55 + 0.45 * bell(x));
      } else {
        // stragglers outside the curve, rarer the farther from it
        dens = 0.05 * Math.exp(-(d - dmax) / 12) * (0.4 + 0.6 * bell(x, 1.6));
      }
      if (d <= 1) dens = Math.max(dens, 0.2 * bell(x, 1.4));      // a short strip along the horizon
      dens *= 0.65 + 0.7 * hash((x >> 2) + 977, y >> 2);           // clumps, like the reference
      if (dens < 0.012) continue;
      glints.push({ i: y * W + x, x, y, d: Math.min(dens, 0.9), phase: (hash(x, y) * 7) | 0, per: 2 + ((hash(y, x) * 3) | 0), big: d > 10 && d <= dmax && hash(x * 3, y) < 0.06 });
    }
    const drawGlints = () => {
      for (const g of glints) {
        const r = hash(g.i, ((tick + g.phase) / g.per) | 0);
        if (r >= g.d) continue;
        const c = r < g.d * 0.5 ? "#ffffff" : "#d2ecff";
        px(ctx, g.x, g.y, c);
        if (g.big) { px(ctx, g.x - 1, g.y, c); px(ctx, g.x + 1, g.y, c); px(ctx, g.x, g.y - 1, c); px(ctx, g.x, g.y + 1, c); }
      }
    };
    const BIRD = [[[0, 0], [2, 0], [1, 1]], [[1, 0], [0, 1], [2, 1]]];
    const spawnFlock = () => {
      const dir = Math.random() < 0.5 ? -1 : 1;
      flock = { x: dir < 0 ? W + 6 : -12, y: 14 + Math.random() * 50, dir,
        birds: Array.from({ length: 3 + Math.floor(Math.random() * 3) }, (_, i) => [i * 5, (i % 2) * 2 + Math.floor(i / 2) * 2]) };
    };

    const frame = () => {
      tick++;
      ctx.drawImage(sky, 0, 0);
      for (const c of clouds) {
        if (!reduced) { c.x += c.v; if (c.x > W + 4) c.x = -c.img.width - 4; }
        ctx.drawImage(c.img, Math.round(c.x), c.y);
      }
      ctx.drawImage(sea, 0, 0);
      ctx.drawImage(isl, 0, 0);
      drawGlints();
      // birds
      if (!reduced) {
        if (!flock && --nextFlock <= 0) spawnFlock();
        if (flock) {
          flock.x += 1.6 * flock.dir;
          const f = BIRD[Math.floor(tick / 3) % 2];
          for (const [bx, by] of flock.birds) for (const [dx, dy] of f) px(ctx, Math.round(flock.x + bx + dx), Math.round(flock.y + by + dy), "#0b0a08");
          if (flock.x < -30 || flock.x > W + 30) { flock = null; nextFlock = 8 * (12 + Math.random() * 28); }
        }
      }
    };
    frame();
    if (!reduced) setInterval(() => { if (!document.hidden) frame(); }, 125);
  }

  // ---------- OS shell ----------
  // Every retro page opens inside the OS. The shell owns what used to be
  // re-added per page: one boot per browser session (HunterOS lines +
  // the purple-square badge), the session lookup, the Windows-style
  // logon dialog, the wallpaper (only once logged in), and logout —
  // which forgets the boot so the next logon screen boots again.
  // Pages are apps: `const me = await Retro.os({...})`, then open windows.
  const AUTH_API = "/admin/api";
  // Boot on every load — refresh, typed URL, logout — EXCEPT navigations
  // started from inside the OS (Retro.go), which leave a one-shot "warm"
  // flag so opening another page doesn't reboot the machine.
  const WARM_KEY = "hxh.warm";
  function go(url) {
    try { sessionStorage.setItem(WARM_KEY, "1"); } catch {}
    location.href = url;
  }
  const badge = () => `<div>a purple square<br>production</div>${icon("tee", 72)}`;
  const bootLines = (extra = []) => [
    { text: "HunterOS 99 · Hunter Association Network", pause: 260 },
    { text: "> connecting to hunter.net .........", ok: true, wait: 280, pause: 140 },
    { text: "> verifying license ................", ok: true, wait: 340, pause: 160 },
    ...extra,
  ];

  async function session() {
    try { const r = await fetch(AUTH_API + "/me"); return r.ok ? await r.json() : null; } catch { return null; }
  }
  async function login(username, password) {
    const r = await fetch(AUTH_API + "/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!r.ok) throw new Error(r.status === 401 ? "The committee does not recognize you." : "Something went wrong.");
    return r.json();
  }
  async function logout() {
    try { await fetch(AUTH_API + "/logout", { method: "POST" }); } catch {}
    location.href = "/hxh/";   // cold load: boots, then the logon screen
  }
  // "a purple square production" — on screen during boot and on the
  // logon / invite splashes; gone once the desktop is up.
  function showBadge() {
    if ($(".os-badge")) return;
    const b = document.createElement("div");
    b.className = "badge os-badge"; b.innerHTML = badge();
    document.body.append(b);
  }
  function hideBadge() { $(".os-badge")?.remove(); }

  // The logon dialog, alone on the bare desktop. Resolves with the account.
  function logon() {
    return new Promise(res => {
      desktop.classList.add("center");
      document.body.classList.add("logon");
      const el = spawn({
        id: "win-logon", title: "Hunter × Halloween — Log in", icon: "card", cls: "static", width: 500,
        noclose: true, notask: true,
        html: `
          <h1 class="logo">HUNTER<span class="x">×</span><br><span class="hallow">HALLOWEEN</span></h1>
          <p>Summoned applicants only. No summons? Reach out to the hosts.</p>
          <form id="logon-form">
            <label class="lbl" for="lg-u">Applicant</label>
            <input class="field" id="lg-u" name="username" autocomplete="username" required>
            <label class="lbl" for="lg-p">Password</label>
            <input class="field" id="lg-p" name="password" type="password" autocomplete="current-password" required>
            <div class="actions"><button class="btn primary wide" type="submit">Log in</button></div>
            <div class="msg err" id="lg-msg"></div>
          </form>
          <p class="forgot"><a href="#" id="lg-forgot">Forgot password?</a></p>`,
      });
      $(".body", el).style.textAlign = "center";
      $("#logon-form", el).style.textAlign = "left";
      // Forgot password: emails the reset link for the typed username
      // (the server answers the same way whether or not it exists).
      $("#lg-forgot", el).addEventListener("click", async e => {
        e.preventDefault();
        const msg = $("#lg-msg", el), u = $("#lg-u", el).value.trim();
        if (!u) { msg.textContent = "Type your applicant name first."; $("#lg-u", el).focus(); return; }
        msg.textContent = "";
        try { await fetch(AUTH_API + "/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u }) }); } catch {}
        msg.className = "msg ok";
        msg.textContent = "If that account has an email on file, a reset link is on its way.";
      });
      $("#logon-form", el).addEventListener("submit", async e => {
        e.preventDefault();
        const msg = $("#lg-msg", el);
        msg.textContent = "";
        try {
          const me = await login($("#lg-u", el).value.trim(), $("#lg-p", el).value);
          close("win-logon"); wins.delete("win-logon"); el.remove();
          desktop.classList.remove("center");
          document.body.classList.remove("logon");
          res(me);
        } catch (err) {
          msg.textContent = err.message;
        }
      });
      open("win-logon", null, { scroll: false, jank: true }).then(() => $("#lg-u", el).focus());
    });
  }

  function startWallpaper() {
    if ($(".wall")) return;
    const c = document.createElement("canvas");
    c.className = "wall"; c.width = 320; c.height = 180;
    document.body.prepend(c);
    wallpaper(c);
  }

  // os(): boot (once per session) → session → logon if needed → in.
  // Resolves with the account, or null when gate=false and logged out.
  async function os({ wallpaper: wp = false, taskbar: tb = true, start = false, gate = true, boot: doBoot = true, bootLines: extra = [] } = {}) {
    init({ start });
    if (taskbar) taskbar.hidden = true;   // nothing else on screen while booting / logging on
    let warm = false;
    try { warm = sessionStorage.getItem(WARM_KEY) === "1"; sessionStorage.removeItem(WARM_KEY); } catch {}
    const pending = session();
    if (doBoot && !warm) await boot({ badge: badge(), lines: bootLines(extra), speed: 9, tail: 420 });
    let me = await pending;
    if ((!me && gate) || !tb) showBadge();   // splash screens keep the badge
    if (!me && gate) me = await logon();
    if (tb) hideBadge();
    setUser(me);
    if (me && wp) startWallpaper();      // Whale Island only once you're in
    if (taskbar) taskbar.hidden = !tb;
    return me;
  }

  // ---------- init ----------
  function init({ start = false } = {}) {
    desktop = $(".desktop");
    setCRT(crtOn());
    taskbar = $("#taskbar");
    if (taskbar) {
      taskbar.innerHTML =
        (start ? `<button class="btn start" id="startbtn" type="button">${icon("pumpkin", 36)}<span>Start</span></button>` : "")
        + `<div class="tasks"></div>`
        + `<div class="tray"><button type="button" data-crt title="Scanlines">${icon("crt", 12)}</button><span class="clock"></span></div>`;
      $("#startbtn")?.addEventListener("click", e => { e.stopPropagation(); toggleStart(); });
      tickClock(); setInterval(tickClock, 1000);
    }
    startmenu = $("#startmenu");
    startmenu?.addEventListener("click", e => e.stopPropagation());

    const t = document.createElement("div");
    t.className = "win toast"; t.id = "toast";
    t.innerHTML = `<div class="tbar"><span class="ico">${icon("x", 16)}</span><span class="ttl">Hunter Website</span></div><div class="body"></div>`;
    document.body.append(t);
    const b = document.createElement("div");
    b.className = "boot"; b.id = "boot";
    document.body.append(b);
    backdropEl = document.createElement("div");
    backdropEl.className = "backdrop";
    document.body.append(backdropEl);

    document.querySelectorAll(".win[data-title]").forEach(el => register(el));
    document.addEventListener("click", e => {
      const c = e.target.closest("[data-crt]");
      if (c) { setCRT(!document.body.classList.contains("crt")); return; }
      closeMenus(); closeStart();
    });
    document.addEventListener("keydown", e => {
      if (e.key !== "Escape") return;
      closeMenus(); closeStart();
      const w = wins.get(activeId);
      if (w && w.open && w.closable && !w.static && w.el.classList.contains("popup")) close(activeId);
    });
    let rt;
    addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(relayout, 120); });
    setCRT(crtOn());
  }

  return {
    init, register, spawn, open, place: placeWin, close, minimize, focus, toggleMax, fit,
    floating, zoom, icon, sprite, avatar, setUser, textColorFor, toast, type, boot, setCRT, backdrop, startMenu, esc, wallpaper,
    os, go, session, login, logout, logon,
    get active() { return activeId; },
    win: id => wins.get(id),
  };
})();
