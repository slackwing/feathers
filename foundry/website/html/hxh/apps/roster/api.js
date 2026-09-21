/* RosterAPI — the Roster DB endpoints (hobby-server internal/hxh/
   rosterdb.go) as promises. Errors carry the server's message. */
export class RosterAPI {
  constructor({ fetch, base = "/hxh/api/db" } = {}) {
    this.fetch = fetch || globalThis.fetch?.bind(globalThis);
    this.base = base;
  }

  imageURL(id) { return `${this.base}/images/${id}`; }
  thumbURL(id) { return `${this.base}/images/${id}/thumb`; }

  async call(method, path, body, ctype) {
    const init = { method, credentials: "same-origin", headers: {} };
    if (body !== undefined) {
      if (ctype) { init.headers["Content-Type"] = ctype; init.body = body; }
      else if (typeof FormData !== "undefined" && body instanceof FormData) init.body = body;
      else { init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(body); }
    }
    const r = await this.fetch(this.base + path, init);
    if (r.status === 204) return null;
    let data = null;
    try { data = await r.json(); } catch { data = null; }
    if (!r.ok) throw Object.assign(new Error(data?.error || `HTTP ${r.status}`), { status: r.status });
    return data;
  }

  list(status = "") { return this.call("GET", "/chars" + (status ? `?status=${encodeURIComponent(status)}` : "")); }
  get(id) { return this.call("GET", `/chars/${id}`); }
  create(fields) { return this.call("POST", "/chars", fields); }
  patch(id, fields) { return this.call("PATCH", `/chars/${id}`, fields); }
  /** Put a character right after another in the binder order (after = 0 → the front); the server renumbers atomically and answers with the whole list. */
  move(id, after) { return this.call("POST", `/chars/${id}/move`, { after }); }
  review(id, status, reason = "") { return this.call("POST", `/chars/${id}/review`, { status, reason }); }
  requestKinds() { return this.call("GET", "/request-kinds"); }
  request(id, kind, text = "") { return this.call("POST", `/chars/${id}/request`, { kind, text }); }
  requests(status = "open") { return this.call("GET", "/requests" + (status ? `?status=${encodeURIComponent(status)}` : "")); }
  resolveRequest(id) { return this.call("POST", `/requests/${id}/resolve`); }
  remove(id) { return this.call("DELETE", `/chars/${id}`); }
  upload(id, file, { type = "raw", caption = "", source_image_id = null, name = "" } = {}) {
    const fd = new FormData();
    if (name) fd.append("file", file, name); else fd.append("file", file);
    fd.append("type", type);
    fd.append("caption", caption);
    if (source_image_id) fd.append("source_image_id", String(source_image_id));
    return this.call("POST", `/chars/${id}/images`, fd);
  }
  imageMeta(id) { return this.call("GET", `/images/${id}/meta`); }
  patchImage(id, fields) { return this.call("PATCH", `/images/${id}`, fields); }
  deleteImage(id) { return this.call("DELETE", `/images/${id}`); }
  crop(id, rect) { return this.call("POST", `/images/${id}/crop`, rect); }
}
