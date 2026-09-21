/* Roster DB — the curation app: admins (Andrew, Abi) build the character
   base one character at a time here. The hxh-character skill inserts a
   character as "pending" with its pictures; this app is where the
   profile is checked and edited, pictures are cropped into the avatar
   (1:1) and card (2:3), and the verdict is passed — accept, or reject
   with a reason. Every change bumps the character's version; verdicts
   are logged against the version they judged. Windows: the list, one
   per character, one per picture being cropped, plus small dialogs.
   Visible to hxh admins only. */
import { App } from "../../os/apps.js";
import { RosterAPI } from "./api.js";
import { RosterWindow, FILTERS } from "./list.js";
import { CharacterWindow, winId } from "./character.js";
import { CropWindow, cropId } from "./crop.js";
import { ConfirmDialog, PromptDialog, ReasonDialog, RequestDialog } from "./dialogs.js";
import { busy } from "./busy.js";
import { AVATAR_RATIO, CARD_RATIO } from "./fields.js";
import "./roster.css";


export class RosterApp extends App {
  static id = "roster";
  static name = "Roster DB";
  static longName = "Roster DB";
  static icon = "db";
  static order = 25;

  constructor(os, options = {}) {
    super(os, options);
    this.api = new RosterAPI({ fetch: options.fetch || os.fetch, base: options.base });
    this.chars = new Map();     // id → CharacterWindow
    this.crops = new Map();     // image id → CropWindow
  }

  visible(user) { return !!user && (user.roles || []).some(r => r.website === "hxh" && r.role === "admin"); }

  /* ---------- the list ---------- */
  launch() {
    const win = this.list();
    this.os.wm.open(win.id, win.state.placed ? null : (this.os.env.floating() ? { x: 120, y: 40 } : null));
    this.refreshList();
    return win;
  }

  list() {
    if (this.listWin) return this.listWin;
    const os = this.os;
    const w = this.listWin = new RosterWindow({ thumbURL: id => this.api.thumbURL(id), menus: win => this.listMenus(win) });
    os.wm.add(w);
    w.on("open", ({ id }) => this.openChar(id));
    return w;
  }

  listMenus(win) {
    const os = this.os;
    return os.appMenus(win, {
      file: () => [{ label: "New character…", onclick: () => this.newCharacter() }],
      view: () => [
        ...FILTERS.map(([f, label]) => ({ label, check: () => this.listWin.filter === f, onclick: () => this.listWin.setFilter(f) })),
        "sep",
        { label: "Refresh", onclick: () => this.refreshList() },
      ],
      help: () => os.appItems("system", { long: true, icons: false }),
    });
  }

  async refreshList() {
    const w = this.list();
    try { w.setChars(await this.api.list()); w.say(""); }
    catch (err) { w.say(err.message, true); }
  }

  async newCharacter() {
    const name = await new PromptDialog({ title: "New character", label: "Name", ok: "Create" }).ask(this.os);
    if (!name) return;
    try {
      const c = await this.api.create({ name });
      this.changed(c);
      this.openChar(c.id);
    } catch (err) { this.os.toast.show(err.message); }
  }

  /* ---------- a character ---------- */
  async openChar(id) {
    const os = this.os;
    let w = this.chars.get(id);
    if (!w) {
      w = new CharacterWindow({ id, thumbURL: i => this.api.thumbURL(i), menus: win => this.charMenus(win, id) });
      os.wm.add(w);
      this.chars.set(id, w);
      w.on("patch", ({ fields }) => this.patch(id, fields));
      w.on("slot", ({ slot, id: imageId }) => this.patch(id, { [slot]: imageId }));
      w.on("review", ({ status }) => this.review(id, status));
      w.on("request", () => this.request(id));
      w.on("upload", ({ files }) => this.upload(id, files));
      w.on("crop", ({ id: imageId }) => this.openCrop(imageId));
      w.on("image", ({ act, id: imageId }) => this.imageAct(id, act, imageId));
      w.on("close", () => { this.chars.delete(id); os.wm.remove(w.id); });
    }
    const at = w.state.placed ? null : (os.env.floating() ? { x: 180 + (this.chars.size % 4) * 24, y: 60 + (this.chars.size % 4) * 24 } : null);
    os.wm.open(w.id, at);
    await this.reload(id);
    return w;
  }

