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
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // ---------- pixel icons (ASCII grids) ----------
  const PAL = {
    k: "#0b0a08", p: "#e8dcc3", w: "#fff6e0", d: "#c4b48f", r: "#c8102e", h: "#ff2444",
    o: "#ff7518", g: "#58e05c", y: "#ffd166", b: "#37d0ff", n: "#9a9a9a",
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
  function icon(name, size = 16) {
    const rows = ICONS[name] || ICONS.x;
    const h = rows.length, w = rows[0].length;
    const k = Math.max(1, Math.floor(size / w));
    let rects = "";
    rows.forEach((row, y) => [...row].forEach((c, x) => {
      if (PAL[c]) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${PAL[c]}"/>`;
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
    if (!$(".tbar", el)) {
      const tb = document.createElement("div");
      tb.className = "tbar";
      tb.innerHTML = `<span class="ico">${icon(w.icon, 16)}</span><span class="ttl">${esc(w.title)}</span>`
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

  function spawn({ id, title, icon: ic = "x", cls = "", width, html, onClose }) {
    const el = document.createElement("div");
    el.className = "win " + cls; el.id = id; el.hidden = true;
    el.dataset.title = title; el.dataset.icon = ic;
    if (width) el.dataset.width = width;
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

  function open(id, at, { scroll = true } = {}) {
    const w = wins.get(id);
    if (!w) return;
    const wasHidden = w.el.hidden;
    w.el.hidden = false; w.min = false; w.open = true;
    if (floating() && !w.static) {
      if (at) place(w.el, at);
      else if (!w.el.dataset.placed) place(w.el, { x: 120 + (wins.size % 6) * 28, y: 24 + (wins.size % 6) * 28 });
    }
    focus(id);
    fit();
    if (scroll && !floating() && wasHidden && !w.el.classList.contains("profile")) {
      w.el.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    }
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
      const snap = v => Math.round(v / 4) * 4;
      const x = snap(ox + e.clientX - sx), y = snap(oy + e.clientY - sy);
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
    desktop.style.minHeight = Math.max(innerHeight, bottom + 24 + 48) + "px";
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
    startmenu.innerHTML = `<div class="band">HUNTER×HALLOWEEN</div><div class="items"></div>`;
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

  // lines: { text, ok, wait, pause }. Click anywhere to skip.
  function boot(lines) {
    const el = $("#boot");
    if (!el || reduced) return Promise.resolve();
    return new Promise(res => {
      let done = false;
      const finish = () => { if (done) return; done = true; el.classList.remove("on"); el.onclick = null; res(); };
      el.classList.add("on"); el.innerHTML = ""; el.onclick = finish;
      (async () => {
        for (const l of lines) {
          if (done) return;
          const d = document.createElement("div");
          d.className = "cur"; el.append(d);
          for (const ch of l.text) { if (done) return; d.textContent += ch; await wait(12); }
          if (l.ok) { await wait(l.wait || 350); if (done) return; d.textContent += " OK"; }
          d.classList.remove("cur");
          await wait(l.pause || 120);
        }
        const d = document.createElement("div");
        d.className = "cur"; el.append(d);
        await wait(700);
        finish();
      })();
    });
  }

  // ---------- init ----------
  function init({ start = false } = {}) {
    desktop = $(".desktop");
    setCRT(crtOn());
    taskbar = $("#taskbar");
    if (taskbar) {
      taskbar.innerHTML =
        (start ? `<button class="btn start" id="startbtn" type="button">${icon("pumpkin", 24)}<span>Start</span></button>` : "")
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
    init, register, spawn, open, close, minimize, focus, toggleMax, fit,
    floating, icon, sprite, toast, type, boot, setCRT, backdrop, startMenu, esc,
    get active() { return activeId; },
    win: id => wins.get(id),
  };
})();
