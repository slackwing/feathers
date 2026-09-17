/* The Binder app: a chromeless window holding the Greed Island style card
   binder. Mount it before Retro.os() so the shell registers the window;
   it reads the full roster from roster.json (the master copy). */
const Binder = (() => {
  const TYPES = [
    { slug: "enhancement",    code: "EN", name: "Enhancer",    hue: "var(--enhancer)" },
    { slug: "transmutation",  code: "TR", name: "Transmuter",  hue: "var(--transmuter)" },
    { slug: "conjuration",    code: "CO", name: "Conjurer",    hue: "var(--conjurer)" },
    { slug: "emission",       code: "EM", name: "Emitter",     hue: "var(--emitter)" },
    { slug: "manipulation",   code: "MA", name: "Manipulator", hue: "var(--manipulator)" },
    { slug: "specialization", code: "SP", name: "Specialist",  hue: "var(--specialist)" },
    { slug: "",               code: "--", name: "Non-user",    hue: "var(--none)" },
  ];
  const HEX = { enhancement: "#ff5a36", transmutation: "#37d0ff", conjuration: "#c09bff", emission: "#ffd166", manipulation: "#ff7ad9", specialization: "#58e05c", "": "#9a9a9a" };
  const PER_PAGE = 8;
  const esc = s => Retro.esc(s);
  const $ = (sel, r = document) => r.querySelector(sel);

  let el, book, pages = [], page = 0, sel = null, roster = [], typer = null, onClaim = null;

  const typeOf = c => TYPES.find(t => t.slug === (c.nen_types[0] || "")) || TYPES[TYPES.length - 1];
  const title = s => s.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");

  // One tab per page; a Nen type never shares a page with another.
  function paginate(chars) {
    const out = [];
    for (const t of TYPES) {
      const mine = chars.filter(c => typeOf(c) === t);
      for (let i = 0; i < mine.length; i += PER_PAGE) {
        out.push({ type: t, cards: mine.slice(i, i + PER_PAGE), n: Math.floor(i / PER_PAGE) + 1, of: Math.ceil(mine.length / PER_PAGE) });
      }
    }
    return out;
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
          <div class="emblem"></div>
          <div class="title">HUNTER<span class="x">×</span><br>HALLOWEEN</div>
          <div class="sub">BINDER</div>
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
            <div class="screen"><div class="idle"><div class="emblem"></div></div></div>
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

    fetch("roster.json", { cache: "no-cache" }).then(r => r.json()).then(list => {
      roster = list.map((c, i) => ({ ...c, no: String(i + 1).padStart(3, "0") }));
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
      b.style.setProperty("--t", Retro.textColorFor(HEX[p.type.slug]));
      b.textContent = p.type.code;
      b.title = p.of > 1 ? `${p.type.name} · page ${p.n} of ${p.of}` : p.type.name;
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
    $(".pageno", el).textContent = `${page + 1} / ${pages.length}`;
    if (sel && !p.cards.includes(sel)) select(null);
  }

  function cardEl(c) {
    const t = typeOf(c);
    const b = document.createElement("button");
    b.type = "button"; b.className = "card" + (c === sel ? " on" : "");
    b.style.setProperty("--hue", t.hue);
    b.innerHTML = `
      <div class="hd"><span class="no">${c.no}</span><span class="nm">${esc(c.first || c.name)}</span><span class="ty">${t.code}</span></div>
      <div class="art"></div>
      <div class="tx">${esc(firstSentence(c.description))}</div>`;
    $(".art", b).append(Retro.sprite(c.glyph || "❔", 16));
    b.addEventListener("click", () => select(c));
    return b;
  }
  const firstSentence = s => (s.match(/^[^.!?]*[.!?]/) || [s])[0].trim();

  function select(c) {
    sel = c;
    $(".cards", el).querySelectorAll(".card").forEach(b => b.classList.toggle("on", b.querySelector(".no").textContent === (c && c.no)));
    const scr = $(".screen", el);
    typer?.skip?.();
    if (!c) { scr.innerHTML = `<div class="idle"><div class="emblem"></div></div>`; return; }
    const t = typeOf(c);
    const types = c.nen_types.length ? c.nen_types.map(n => (TYPES.find(x => x.slug === n) || {}).name || n).join(" / ") : "Non-user";
    const weapons = c.weapons.length ? c.weapons.map(title).join(", ") : "—";
    scr.innerHTML = `
      <div class="name">No.${esc(c.no)} ${esc(c.name)}</div>
      <div class="line">Nen: <b style="color:${HEX[t.slug]}">${esc(types)}</b></div>
      <div class="line">Arms: <b>${esc(weapons)}</b></div>
      <div class="desc"></div>`;
    // keep the typing cursor in view on the small screen
    const follow = setInterval(() => { scr.scrollTop = scr.scrollHeight; }, 80);
    typer = Retro.type($(".desc", scr), [c.description], { speed: 6, onDone: () => clearInterval(follow) });
    scr.scrollTop = 0;
  }

  function step(d) {
    const cards = pages[page]?.cards || [];
    if (!cards.length) return;
    const i = sel ? cards.indexOf(sel) : -1;
    let n = i + d;
    if (n < 0) { showPage(page - 1); return select(pages[page].cards[pages[page].cards.length - 1]); }
    if (n >= cards.length) { showPage(page + 1); return select(pages[page].cards[0]); }
    select(cards[n]);
  }

  function claimSel() {
    if (!sel) { Retro.toast("Pick a card first."); return; }
    onClaim?.(sel);
  }

  return { mount, open: openBook, shut, select, get selected() { return sel; } };
})();