  charMenus(win, id) {
    return this.os.appMenus(win, {
      file: () => [
        { label: "Upload picture…", onclick: () => win.file.click() },
        { label: "Refresh", onclick: () => this.reload(id) },
        "sep",
        { label: "Delete character…", onclick: () => this.deleteChar(id) },
      ],
    });
  }

  /** Fetch the character and repaint its window (and its list row). */
  async reload(id, { form = true } = {}) {
    const w = this.chars.get(id);
    try {
      const c = await this.hold(w, this.api.get(id));
      w?.setChar(c, { form });
      w?.say("");
      this.changed(c);
      return c;
    } catch (err) {
      w?.say(err.status === 404 ? "No such character." : err.message, true);
      return null;
    }
  }

  /** Every call to the database freezes its window until the answer is back. */
  hold(win, promise, label) { return win ? busy(win, promise, label) : promise; }

  async patch(id, fields) {
    const w = this.chars.get(id);
    try {
      const c = await this.hold(w, this.api.patch(id, fields));
      w?.setChar(c, { form: false });
      w?.say("Saved");
      this.changed(c);
    } catch (err) { w?.say(err.message, true); }
  }

  async review(id, status) {
    const w = this.chars.get(id);
    let reason = "";
    if (status === "rejected") {
      reason = await new ReasonDialog({ name: w?.char?.name || "#" + id }).ask(this.os);
      if (reason === null) return;   // cancelled; an empty reason is allowed
    }
    try {
      const c = await this.hold(w, this.api.review(id, status, reason));
      w?.setChar(c, { form: false });
      w?.say(status === "accepted" ? "Accepted" : status === "rejected" ? "Rejected" : "Back to pending");
      this.changed(c);
    } catch (err) { w?.say(err.message, true); }
  }

  /** Request…: a kind from the server's list plus optional details; the character reads "requested" until the bot resolves it. */
  async request(id) {
    const w = this.chars.get(id);
    try {
      this.kinds ||= await this.hold(w, this.api.requestKinds());
    } catch (err) { w?.say(err.message, true); return; }
    const r = await new RequestDialog({ kinds: this.kinds }).ask(this.os);
    if (!r) return;
    try {
      const c = await this.hold(w, this.api.request(id, r.kind, r.text));
      w?.setChar(c, { form: false });
      w?.say("Requested");
      this.changed(c);
    } catch (err) { w?.say(err.message, true); }
  }

  /** A character changed on the server: the list row follows, and anything showing the roster (the Binder) hears about it. */
  changed(c) {
    this.listWin?.update(c);
    this.os.bus?.emit("roster:changed", { id: c.id });
  }

