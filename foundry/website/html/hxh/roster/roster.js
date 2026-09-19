/* Roster DB — the curation page for hxh characters. Lists characters,
   edits one character's profile in place, and manages its pictures:
   raws (found by the hxh-character skill or dropped here), crops made
   in crop.html, and the pixel-art / upscaled / transparent versions the
   skill derives from them. API: hobby-server internal/hxh/rosterdb.go. */
(() => {
  const API = "/hxh/api/db";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : "";

  const NEN = ["enhancement", "transmutation", "conjuration", "emission", "manipulation", "specialization"];
  const ARCS = [["hunter-exam", "Hunter Exam"], ["zoldyck-family", "Zoldyck Family"], ["heavens-arena", "Heavens Arena"],
    ["yorknew-city", "Yorknew City"], ["greed-island", "Greed Island"], ["chimera-ant", "Chimera Ant"], ["chairman-election", "Chairman Election"]];
  const RANKS = ["S", "A", "B", "C"];
  const STATUS = ["pending", "approved", "rejected"];
  const TYPES = [["raw", "Raw"], ["cropped", "Cropped"], ["pixelated", "Pixel art"], ["upscaled", "Upscaled"], ["transparent", "Transparent"]];

  async function api(path, opts = {}) {
    const r = await fetch(API + path, { credentials: "same-origin", ...opts });
    if (r.status === 204) return null;
    const ct = r.headers.get("content-type") || "";
    const body = ct.includes("json") ? await r.json() : await r.text();
    if (!r.ok) throw Object.assign(new Error((body && body.error) || body || r.statusText), { status: r.status });
    return body;
  }
  const json = (method, body) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  const state = { me: null, chars: [], cur: null, sel: null, filter: "pending", showRejected: false };
  try { state.filter = localStorage.getItem("roster.filter") || "pending"; } catch {}

  const status = $("#status");
  const say = (msg, cls = "") => { status.textContent = msg; status.className = "msg " + cls; };
  let flashT;
  function flash(msg, err) {
    $$(".flash").forEach(f => f.remove());
    const f = document.createElement("div");
    f.className = "flash" + (err ? " err" : "");
    f.textContent = msg;
    document.body.appendChild(f);
    clearTimeout(flashT);
    flashT = setTimeout(() => f.remove(), err ? 4000 : 1400);
  }

  const ago = iso => {
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + " min";
    if (s < 86400) return Math.floor(s / 3600) + " h";
    return Math.floor(s / 86400) + " d";
  };
  const slugify = s => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const words = s => (s.trim().match(/\S+/g) || []).length;

  // ---- auth ----
  const isAdmin = me => (me.roles || []).some(r => r.website === "hxh" && r.role === "admin");
  async function whoami() {
    const r = await fetch("/admin/api/me", { credentials: "same-origin" });
    if (r.status === 401) return null;
    if (!r.ok) throw new Error("me " + r.status);
    return r.json();
  }
  function show(id) {
    for (const s of ["login", "list", "profile"]) $("#" + s).classList.toggle("hidden", s !== id);
  }
  $("#login-form").addEventListener("submit", async e => {
    e.preventDefault();
    $("#login-msg").textContent = "";
    const r = await fetch("/admin/api/login", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: $("#lu").value.trim(), password: $("#lp").value }) });
    if (!r.ok) { $("#login-msg").textContent = "Wrong username or password."; return; }
    await boot();
  });
  $("#logout").addEventListener("click", async e => {
    e.preventDefault();
    await fetch("/admin/api/logout", { method: "POST", credentials: "same-origin" });
    location.reload();
  });

  // ---- routing ----
  const route = () => {
    const m = location.hash.match(/^#\/c\/(\d+)/);
    return m ? { char: +m[1] } : { list: true };
  };
  window.addEventListener("hashchange", () => render());
  new BroadcastChannel("hxh-roster").onmessage = e => {
    if (state.cur && e.data && e.data.char_id === state.cur.id) loadChar(state.cur.id, true);
  };

  async function boot() {
    say("");
    try {
      state.me = await whoami();
    } catch (err) { say("Cannot reach the server.", "err"); return; }
    if (!state.me) { $("#me").textContent = ""; show("login"); return; }
    $("#me").textContent = state.me.display_name || state.me.username;
    if (!isAdmin(state.me)) { say("Roster DB is for hxh admins.", "err"); show("login"); $("#login").classList.add("hidden"); return; }
    await render();
  }

  async function render() {
    const r = route();
    select(null);
    if (r.list) {
      $("#crumb").textContent = "";
      await loadList();
      show("list");
    } else {
      show("profile");
      await loadChar(r.char);
    }
  }

  // ---- list ----
  async function loadList() {
    try { state.chars = await api("/chars"); } catch (err) { say(err.message, "err"); return; }
    say("");
    renderTabs();
    renderRows();
  }
  function renderTabs() {
    const counts = { all: state.chars.length };
    for (const s of STATUS) counts[s] = state.chars.filter(c => c.status === s).length;
    $("#tabs").innerHTML = [...STATUS, "all"].map(s =>
      `<button type="button" data-filter="${s}" class="${state.filter === s ? "on" : ""}">${cap(s)}<span class="n">${counts[s]}</span></button>`).join("");
  }
  $("#tabs").addEventListener("click", e => {
    const b = e.target.closest("[data-filter]");
    if (!b) return;
    state.filter = b.dataset.filter;
    try { localStorage.setItem("roster.filter", state.filter); } catch {}
    renderTabs(); renderRows();
  });
  function renderRows() {
    const rows = state.chars.filter(c => state.filter === "all" || c.status === state.filter);
    $("#rows").innerHTML = rows.map(c => `<tr data-id="${c.id}">
      <td class="dim">${c.id}</td>
      <td>${c.avatar_image_id ? `<img class="av" alt="" src="${API}/images/${c.avatar_image_id}/thumb">` : `<span class="av none"></span>`}</td>
      <td class="user">${esc(c.name)}</td>
      <td>${esc(c.name_ja)}</td>
      <td>${esc(c.rank)}</td>
      <td>${c.nen_types.map(cap).join(", ")}</td>
      <td>${esc(c.affiliation)}</td>
      <td class="dim">${c.image_count}</td>
      <td><span class="st ${c.status}">${c.status}</span></td>
      <td class="dim nowrap">${ago(c.updated_at)}</td></tr>`).join("") ||
      `<tr><td colspan="10" class="dim">None.</td></tr>`;
  }
  $("#rows").addEventListener("click", e => {
    const tr = e.target.closest("tr[data-id]");
    if (tr) location.hash = "#/c/" + tr.dataset.id;
  });
  $("#new-form").addEventListener("submit", async e => {
    e.preventDefault();
    const slug = $("#new-slug").value.trim(), name = $("#new-name").value.trim();
    try {
      const c = await api("/chars", json("POST", { slug, name }));
      $("#new-slug").value = ""; $("#new-name").value = "";
      location.hash = "#/c/" + c.id;
    } catch (err) { flash(err.message, true); }
  });
  $("#new-name").addEventListener("input", () => {
    if (!$("#new-slug").dataset.touched) $("#new-slug").value = slugify($("#new-name").value.split(/\s+/)[0] || "");
  });
  $("#new-slug").addEventListener("input", () => { $("#new-slug").dataset.touched = "1"; });

  // ---- profile ----
  async function loadChar(id, quiet) {
    try { state.cur = await api("/chars/" + id); } catch (err) { say(err.status === 404 ? "No such character." : err.message, "err"); return; }
    say("");
    $("#crumb").textContent = state.cur.name;
    document.title = state.cur.name + " · Roster DB";
    renderHead();
    if (!quiet) renderFields();
    renderGallery();
  }

  async function patch(fields) {
    const c = await api("/chars/" + state.cur.id, json("PATCH", fields));
    state.cur = c;
    renderHead();
    return c;
  }
  async function save(fields, after) {
    try { await patch(fields); flash("Saved"); if (after) after(); }
    catch (err) { flash(err.message, true); }
  }

  function renderHead() {
    const c = state.cur;
    $("#p-id").textContent = "#" + c.id;
    $("#p-name").textContent = c.name;
    $("#crumb").textContent = c.name;
    const sub = [c.name_ja, c.rank, c.nen_types.map(cap).join(" / "), c.affiliation].filter(Boolean);
    $("#p-sub").textContent = sub.join(" · ");
    $("#p-status").innerHTML = STATUS.map(s => `<button type="button" data-status="${s}" class="${c.status === s ? "on " + s : ""}">${cap(s)}</button>`).join("");
    for (const slot of $$(".slot")) {
      const id = c[slot.dataset.slot];
      slot.classList.toggle("set", !!id);
      slot.innerHTML = id ? `<img alt="" src="${API}/images/${id}/thumb"><button class="clear" type="button" title="Clear">×</button>` : "";
    }
  }
  $("#p-status").addEventListener("click", e => {
    const b = e.target.closest("[data-status]");
    if (b && b.dataset.status !== state.cur.status) save({ status: b.dataset.status });
  });
  $(".slots").addEventListener("click", e => {
    const clear = e.target.closest(".clear");
    if (!clear) return;
    const slot = clear.closest(".slot");
    save({ [slot.dataset.slot]: null });
  });
  $("#p-menu").addEventListener("click", e => {
    e.stopPropagation();
    closePops();
    const pop = document.createElement("div");
    pop.className = "pop";
    pop.innerHTML = `<div class="menu"><button type="button" class="danger" data-do="delete-char">Delete character</button></div>`;
    document.body.appendChild(pop);
    const r = e.currentTarget.getBoundingClientRect();
    pop.style.left = Math.min(r.left, window.innerWidth - pop.offsetWidth - 8) + "px";
    pop.style.top = r.bottom + window.scrollY + 4 + "px";
    pop.querySelector("[data-do=delete-char]").addEventListener("click", async () => {
      closePops();
      if (!confirm(`Delete ${state.cur.name} and all its pictures?`)) return;
      try { await api("/chars/" + state.cur.id, { method: "DELETE" }); location.hash = "#/"; }
      catch (err) { flash(err.message, true); }
    });
  });
  const closePops = () => $$(".pop").forEach(p => p.remove());
  document.addEventListener("click", closePops);

  function renderFields() {
    const c = state.cur;
    const nenSel = i => `<select data-nen="${i}"><option value="">—</option>${NEN.map(n => `<option value="${n}" ${c.nen_types[i] === n ? "selected" : ""}>${cap(n)}</option>`).join("")}</select>`;
    $("#fields").innerHTML = `
      <label>Slug</label><input data-f="slug" value="${esc(c.slug)}">
      <label>Name</label><input data-f="name" value="${esc(c.name)}">
      <label>Japanese</label><input data-f="name_ja" value="${esc(c.name_ja)}" lang="ja">
      <label>Short</label><input data-f="first" value="${esc(c.first)}" maxlength="20">
      <label>Rank</label><div class="row"><select data-f="rank">${RANKS.map(r => `<option ${c.rank === r ? "selected" : ""}>${r}</option>`).join("")}</select></div>
      <label>Nen</label><div class="row">${nenSel(0)}${nenSel(1)}</div>
      <label>Affiliation</label><input data-f="affiliation" value="${esc(c.affiliation)}" maxlength="60">
      <label>Arcs</label><div class="chips">${ARCS.map(([s, n]) => `<label class="chip ${c.arcs.includes(s) ? "on" : ""}"><input type="checkbox" data-arc="${s}" ${c.arcs.includes(s) ? "checked" : ""}>${n}</label>`).join("")}</div>
      <label>Arms</label><input data-f="arms" value="${esc(c.arms.join(", "))}">
      <label>Description</label><div><textarea data-f="description">${esc(c.description)}</textarea><div class="count" data-count></div></div>
      <label>Notes</label><textarea data-f="notes">${esc(c.notes)}</textarea>`;
    updateCount();
    $$("#fields textarea").forEach(grow);
  }
  const grow = t => { t.style.height = "auto"; t.style.height = t.scrollHeight + 2 + "px"; };
  function updateCount() {
    const n = words($("#fields [data-f=description]").value);
    const el = $("#fields [data-count]");
    el.textContent = n + " words";
    el.classList.toggle("bad", n > 0 && (n < 45 || n > 75));
  }
  $("#fields").addEventListener("input", e => {
    if (e.target.tagName === "TEXTAREA") grow(e.target);
    if (e.target.dataset.f === "description") updateCount();
  });
  $("#fields").addEventListener("change", e => {
    const t = e.target;
    if (t.dataset.f) {
      let v = t.value;
      if (t.dataset.f === "arms") v = v.split(",").map(slugify).filter(Boolean);
      if (t.dataset.f === "slug") v = v.trim();
      if (t.dataset.f === "name") v = v.trim();
      return save({ [t.dataset.f]: v }, () => { if (t.dataset.f === "arms") t.value = state.cur.arms.join(", "); });
    }
    if (t.dataset.nen !== undefined) {
      const vals = $$("#fields [data-nen]").map(s => s.value).filter(Boolean);
      return save({ nen_types: [...new Set(vals)] });
    }
    if (t.dataset.arc) {
      t.closest(".chip").classList.toggle("on", t.checked);
      const arcs = ARCS.map(([s]) => s).filter(s => $(`#fields [data-arc="${s}"]`).checked);
      return save({ arcs });
    }
  });

  // ---- gallery ----
  function renderGallery() {
    const c = state.cur;
    const byType = {};
    for (const im of c.images) (byType[im.type] ||= []).push(im);
    $("#gallery").innerHTML = TYPES.map(([t, label]) => {
      const all = byType[t] || [];
      const rejected = all.filter(i => i.status === "rejected").length;
      const shown = all.filter(i => state.showRejected || i.status !== "rejected");
      const tools = t === "raw" ? `<span class="tools">${rejected ? `<button type="button" data-do="toggle-rejected" class="${state.showRejected ? "on" : ""}">Rejected ${rejected}</button>` : ""}<button type="button" data-do="upload">Upload</button></span>` : "";
      return `<h2>${label}<span class="n">${all.length - rejected}</span>${tools}</h2>
        <div class="tiles" data-type="${t}">${shown.map(tile).join("") || `<div class="empty">${t === "raw" ? "Drop pictures here." : "None yet."}</div>`}</div>`;
    }).join("");
    if (state.sel && !c.images.some(i => i.id === state.sel)) select(null);
    else if (state.sel) markSel();
  }
  function tile(im) {
    const c = state.cur;
    const roles = [c.avatar_image_id === im.id && "avatar", c.card_image_id === im.id && "card"].filter(Boolean).join(" · ");
    const from = im.source_image_id ? `from #${im.source_image_id}` : "";
    const line2 = [from, im.caption].filter(Boolean).join(" · ");
    return `<figure class="tile ${im.status} ${["pixelated", "transparent"].includes(im.type) ? "pixel" : ""}" data-id="${im.id}" title="${esc(im.caption)}">
      <div class="pic"><img alt="" src="${API}/images/${im.id}/thumb" loading="lazy"></div>
      <figcaption><div class="l1"><b>#${im.id}</b><span>${im.width}×${im.height}</span><span class="badge2">${roles}</span></div><div class="l2">${esc(line2)}</div></figcaption>
    </figure>`;
  }
  function markSel() {
    $$(".tile").forEach(t => t.classList.toggle("sel", +t.dataset.id === state.sel));
  }
  function select(id) {
    state.sel = id;
    markSel();
    const bar = $("#selbar");
    if (!id) { bar.classList.add("hidden"); return; }
    const im = state.cur.images.find(i => i.id === id);
    if (!im) { bar.classList.add("hidden"); return; }
    $("#sel-info").innerHTML = `<b>#${im.id}</b> · ${im.type} · ${im.width}×${im.height} · ${(im.bytes / 1024).toFixed(0)} KB${im.caption ? " · " + esc(im.caption) : ""}`;
    bar.querySelector("[data-do=reject]").hidden = im.type !== "raw";
    bar.querySelector("[data-do=reject]").textContent = im.status === "rejected" ? "Restore" : "Reject";
    bar.querySelector("[data-do=avatar]").classList.toggle("on", state.cur.avatar_image_id === id);
    bar.querySelector("[data-do=card]").classList.toggle("on", state.cur.card_image_id === id);
    bar.classList.remove("hidden");
  }
  $("#gallery").addEventListener("click", e => {
    const b = e.target.closest("[data-do]");
    if (b) {
      if (b.dataset.do === "upload") $("#file").click();
      if (b.dataset.do === "toggle-rejected") { state.showRejected = !state.showRejected; renderGallery(); }
      return;
    }
    const t = e.target.closest(".tile");
    if (t) select(+t.dataset.id === state.sel ? null : +t.dataset.id);
  });
  $("#gallery").addEventListener("dblclick", e => {
    const t = e.target.closest(".tile");
    if (t) window.open("crop.html?image=" + t.dataset.id, "_blank");
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") select(null);
  });
  $("#selbar").addEventListener("click", async e => {
    const b = e.target.closest("[data-do]");
    if (!b || !state.sel) return;
    const id = state.sel;
    const im = state.cur.images.find(i => i.id === id);
    try {
      switch (b.dataset.do) {
        case "avatar": await patch({ avatar_image_id: state.cur.avatar_image_id === id ? null : id }); renderGallery(); select(id); flash("Saved"); break;
        case "card": await patch({ card_image_id: state.cur.card_image_id === id ? null : id }); renderGallery(); select(id); flash("Saved"); break;
        case "crop": window.open("crop.html?image=" + id, "_blank"); break;
        case "open": window.open(API + "/images/" + id, "_blank"); break;
        case "reject": await api("/images/" + id, json("PATCH", { status: im.status === "rejected" ? "kept" : "rejected" })); await loadChar(state.cur.id, true); break;
        case "delete":
          if (!confirm(`Delete #${id}?`)) return;
          await api("/images/" + id, { method: "DELETE" });
          select(null);
          await loadChar(state.cur.id, true);
          break;
      }
    } catch (err) { flash(err.message, true); }
  });

  // ---- upload (button or drop on the raw tiles) ----
  async function upload(files) {
    const list = [...files].filter(f => /^image\//.test(f.type));
    if (!list.length) return;
    let n = 0, dup = 0;
    for (const f of list) {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("type", "raw");
      fd.append("caption", f.name.replace(/\.[a-z0-9]+$/i, ""));
      try {
        const r = await api("/chars/" + state.cur.id + "/images", { method: "POST", body: fd });
        r.created ? n++ : dup++;
      } catch (err) { flash(f.name + ": " + err.message, true); }
    }
    if (n || dup) flash(`${n} added${dup ? `, ${dup} already there` : ""}`);
    await loadChar(state.cur.id, true);
  }
  $("#file").addEventListener("change", e => { upload(e.target.files); e.target.value = ""; });
  $("#gallery").addEventListener("dragover", e => {
    const z = e.target.closest(".tiles[data-type=raw]");
    if (!z) return;
    e.preventDefault(); z.classList.add("drop");
  });
  $("#gallery").addEventListener("dragleave", e => { e.target.closest(".tiles")?.classList.remove("drop"); });
  $("#gallery").addEventListener("drop", e => {
    const z = e.target.closest(".tiles[data-type=raw]");
    if (!z) return;
    e.preventDefault(); z.classList.remove("drop");
    upload(e.dataTransfer.files);
  });

  boot();
})();
