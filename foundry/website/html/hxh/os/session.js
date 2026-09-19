/* Session — the shared-auth API (hobby-server /admin/api) and in-OS
   navigation. fetch and storage are injectable for tests. */
export class Session {
  constructor({ fetch = globalThis.fetch?.bind(globalThis), api = "/admin/api" } = {}) {
    this.fetch = fetch;
    this.api = api;
  }

  async me() {
    try {
      const r = await this.fetch(this.api + "/me");
      return r.ok ? await r.json() : null;
    } catch { return null; }
  }

  async login(username, password) {
    const r = await this.fetch(this.api + "/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!r.ok) throw new Error(r.status === 401 ? "The committee does not recognize you." : "Something went wrong.");
    return r.json();
  }

  async logout() {
    try { await this.fetch(this.api + "/logout", { method: "POST" }); } catch {}
  }

  /** Always resolves; the server answers the same whether the user exists. */
  async forgot(username) {
    try {
      await this.fetch(this.api + "/forgot", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
    } catch {}
  }
}

export const WARM_KEY = "hxh.warm";

/* Boot on every load — refresh, typed URL, logout — EXCEPT navigations
   started from inside the OS (go), which leave a one-shot "warm" flag the
   next page consumes so opening another page doesn't reboot the machine. */
export class Nav {
  constructor({ storage = globalThis.sessionStorage, location = globalThis.location, home = "/hxh/" } = {}) {
    this.storage = storage;
    this.location = location;
    this.home = home;
  }
  go(url) {
    try { this.storage?.setItem(WARM_KEY, "1"); } catch {}
    this.location.href = url;
  }
  /** Was this load started from inside the OS? Consumes the flag. */
  consumeWarm() {
    try {
      const warm = this.storage?.getItem(WARM_KEY) === "1";
      this.storage?.removeItem(WARM_KEY);
      return warm;
    } catch { return false; }
  }
  /** A cold load of the home page (boots, then the logon screen). */
  cold(url = this.home) { this.location.href = url; }
}