  async upload(id, files) {
    const w = this.chars.get(id);
    let n = 0, dup = 0;
    for (const f of files) {
      if (!/^image\//.test(f.type)) continue;
      try {
        const r = await this.hold(w, this.api.upload(id, f, { type: "uploaded", caption: (f.name || "").replace(/\.[a-z0-9]+$/i, "") }), "Uploading…");
        r.created ? n++ : dup++;
      } catch (err) { w?.say(`${f.name}: ${err.message}`, true); }
    }
    await this.reload(id, { form: false });
    if (n || dup) w?.say(`${n} added${dup ? `, ${dup} already there` : ""}`);
  }

  async imageAct(id, act, imageId) {
    const w = this.chars.get(id);
    if (!imageId) return;
    void (w?.char?.images || []).find(i => i.id === imageId);
    try {
      switch (act) {
        case "avatar": await this.patch(id, { avatar_image_id: w.char.avatar_image_id === imageId ? null : imageId }); w.select(imageId); break;
        case "card": await this.patch(id, { card_image_id: w.char.card_image_id === imageId ? null : imageId }); w.select(imageId); break;
        case "crop": this.openCrop(imageId); break;
        case "open": this.os.win.open?.(this.api.imageURL(imageId), "_blank"); break;
        case "delete":
          if (!await new ConfirmDialog({ message: `Delete picture #${imageId}?`, ok: "Delete" }).ask(this.os)) return;
          await this.hold(w, this.api.deleteImage(imageId));
          w.select(null);
          await this.reload(id, { form: false });
          break;
      }
    } catch (err) { w?.say(err.message, true); }
  }

  async deleteChar(id) {
    const w = this.chars.get(id);
    const name = w?.char?.name || "#" + id;
    if (!await new ConfirmDialog({ message: `Delete ${name} and all its pictures?`, ok: "Delete" }).ask(this.os)) return;
    try {
      await this.hold(w, this.api.remove(id));
      w?.close();
      this.listWin?.drop(id);
    } catch (err) { w?.say(err.message, true); }
  }

  /* ---------- cropping ---------- */
  async openCrop(imageId) {
    const os = this.os;
    let w = this.crops.get(imageId);
    if (!w) {
      let meta;
      try { meta = await this.api.imageMeta(imageId); }
      catch (err) { os.toast.show(err.message); return null; }
      w = new CropWindow({ image: meta.image, char: meta.char, src: this.api.imageURL(imageId), desktop: { vw: os.env.width, vh: os.env.height },
        menus: win => os.appMenus(win, { file: () => [{ label: "Save", onclick: () => win.save() }] }) });
      os.wm.add(w);
      this.crops.set(imageId, w);
      w.on("save", ({ rect, blob }) => this.crop(imageId, meta, rect, blob));
      w.on("revert", async () => { if (await new ConfirmDialog({ message: "All changes will be lost.", ok: "Revert" }).ask(os)) w.doRevert(); });
      w.on("close", () => { this.crops.delete(imageId); os.wm.remove(w.id); });
    }
    // open where the reviewer is looking: the character window can be taller than the screen
    const scrollY = (os.win.scrollY || 0) / (os.env.zoom?.() || 1);
    const at = w.state.placed ? null : (os.env.floating() ? { x: 40, y: Math.round(scrollY) + 24 } : null);
    os.wm.open(w.id, at);
    w.el.focus?.();
    return w;
  }

  /** Untouched: the server cuts the exact source pixels. Painted: the canvas pixels go up as a new "cropped"
      picture. Once the database has answered, the crop window closes — and a crop of the avatar's or the
      card's proportion fills that slot when it is still empty (Andrew, 2026-09-20). */
  async crop(imageId, meta, rect, blob = null) {
    const w = this.crops.get(imageId);
    try {
      const r = await this.hold(w, blob
        ? this.api.upload(meta.char.id, blob, { type: "cropped", source_image_id: imageId, caption: meta.image.caption || "", name: `paint-${imageId}.png` })
        : this.api.crop(imageId, rect), "Saving…");
      w?.saved(r.image, r.created);
      w?.close();
      const c = await this.reload(meta.char.id, { form: false });
      const slot = c && slotFor(r.image, c);
      if (slot) {
        await this.patch(c.id, { [slot]: r.image.id });
        this.chars.get(c.id)?.say(`Saved · set as ${slot === "avatar_image_id" ? "avatar" : "card"}`);
      }
    } catch (err) { w?.failed(err.message); }
  }
}

/** The empty slot a picture of this proportion should fill, if any: avatar (1:1) or card (16:9). */
export function slotFor(image, c, tol = 0.02) {
  const r = image.width / image.height;
  if (!c.avatar_image_id && Math.abs(r - AVATAR_RATIO) <= tol) return "avatar_image_id";
  if (!c.card_image_id && Math.abs(r - CARD_RATIO) <= tol) return "card_image_id";
  return null;
}

export { RosterWindow, CharacterWindow, CropWindow, winId, cropId };
