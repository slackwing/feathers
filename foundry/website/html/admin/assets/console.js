/* The users console — ONE implementation behind /admin/ and every site's
   /<site>/_admin/ (Andrew, 2026-10-01: "the very code behind admin/admin
   === the code behind /<website>/_admin, except scoped to that website").

     Console.mount({ site: null })    /admin/  — every user, every site; role admin/admin
     Console.mount({ site: "hxh" })   /hxh/_admin/ — hxh's people only; role admin on hxh
                                      (or admin/admin)

   Page: the people table; below it, apart, the add-user form (Name →
   username derived from it, never typed → Email; all required); below
   that, in /admin/ only, the bots. The one branch: a SITE console's form
   creates the user, gives them the site's default role and sends the
   invite, step by step; /admin/'s only creates the user (roles and
   invites are the table's there).

   The server enforces the site scope (hobby-server
   internal/shared/siteadmin.go): a site admin changes only people wholly
   within the site; anyone else comes back `editable: false` and is drawn
   read-only. No deletes, no bots, no active site in a site console.

   A page supplies only `<main id="console"></main>`, the admin stylesheet
   and this script — it works unskinned; a site may add its own CSS. */
(function () {
  const AUTH = "/admin/api";
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ICON = {
    mail: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1.5" y="3.5" width="13" height="9" rx="1"/><path d="M2 4l6 5 6-5"/></svg>',
    link: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6.5 9.5l3-3"/><path d="M7.2 4.8l1.3-1.3a2.6 2.6 0 013.7 3.7L10.9 8.5"/><path d="M8.8 11.2l-1.3 1.3a2.6 2.6 0 01-3.7-3.7l1.3-1.3"/></svg>',
  };
  const ROLE_COLORS = { admin: "#1f5fbf", guest: "#1a7f37", player: "#6f42c1", anonymous: "#71716c" };
  const roleColor = r => ROLE_COLORS[r] || "#71716c";
  const READ_ONLY = "this account reaches beyond this site: only a global admin can change it";

  /** "Kimmy T" → "kimmyt": the username a name implies (letters and digits, lowercase, accents dropped). */
  function usernameFor(name) {
    return String(name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 50);
  }
  function textColor(hex) {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return "#fff";
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 170 ? "#1c1c1a" : "#fff";
  }
  function randomColor() {   // random hue, fixed saturation/lightness — mirrors shared.RandomColor
    const h = Math.floor(Math.random() * 360), s = 0.55, l = 0.45;
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return "#" + [r, g, b].map(v => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("");
  }
  const defaultInitial = name => (name.trim().split(/\s+/).slice(0, 2).map(w => w[0] || "").join("").toUpperCase()) || "?";
  const paint = (el, initial, color) => { el.textContent = initial || "?"; el.style.background = color; el.style.color = textColor(color); };
  const avatarHTML = (u, cls = "avatar") => `<span class="${cls}" style="background:${esc(u.color)};color:${textColor(u.color)}">${esc(u.initial)}</span>`;

  function mount({ site = null, title = site ? `${site} admin` : "admin", root = document.getElementById("console") } = {}) {
    const API = site ? `${AUTH}/site/${encodeURIComponent(site)}` : AUTH;
    const $ = sel => root.querySelector(sel);
    let me = null, websites = [], users = [], emailConfigured = false;
    const tplCache = {};

    root.innerHTML = `
      <section data-v="login" class="card narrow hidden">
        <h1>${esc(title)}</h1>
        <form data-f="login">
          <label for="lu">User</label><input id="lu" autocomplete="username" required>
          <label for="lp">Password</label><input id="lp" type="password" autocomplete="current-password" required>
          <button class="primary" type="submit">Log in</button>
          <p class="msg err" data-m="login"></p>
        </form>
      </section>
      <section data-v="forbidden" class="card narrow hidden">
        <h1>${esc(title)}</h1><p class="msg">Not authorized.</p><button type="button" data-a="logout">Log out</button>
      </section>
      <section data-v="console" class="hidden">
        <header class="top"><h1>${esc(title)}</h1>
          <span class="who"><span data-who-avatar></span> <b data-who></b> <button type="button" data-a="logout">Log out</button></span></header>
        <h2>Users <span class="note" data-email-note></span></h2>
        <table class="people">
          <thead><tr><th></th><th>User</th><th>Name</th><th>Email</th>${site ? "" : "<th>Active site</th>"}<th>Roles</th><th>Invite · Reset</th>${site ? "" : "<th></th>"}</tr></thead>
          <tbody data-people></tbody>
        </table>
        <h2>Add user</h2>
        <form class="adduser card" data-f="add" novalidate>
          <div class="fields">
            <span class="avatar" data-new-avatar>?</span>
            <label>Name <span class="hint">first name, capitalized</span><input data-in="name" placeholder="Judy" autocomplete="off" required></label>
            <label>Username<input data-in="username" readonly tabindex="-1" placeholder="judy"></label>
            <label>Email<input data-in="email" type="email" placeholder="judy@example.com" autocomplete="off" required></label>
            <button class="primary" type="submit">${site ? "Add &amp; invite" : "Add"}</button>
          </div>
          <ol class="steps hidden" data-steps></ol>
          <p class="msg" data-m="add"></p>
        </form>
        ${site ? "" : `<section data-bots-users class="hidden"><h2>Bots <span class="note">fake users driven by hobby-server's bot programs; passwords are provisioned by the service</span></h2>
          <table class="people"><thead><tr><th></th><th>User</th><th>Name</th><th>Email</th><th>Active site</th><th>Roles</th><th>Invite · Reset</th><th></th></tr></thead><tbody data-bots-body></tbody></table></section>
        <section data-bots class="hidden"><h2>Bot programs <span class="note">run by hobby-server against the public site</span></h2>
          <table class="bots"><thead><tr><th>Program</th><th>Enabled</th><th>Last tick</th><th>Ticks</th><th>Hooks</th></tr></thead><tbody data-programs></tbody></table></section>`}
      </section>`;
    const show = v => root.querySelectorAll("[data-v]").forEach(s => s.classList.toggle("hidden", s.dataset.v !== v));

    async function call(base, path, opts = {}) {
      if (opts.body) opts.headers = { "Content-Type": "application/json", ...opts.headers };
      const res = await fetch(base + path, opts);
      if (!res.ok) throw Object.assign(new Error((await res.text()).trim() || res.statusText), { status: res.status });
      return res.status === 204 ? null : res.json();
    }
    const api = (path, opts) => call(API, path, opts);
    const auth = (path, opts) => call(AUTH, path, opts);
    const allowed = m => m.roles.some(r => (r.website === "admin" && r.role === "admin") || (site && r.website === site && r.role === "admin"));

    async function templatesFor(s) {
      if (!s) return [];
      if (!(s in tplCache)) {
        try { const r = await fetch(`/${s}/_email/templates.json`, { cache: "no-cache" }); tplCache[s] = r.ok ? ((await r.json()).templates || []) : []; }
        catch { tplCache[s] = []; }
      }
      return tplCache[s];
    }

    // ---- flash + popovers ----
    let flashTimer;
    function flash(text, isErr) {
      document.querySelector(".flash")?.remove();
      const f = document.createElement("div");
      f.className = "flash" + (isErr ? " err" : ""); f.textContent = text;
      document.body.append(f);
      clearTimeout(flashTimer); flashTimer = setTimeout(() => f.remove(), 3500);
    }
    const closePop = () => document.querySelector(".pop")?.remove();
    function popover(anchor, html) {
      closePop();
      const p = document.createElement("div");
      p.className = "pop"; p.innerHTML = html;
      document.body.append(p);
      const r = anchor.getBoundingClientRect();
      p.style.top = (scrollY + r.bottom + 6) + "px";
      p.style.left = Math.min(scrollX + r.left, scrollX + innerWidth - p.offsetWidth - 12) + "px";
      p.addEventListener("click", e => e.stopPropagation());
      return p;
    }
    document.addEventListener("click", closePop);
    document.addEventListener("keydown", e => { if (e.key === "Escape") closePop(); });
    async function act(fn) { try { await fn(); } catch (err) { flash(err.message || "error", true); } }
    const patch = (u, body) => api(`/users/${encodeURIComponent(u.username)}`, { method: "PATCH", body: JSON.stringify(body) });

    // ---- boot ----
    async function boot() {
      try { me = await auth("/me"); } catch { show("login"); return; }
      if (!allowed(me)) { show("forbidden"); return; }
      $("[data-who]").textContent = me.display_name;
      $("[data-who-avatar]").innerHTML = avatarHTML(me, "avatar sm");
      show("console");
      try {
        const st = await api("/email-status");
        emailConfigured = !!st.configured;
        $("[data-email-note]").textContent = emailConfigured ? `email from ${st.from}` : "email not configured (hobby-server config.yaml → email:)";
      } catch { emailConfigured = false; }
      await refresh();
    }
    async function refresh() {
      websites = site ? [await api("/website")] : await api("/websites");
      users = await api("/users");
      renderUsers();
      if (!site) await refreshBots();
    }

    // ---- bot programs (404 when the bot service is off: section hidden) ----
    async function refreshBots() {
      let programs;
      try { programs = await api("/bots"); } catch { $("[data-bots]").classList.add("hidden"); return; }
      $("[data-bots]").classList.remove("hidden");
      const tbody = $("[data-programs]");
      tbody.innerHTML = "";
      for (const p of programs) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="nowrap"><code>${esc(p.name)}</code></td>
          <td><label class="switch"><input type="checkbox"${p.enabled ? " checked" : ""}> <span>${p.enabled ? "on" : "off"}</span></label></td>
          <td class="dim">${p.last_tick && !p.last_tick.startsWith("0001") ? new Date(p.last_tick).toLocaleString() : "—"}</td>
          <td>${p.ticks}</td><td>${p.hooks}</td>`;
        tr.querySelector("input").addEventListener("change", e => act(async () => {
          await api(`/bots/${encodeURIComponent(p.name)}`, { method: "PUT", body: JSON.stringify({ enabled: e.target.checked }) });
          flash(`${p.name} ${e.target.checked ? "enabled" : "disabled"}`);
          await refreshBots();
        }));
        tbody.append(tr);
      }
    }

    // ---- tables: the people, and (in /admin/) the bots apart ----
    function renderUsers() {
      const people = $("[data-people]");
      people.innerHTML = "";
      for (const u of users.filter(u => !u.is_bot)) people.append(row(u));
      if (site) return;
      const bots = users.filter(u => u.is_bot), body = $("[data-bots-body]");
      body.innerHTML = "";
      for (const u of bots) body.append(row(u));
      $("[data-bots-users]").classList.toggle("hidden", !bots.length);
    }

    function row(u) {
      const tr = document.createElement("tr");
      const editable = site ? u.editable !== false : true;
      if (!editable) { tr.classList.add("ro"); tr.title = READ_ONLY; }
      const roleSites = websites.filter(w => w.roles.length);
      const siteOpts = `<option value=""${u.active_site ? "" : " selected"}>—</option>` + websites.map(w =>
        `<option value="${esc(w.website)}"${w.website === u.active_site ? " selected" : ""}>${esc(w.website)}</option>`).join("");
      const roleChooser = site
        ? `<select class="rr placeholder" required><option value="" disabled selected>role</option>${(websites[0]?.roles || []).filter(r => r !== "anonymous").map(r => `<option>${esc(r)}</option>`).join("")}</select>`   // the look-only role is not one to hand people
        : `<select class="rs placeholder" required><option value="" disabled selected>site</option>${roleSites.map(w => `<option value="${esc(w.website)}">${esc(w.website)}</option>`).join("")}</select>
           <select class="rr placeholder" required disabled><option value="" disabled selected>role</option></select>`;
      tr.innerHTML = `
        <td>${editable ? avatarHTML(u).replace('<span class="avatar"', '<button type="button" class="avatar" title="initial and colour"').replace("</span>", "</button>") : avatarHTML(u)}</td>
        <td class="user nowrap"><span class="dot ${u.has_password ? "set" : "unset"}" title="${u.has_password ? "password set" : "no password yet"}"></span>${esc(u.username)}${u.is_bot ? ' <span class="bot" title="bot">bot</span>' : ""}</td>
        <td>${editable ? `<span class="edit" data-field="display_name">${esc(u.display_name)}</span>` : esc(u.display_name)}</td>
        <td>${editable ? `<span class="edit${u.email ? "" : " empty"}" data-field="email">${esc(u.email || "add email")}</span>` : `<span class="dim">${esc(u.email || "—")}</span>`}</td>
        ${site ? "" : `<td><select class="site" title="the site invites, resets and emails act on">${siteOpts}</select></td>`}
        <td>
          <div class="badges">${u.roles.map(r => `<span class="badge" style="--c:${roleColor(r.role)}">${site ? "" : `<span class="l">${esc(r.website)}</span>`}<span class="r">${esc(r.role)}</span>${editable ? `<button type="button" class="x" data-w="${esc(r.website)}" data-r="${esc(r.role)}" title="remove">✕</button>` : ""}</span>`).join("")}</div>
          ${editable ? `<div class="addrole">${roleChooser}<button type="button" class="add" title="add role" disabled>+</button></div>` : ""}
        </td>
        <td>
          <div class="matrix">
            <span class="k">invite</span><button type="button" class="ib" data-kind="invite" data-do="mail" title="invite email">${ICON.mail}</button><button type="button" class="ib" data-kind="invite" data-do="link" title="copy invite link">${ICON.link}</button>
            <span class="k">reset</span><button type="button" class="ib" data-kind="reset" data-do="mail" title="password-reset email">${ICON.mail}</button><button type="button" class="ib" data-kind="reset" data-do="link" title="copy password-reset link">${ICON.link}</button>
          </div>
        </td>
        ${site ? "" : `<td class="nowrap">${u.username === me.username ? "" : `<button type="button" class="ib kebab" title="more">⋯</button>`}</td>`}`;

      // roles: in /admin/ the role list follows the chosen site; a site console offers its own roles
      const rs = tr.querySelector(".rs"), rr = tr.querySelector(".rr"), add = tr.querySelector(".add");
      rs?.addEventListener("change", () => {
        const w = websites.find(x => x.website === rs.value);
        rr.innerHTML = `<option value="" disabled selected>role</option>` + (w ? w.roles : []).map(r => `<option>${esc(r)}</option>`).join("");
        rr.disabled = false; rr.classList.add("placeholder"); rs.classList.remove("placeholder"); add.disabled = true;
      });
      rr?.addEventListener("change", () => { rr.classList.toggle("placeholder", !rr.value); add.disabled = !((site || rs.value) && rr.value); });
      add?.addEventListener("click", () => act(async () => {
        await api("/roles", { method: "POST", body: JSON.stringify(site ? { username: u.username, role: rr.value } : { username: u.username, website: rs.value, role: rr.value }) });
        await refresh();
      }));
      tr.querySelectorAll(".badge .x").forEach(x => x.addEventListener("click", () => act(async () => {
        await api("/roles", { method: "DELETE", body: JSON.stringify(site ? { username: u.username, role: x.dataset.r } : { username: u.username, website: x.dataset.w, role: x.dataset.r }) });
        await refresh();
      })));

      // the invite / reset matrix acts on the user's active site — a site console's own site, always
      const target = () => site || u.active_site;
      const syncInvite = () => {
        const s = target(), roleOk = !!s && u.roles.some(r => r.website === s);
        tr.querySelectorAll(".ib[data-kind]").forEach(b => {
          const ok = editable && (b.dataset.kind === "reset" ? !!s : roleOk);
          b.classList.toggle("off", !ok); b.setAttribute("aria-disabled", String(!ok));   // not `disabled`: Firefox hides a disabled button's tooltip
          b.title = !editable ? READ_ONLY : ok ? `${b.dataset.kind === "invite" ? "invite" : "password-reset"} ${b.dataset.do === "mail" ? "email" : "link"}` : !s ? "no active site" : `no role on ${s}`;
        });
      };
      syncInvite();
      tr.querySelector(".site")?.addEventListener("change", e => act(async () => {
        await patch(u, { active_site: e.target.value });
        u.active_site = e.target.value; syncInvite();
      }));
      tr.querySelectorAll(".edit").forEach(span => span.addEventListener("click", () => editInline(span, u)));
      tr.querySelector("button.avatar")?.addEventListener("click", e => { e.stopPropagation(); avatarPop(e.currentTarget, u); });
      // only the matrix's own buttons (they carry a kind) — the ⋯ is an .ib too
      tr.querySelectorAll(".ib[data-kind]").forEach(b => b.addEventListener("click", e => { e.stopPropagation(); if (b.classList.contains("off")) return; matrix(b, u, b.dataset.kind, b.dataset.do); }));

      tr.querySelector(".kebab")?.addEventListener("click", e => {
        e.stopPropagation();
        const p = popover(e.currentTarget, `<div class="menu">${u.username === "anonymous" ? "" : `<button type="button" data-k="bot">${u.is_bot ? "Mark as person" : "Mark as bot"}</button>`}<button type="button" class="danger" data-k="del">Delete user…</button></div>`);
        p.querySelector('[data-k="bot"]')?.addEventListener("click", () => { closePop(); act(async () => { await patch(u, { is_bot: !u.is_bot }); await refresh(); flash(`${u.username}: ${u.is_bot ? "a person" : "a bot"}`); }); });
        p.querySelector('[data-k="del"]').addEventListener("click", () => {
          closePop();
          if (!confirm(`Delete ${u.username}? Roles, sessions and pending links go with it. This cannot be undone.`)) return;
          act(async () => { await api(`/users/${encodeURIComponent(u.username)}`, { method: "DELETE" }); await refresh(); flash(`deleted ${u.username}`); });
        });
      });
      return tr;
    }

    function editInline(span, u) {
      if (span.querySelector("input")) return;
      const field = span.dataset.field, old = u[field] || "";
      const input = document.createElement("input");
      input.className = "inline"; input.value = old; input.type = field === "email" ? "email" : "text";
      const cell = span.closest("td"), cs = getComputedStyle(cell);   // fit the cell so the table doesn't reflow
      input.style.width = (cell.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 2) + "px";
      span.replaceChildren(input); span.classList.remove("empty");
      input.focus(); input.select();
      let done = false;
      const finish = async save => {
        if (done) return; done = true;
        const v = input.value.trim();
        if (save && v !== old) {
          try { await patch(u, { [field]: v }); u[field] = v; }
          catch (err) { flash(err.message || "error", true); span.textContent = old || (field === "email" ? "add email" : ""); span.classList.toggle("empty", !old); return; }
        }
        const cur = u[field] || "";
        span.textContent = cur || (field === "email" ? "add email" : "");
        span.classList.toggle("empty", !cur);
        if (field === "display_name" && u.username === me.username) $("[data-who]").textContent = cur;
      };
      input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); finish(true); } if (e.key === "Escape") finish(false); });
      input.addEventListener("blur", () => finish(true));
    }

    function avatarPop(btn, u) {
      const p = popover(btn, `
        <div class="row"><span class="avatar" data-p="prev"></span>
          <input class="initial" data-p="i" maxlength="2" value="${esc(u.initial)}" title="1–2 characters">
          <input type="color" data-p="c" value="${esc(u.color)}"></div>
        <div class="row"><button type="button" class="primary" data-p="save">Save</button><button type="button" data-p="cancel">Cancel</button></div>`);
      const q = k => p.querySelector(`[data-p="${k}"]`), prev = q("prev"), i = q("i"), c = q("c");
      const repaint = () => paint(prev, i.value.trim().toUpperCase() || "?", c.value);
      repaint(); i.addEventListener("input", repaint); c.addEventListener("input", repaint);
      q("cancel").addEventListener("click", closePop);
      q("save").addEventListener("click", () => act(async () => {
        const initial = i.value.trim().toUpperCase();
        await patch(u, { initial, color: c.value });
        u.initial = initial; u.color = c.value;
        paint(btn, initial, c.value);
        if (u.username === me.username) $("[data-who-avatar]").innerHTML = avatarHTML(u, "avatar sm");
        closePop();
      }));
      i.focus(); i.select();
    }

    // The invite / reset matrix: mail asks (send / preview / cancel), link copies.
    async function matrix(btn, u, kind, what) {
      const s = site || u.active_site;
      if (!s) { flash("pick an active site first", true); return; }
      const where = site ? {} : { website: s };
      if (what === "link") {
        try {
          const { url, expires_at } = await api("/links", { method: "POST", body: JSON.stringify({ username: u.username, type: kind, ...where }) });
          await navigator.clipboard.writeText(url);
          flash(`${kind} link copied · expires ${new Date(expires_at).toLocaleString()}`);
        } catch (err) { flash(err.message || "error", true); }
        return;
      }
      const t = (await templatesFor(s)).find(x => kind === "invite" ? x.invite : x.reset);
      const why = !t ? `${s} has no ${kind} email template` : !u.email ? "no email on this account" : !emailConfigured ? "email is not configured on the server" : "";
      const p = popover(btn, `
        <p>${kind === "invite" ? "Invite" : "Password reset"} email to <b>${esc(u.email || "—")}</b>${why ? `<br><span class="dim">${esc(why)}</span>` : ""}</p>
        <div class="row">
          <button type="button" class="primary" data-p="send"${why ? " disabled" : ""}>Send</button>
          <button type="button" data-p="preview"${t ? "" : " disabled"}>Preview</button>
          <button type="button" data-p="cancel">Cancel</button>
        </div>`);
      p.querySelector('[data-p="cancel"]').addEventListener("click", closePop);
      p.querySelector('[data-p="preview"]').addEventListener("click", () => { open(`/${s}/_email/?template=${encodeURIComponent(t.id)}&user=${encodeURIComponent(u.username)}`, "_blank"); closePop(); });
      p.querySelector('[data-p="send"]').addEventListener("click", () => act(async () => {
        const r = await api("/email", { method: "POST", body: JSON.stringify({ username: u.username, template: t.id, ...where }) });
        closePop(); flash(`sent "${r.subject}" to ${r.to}`);
      }));
    }

    // ---- add user: Name → username (derived, never typed) → Email ----
    const form = $('[data-f="add"]'), nameIn = $('[data-in="name"]'), userIn = $('[data-in="username"]'), mailIn = $('[data-in="email"]');
    const newAvatar = $("[data-new-avatar]"), steps = $("[data-steps]"), addMsg = $('[data-m="add"]');
    let newColor = randomColor();
    const syncNew = () => { userIn.value = usernameFor(nameIn.value); paint(newAvatar, defaultInitial(nameIn.value), newColor); };
    nameIn.addEventListener("input", syncNew);
    syncNew();
    function step(text) {
      const li = document.createElement("li");
      li.className = "doing"; li.textContent = text;
      steps.append(li);
      return { ok() { li.className = "done"; }, fail() { li.className = "failed"; } };
    }
    form.addEventListener("submit", async e => {
      e.preventDefault();
      addMsg.textContent = ""; addMsg.className = "msg";
      const name = nameIn.value.trim(), username = usernameFor(name), email = mailIn.value.trim();
      if (!name || !username || !email || !mailIn.checkValidity()) { addMsg.className = "msg err"; addMsg.textContent = !name || !username ? "A name is required." : "A valid email is required."; return; }
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true; form.classList.add("busy");
      steps.innerHTML = ""; steps.classList.remove("hidden");
      let s;
      try {
        s = step(`Creating ${username}…`);
        await api("/users", { method: "POST", body: JSON.stringify({ username, display_name: name, email, initial: defaultInitial(name), color: newColor }) });
        s.ok();
        if (!site) {   // /admin/ only creates the user; roles and invites are the table's
          addMsg.className = "msg ok"; addMsg.textContent = `Created ${username}.`;
        } else {
          const def = websites[0]?.default;
          if (!def) throw new Error(`${site} has no default role — add one in /admin/`);
          s = step(`Adding ${site} ${def}…`);
          await api("/roles", { method: "POST", body: JSON.stringify({ username, role: def }) });
          s.ok();
          s = step(`Sending the invite to ${email}…`);   // started before its checks, so a refusal marks THIS step
          const t = (await templatesFor(site)).find(x => x.invite);
          if (!t) throw new Error(`${site} has no invite email template`);
          if (!emailConfigured) throw new Error("email is not configured on the server — copy the invite link from the table");
          const r = await api("/email", { method: "POST", body: JSON.stringify({ username, template: t.id }) });
          s.ok();
          addMsg.className = "msg ok"; addMsg.textContent = `An invite has been sent to ${r.to}.`;
        }
        nameIn.value = ""; mailIn.value = ""; newColor = randomColor(); syncNew();
      } catch (err) {
        s?.fail();
        addMsg.className = "msg err"; addMsg.textContent = err.message || "error";
      } finally {
        button.disabled = false; form.classList.remove("busy");
        await refresh().catch(() => {});
      }
    });

    // ---- auth ----
    $('[data-f="login"]').addEventListener("submit", async e => {
      e.preventDefault();
      const msg = $('[data-m="login"]'); msg.textContent = "";
      try { me = await auth("/login", { method: "POST", body: JSON.stringify({ username: $("#lu").value.trim(), password: $("#lp").value }) }); }
      catch (err) { msg.textContent = err.status === 401 ? "Invalid credentials." : (err.message || "error"); return; }
      boot();
    });
    root.querySelectorAll('[data-a="logout"]').forEach(b => b.addEventListener("click", async () => { await auth("/logout", { method: "POST" }); show("login"); }));

    boot();
    return { refresh };
  }

  globalThis.Console = { mount, usernameFor };
})();
