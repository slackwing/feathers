/* The Binder app: a chromeless window holding the Greed Island style card
   binder. Mount it before Retro.os() so the shell registers the window;
   it reads the full roster from roster.json (the master copy — field rules
   in foundry/website/hxh-roster/CHARACTER.md). */
const Binder = (() => {
  const TYPES = [
    { slug: "enhancement",    code: "EN", name: "Enhancer",    ja: "強化系", hue: "var(--enhancer)",    hex: "#ff5a36" },
    { slug: "transmutation",  code: "TR", name: "Transmuter",  ja: "変化系", hue: "var(--transmuter)",  hex: "#37d0ff" },
    { slug: "conjuration",    code: "CO", name: "Conjurer",    ja: "具現化系", hue: "var(--conjurer)",  hex: "#c09bff" },
    { slug: "emission",       code: "EM", name: "Emitter",     ja: "放出系", hue: "var(--emitter)",     hex: "#ffd166" },
    { slug: "manipulation",   code: "MA", name: "Manipulator", ja: "操作系", hue: "var(--manipulator)", hex: "#ff7ad9" },
    { slug: "specialization", code: "SP", name: "Specialist",  ja: "特質系", hue: "var(--specialist)",  hex: "#58e05c" },
    { slug: "",               code: "--", name: "Non-user",    ja: "非能力者", hue: "var(--none)",      hex: "#9a9a9a" },
  ];
  // Characters with no stated Nen type are filed by the arc they first
  // appear in, on muted arc-coloured tabs, so a page is still one tab.
  const ARCS = [
    { slug: "hunter-exam",       code: "EX", name: "Hunter Exam",       ja: "ハンター試験編",     hex: "#b8ad97" },
    { slug: "zoldyck-family",    code: "ZO", name: "Zoldyck Family",    ja: "ゾルディック家編",   hex: "#a89bb8" },
    { slug: "heavens-arena",     code: "HA", name: "Heavens Arena",     ja: "天空闘技場編",       hex: "#9fb8b0" },
    { slug: "yorknew-city",      code: "YN", name: "Yorknew City",      ja: "ヨークシン編",       hex: "#b8a0a0" },
    { slug: "greed-island",      code: "GI", name: "Greed Island",      ja: "グリードアイランド編", hex: "#a3b89b" },
    { slug: "chimera-ant",       code: "CA", name: "Chimera Ant",       ja: "キメラアント編",     hex: "#b8b493" },
    { slug: "chairman-election", code: "EL", name: "Chairman Election", ja: "会長選挙編",         hex: "#a8aec0" },
  ];
  const LIMIT = { S: 1, A: 2, B: 3, C: 4 };   // proposed claim limit per rank
  const PER_PAGE = 12;                        // 3 × 4 sleeves per page
  const esc = s => Retro.esc(s);
  const $ = (sel, r = document) => r.querySelector(sel);

  let el, book, pages = [], page = 0, sel = null, roster = [], typer = null, onClaim = null;

  const typeOf = c => TYPES.find(t => t.slug === (c.nen_types[0] || "")) || TYPES[TYPES.length - 1];
  const title = s => s.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
  const rankBox = c => `${c.rank || "C"}-${LIMIT[c.rank] || 4}`;
  const cardNo = c => String(c.no || 0).padStart(3, "0");

  // One tab per page; a group (Nen type, or first arc for the untyped)
  // never shares a page with another.
  function paginate(chars) {
    const out = [];
    const push = (group, mine) => {
      for (let i = 0; i < mine.length; i += PER_PAGE) {
        out.push({ type: group, cards: mine.slice(i, i + PER_PAGE), n: Math.floor(i / PER_PAGE) + 1, of: Math.ceil(mine.length / PER_PAGE) });
      }
    };
    for (const t of TYPES.slice(0, -1)) push(t, chars.filter(c => typeOf(c) === t));
    const untyped = chars.filter(c => !c.nen_types.length);
    for (const a of ARCS) push({ ...a, hue: a.hex }, untyped.filter(c => c.arcs[0] === a.slug));
    return out;
  }

  // Size to the viewport (most of the screen) and return where to put it.
  function layout() {
    if (!el || !Retro.floating()) return null;
    const vw = innerWidth, vh = innerHeight;
    // Andrew: "fill halfway the margins" of the first sizing (up to
    // 1180×780 with 24px/50px gutters) — so the binder takes the midpoint
    // between that and the full desktop above the taskbar.
    const w0 = Math.min(vw - 48, 1180), h0 = Math.min(vh - 100, 780);
    const bw = Math.round((vw + w0) / 2), bh = Math.round((vh - 36 + h0) / 2);
    el.style.setProperty("--bw", bw + "px");
    el.style.setProperty("--bh", bh + "px");
    el.style.setProperty("--pw", Math.floor((bw - 40) / 2) + "px");
    return { x: Math.max(16, Math.round((vw - bw) / 2)), y: Math.max(16, Math.round((vh - 36 - bh) / 2)) };
  }

  function mount({ desktop, claim } = {}) {
    onClaim = claim;
    el = document.createElement("div");
    el.className = "win chromeless popup binder";
    el.id = "win-binder";
    el.hidden = true;
    el.dataset.title = "Binder";
    el.dataset.icon = "book";
    el.setAttribute("data-chromeless", "");
    el.innerHTML = `
      <div class="book closed">
        <div class="cover" role="button" tabindex="0" title="Open">
          <i class="rivet tl"></i><i class="rivet tr"></i><i class="rivet bl"></i><i class="rivet br"></i>
          <div class="emblem"></div>
          <div class="plate">HUNTER<span class="x">×</span>HALLOWEEN<span class="ja">ハンター×ハロウィン</span></div>
          <div class="sub">BINDER<span class="ja">バインダー</span></div>
          <div class="clasps"><i></i><i></i></div>
        </div>
        <div class="inside">
          <div class="page">
            <div class="tabs"></div>
            <div class="cards"></div>
            <div class="pageno"></div>
          </div>
          <div class="spine"><i class="clasp"></i><i class="clasp"></i></div>
          <div class="panel">
            <div class="screen"></div>
            <div class="controls">
              <div class="keys">
                <button class="key" type="button" data-act="claim">CLAIM</button>
                <button class="key" type="button" data-act="shut">CLOSE</button>
              </div>
              <div class="dial"></div>
              <div class="pad"></div>
              <div class="dpad">
                <button type="button" data-dir="up" title="Previous card"></button>
                <button type="button" data-dir="left" title="Previous page"></button>
                <i class="c"></i>
                <button type="button" data-dir="right" title="Next page"></button>
                <button type="button" data-dir="down" title="Next card"></button>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    (desktop || $(".desktop")).append(el);
    book = $(".book", el);
    idle();

    const cover = $(".cover", el);
    cover.addEventListener("click", openBook);
    cover.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openBook(); } });
    el.addEventListener("click", e => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      const dir = e.target.closest("[data-dir]")?.dataset.dir;
      if (act === "shut") shut();
      if (act === "claim") claimSel();
      if (dir === "left") showPage(page - 1);
      if (dir === "right") showPage(page + 1);
      if (dir === "up" || dir === "down") step(dir === "up" ? -1 : 1);
    });
    addEventListener("resize", () => { if (!el.hidden) { const at = layout(); if (at) Retro.place("win-binder", at); Retro.fit(); } });

    fetch("roster.json", { cache: "no-cache" }).then(r => r.json()).then(list => {
      roster = list.map((c, i) => ({ ...c, no: c.no || i + 1 }));
      pages = paginate(roster);
      renderTabs();
      showPage(0);
    }).catch(() => { $(".cards", el).textContent = "The binder is empty."; });
    return el;
  }

  function openBook() {
    if (!book.classList.contains("closed")) return;
    book.classList.replace("closed", "flipping");
    setTimeout(() => { book.classList.replace("flipping", "open"); Retro.fit(); }, 260);
  }
  function shut() {
    book.classList.remove("open", "flipping");
    book.classList.add("closed");
    Retro.fit();
  }

  function renderTabs() {
    const tabs = $(".tabs", el);
    tabs.innerHTML = "";
    pages.forEach((p, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "tab";
      b.style.setProperty("--hue", p.type.hue);
      b.style.setProperty("--t", Retro.textColorFor(p.type.hex));
      b.textContent = p.type.code;
      b.title = `${p.type.name} ${p.type.ja}` + (p.of > 1 ? ` · ${p.n}/${p.of}` : "");
      b.addEventListener("click", () => showPage(i));
      tabs.append(b);
    });
  }

  function showPage(i) {
    if (!pages.length) return;
    page = (i + pages.length) % pages.length;
    const p = pages[page];
    $(".tabs", el).querySelectorAll(".tab").forEach((t, k) => t.classList.toggle("on", k === page));
    const box = $(".cards", el);
    box.innerHTML = "";
    p.cards.forEach(c => box.append(cardEl(c)));
    for (let k = p.cards.length; k < PER_PAGE; k++) { const s = document.createElement("div"); s.className = "slot"; box.append(s); }
    $(".pageno", el).innerHTML = `${page + 1} / ${pages.length}<span class="ja">${esc(p.type.ja)}</span>`;
    if (sel && !p.cards.includes(sel)) select(null);
  }

  function cardEl(c) {
    const t = typeOf(c);
    const b = document.createElement("button");
    b.type = "button"; b.className = "card" + (c === sel ? " on" : "");
    b.style.setProperty("--hue", t.hue);
    b.dataset.slug = c.slug;
    b.innerHTML = `
      <div class="hd"><span class="no">${cardNo(c)}</span><span class="nm">${esc(c.first || c.name)}</span><span class="rk">${esc(rankBox(c))}</span></div>
      <div class="art">${c.name_ja ? `<span class="ja">${esc(c.name_ja.split("＝")[0])}</span>` : ""}</div>
      <div class="tx"><div>${esc(firstSentence(c.description))}</div></div>`;
    $(".art", b).prepend(Retro.sprite(c.glyph || "❔", 16));
    b.addEventListener("click", () => select(c));
    return b;
  }
  const firstSentence = s => (s.match(/^[^.!?]*[.!?]/) || [s])[0].trim();

  function idle() {
    $(".screen", el).innerHTML = `<div class="idle"><div class="emblem"></div><div class="ja">カードを選択</div></div>`;
  }

  function select(c) {
    sel = c;
    $(".cards", el).querySelectorAll(".card").forEach(b => b.classList.toggle("on", b.dataset.slug === (c && c.slug)));
    const scr = $(".screen", el);
    typer?.skip?.();
    if (!c) { idle(); return; }
    const t = typeOf(c);
    const types = c.nen_types.length ? c.nen_types.map(n => (TYPES.find(x => x.slug === n) || {}).name || n).join(" / ") : "—";
    const weapons = c.weapons.length ? c.weapons.map(title).join(", ") : "—";
    scr.innerHTML = `
      <div class="top">No.${esc(cardNo(c))}「${esc(c.name_ja || c.name)}」</div>
      <div class="name">${esc(c.name)}</div>
      <div class="line">Nen: <b style="color:${t.hex}">${esc(types)}</b>${c.affiliation ? ` · <b>${esc(c.affiliation)}</b>` : ""}</div>
      <div class="line">Arms: <b>${esc(weapons)}</b></div>
      <div class="desc"></div>
      <div class="status">所持者 0名 ／ 残り ${LIMIT[c.rank] || 4}枚</div>`;
    // keep the typing cursor in view on the small screen
    const follow = setInterval(() => { scr.scrollTop = scr.scrollHeight; }, 80);
    typer = Retro.type($(".desc", scr), [c.description], { speed: 6, onDone: () => clearInterval(follow) });
    scr.scrollTop = 0;
  }

  function step(d) {
    const cards = pages[page]?.cards || [];
    if (!cards.length) return;
    const i = sel ? cards.indexOf(sel) : -1;
    const n = i + d;
    if (n < 0) { showPage(page - 1); return select(pages[page].cards[pages[page].cards.length - 1]); }
    if (n >= cards.length) { showPage(page + 1); return select(pages[page].cards[0]); }
    select(cards[n]);
  }

  function claimSel() {
    if (!sel) { Retro.toast("Pick a card first."); return; }
    onClaim?.(sel);
  }

  return { mount, layout, open: openBook, shut, select, get selected() { return sel; } };
})();
