/* Shared set-password machinery for every website's _invite/ and _reset/
   pages. A site "skins" the page (its own markup and styles) and tags the
   elements it provides with data-pw hooks; this script does the rest:
   reads ?code=, checks it with /admin/api/token-info, fills the username,
   submits /admin/api/set-password, and switches states. Sites without a
   skin get the default pages under /admin/_invite/ and /admin/_reset/,
   which use this same script.

   Hooks (form, password and submit are required; the rest optional):
     data-pw="form"      the <form>
     data-pw="username"  readonly input, filled from the code
     data-pw="password"  the new-password input
     data-pw="submit"    the submit button
     data-pw="msg"       error line
     data-pw="nocode"    shown when the page is opened without a code
     data-pw="invalid"   shown when the code is void, expired or the wrong kind
     data-pw="done"      shown after success
     data-pw="name"      receives the display name on success
     data-pw="enter"     link into the site on success (href is set)

   The kind (invite | reset) comes from the path (/_invite/ vs /_reset/)
   and must match the code's kind, so an invite code cannot be used on
   the reset page or vice versa. Without a code the page renders but the
   form is disabled — a code is the only way in. */
const SetPassword = (() => {
  const API = "/admin/api";
  const kind = () => /\/_reset\//.test(location.pathname) ? "reset" : "invite";
  const code = () => new URLSearchParams(location.search).get("code") || "";

  // → { state: "ok" | "nocode" | "invalid", kind, code?, username?, display_name?, website? }
  async function resolve() {
    const k = kind(), c = code();
    if (!c) return { state: "nocode", kind: k };
    let r = null;
    try { r = await fetch(`${API}/token-info?code=${encodeURIComponent(c)}`); } catch {}
    if (!r || !r.ok) return { state: "invalid", kind: k };
    const info = await r.json();
    if (info.kind && info.kind !== k) return { state: "invalid", kind: k };
    return { state: "ok", kind: k, code: c, ...info };
  }

  async function submit(c, password) {
    const r = await fetch(`${API}/set-password`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: c, password }),
    });
    if (r.ok) return r.json();
    throw new Error(r.status === 404 ? "This link is void or has expired." : r.status === 400 ? await r.text() : "Something went wrong.");
  }

  // Wire the hooks under root; resolves with the state once the page is ready.
  async function mount(root = document, { onDone } = {}) {
    const q = k => root.querySelector(`[data-pw="${k}"]`);
    const show = (k, on) => { const el = q(k); if (el) el.hidden = !on; };
    const st = await resolve();
    ["nocode", "invalid", "done"].forEach(k => show(k, st.state === k));
    show("form", st.state !== "invalid");
    const form = q("form"), u = q("username"), p = q("password"), b = q("submit"), msg = q("msg");
    if (st.state !== "ok") {
      form?.querySelectorAll("input, button").forEach(x => { x.disabled = true; });
      return st;
    }
    if (u) u.value = st.username;
    form?.addEventListener("submit", async e => {
      e.preventDefault();
      if (msg) msg.textContent = "";
      if (b) b.disabled = true;
      try {
        const me = await submit(st.code, p.value);
        show("form", false);
        const n = q("name"); if (n) n.textContent = me.display_name;
        const enter = q("enter"); if (enter && st.website && st.website !== "admin") enter.href = `/${st.website}/`;
        show("done", true);
        onDone?.(me, st);
      } catch (err) {
        if (msg) msg.textContent = err.message;
        if (b) b.disabled = false;
      }
    });
    return st;
  }

  return { kind, code, resolve, submit, mount };
})();
