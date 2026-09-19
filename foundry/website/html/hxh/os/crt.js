/* CRT — the scanline overlay toggle, remembered per browser. */
export const CRT_KEY = "hxh.crt";

export class CRT {
  constructor({ body = globalThis.document?.body, storage = globalThis.localStorage, bus = null } = {}) {
    this.body = body;
    this.storage = storage;
    this.bus = bus;
  }
  get on() {
    try { return this.storage?.getItem(CRT_KEY) === "1"; } catch { return false; }   // off by default (Andrew, 2026-09-19); the browser remembers an override
  }
  set(on) {
    this.body?.classList.toggle("crt", !!on);
    try { this.storage?.setItem(CRT_KEY, on ? "1" : "0"); } catch {}
    this.bus?.emit("crt", { on: !!on });
    return !!on;
  }
  toggle() { return this.set(!this.on); }
  /** Apply the remembered state to the body. */
  apply() { this.body?.classList.toggle("crt", this.on); return this.on; }
}
