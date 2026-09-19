import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupDom, fakeFetch, tick } from "./dom.js";
import { OS } from "../html/hxh/os/os.js";
import { RosterApp, RosterWindow, CharacterWindow, CropWindow, winId, cropId } from "../html/hxh/apps/roster/app.js";
import { Dialog } from "../html/hxh/apps/roster/dialogs.js";
import { PaintDoc, packRGBA } from "../html/hxh/apps/roster/paint.js";

const ADMIN = { username: "andrew", display_name: "Andrew", initial: "AC", color: "#d914e3", roles: [{ website: "hxh", role: "admin" }] };
const GUEST = { username: "abi", display_name: "Abi", initial: "AG", color: "#349db2", roles: [{ website: "hxh", role: "guest" }] };
const IMG = (id, type, extra = {}) => ({ id, char_id: 3, type, source_image_id: null, mime: "image/png", width: 1920, height: 1080, bytes: 100000, sha256: "x", source_url: "", caption: "cap " + id, status: "kept", owner: "claude", created_at: "2026-09-19T00:00:00Z", ...extra });
const gon = () => ({ id: 3, name: "Gon Freecss", name_ja: "ゴン＝フリークス", first: "Gon", rank: "S", nen_types: ["enhancement"], affiliation: "Hunter Association",
  arcs: ["hunter-exam", "greed-island"], arms: ["fishing-rod"], description: "A boy.", notes: "n", version: 4, review_status: "pending", review_reason: "",
  avatar_image_id: null, card_image_id: null, owner: "claude", created_at: "2026-09-19T00:00:00Z", updated_at: "2026-09-19T00:00:00Z", image_count: 3,
  card_description: "", images: [IMG(12, "cropped", { source_image_id: 10, width: 640, height: 360, owner: "abi" }), IMG(11, "cropped", { source_image_id: 10, width: 500, height: 500, owner: "andrew" }), IMG(10, "raw")],
  reviews: [{ id: 1, char_id: 3, version: 2, status: "rejected", reason: "wrong Nen", owner: "andrew", created_at: "2026-09-18T00:00:00Z" }] });
const killua = () => ({ ...gon(), id: 4, name: "Killua Zoldyck", review_status: "accepted", images: [], reviews: [], image_count: 0, version: 1 });

let d, os, log, api, state;
async function boot(me = ADMIN) {
  d = setupDom();
  log = [];
  state = { gon: gon() };
  api = {
    "GET /admin/api/me": [200, me],
    "GET /hxh/api/db/chars": () => [200, [state.gon, killua()].map(({ images, reviews, ...c }) => c)],
    "GET /hxh/api/db/chars/3": () => [200, state.gon],
    "PATCH /hxh/api/db/chars/3": init => { const body = JSON.parse(init.body); state.gon = { ...state.gon, ...body, version: state.gon.version + 1 }; return [200, state.gon]; },
    "POST /hxh/api/db/chars/3/review": init => { const body = JSON.parse(init.body);
      state.gon = { ...state.gon, review_status: body.status, review_reason: body.reason, reviews: [{ id: 9, char_id: 3, version: state.gon.version, status: body.status, reason: body.reason, owner: "andrew", created_at: "2026-09-19T01:00:00Z" }, ...state.gon.reviews] }; return [200, state.gon]; },
    "POST /hxh/api/db/chars": init => [201, { ...killua(), id: 5, name: JSON.parse(init.body).name }],
    "GET /hxh/api/db/chars/5": () => [200, { ...killua(), id: 5, name: "Leorio" }],
    "DELETE /hxh/api/db/chars/3": [204, null],
    "DELETE /hxh/api/db/images/10": () => { state.gon.images = state.gon.images.filter(i => i.id !== 10); return [204, null]; },
    "GET /hxh/api/db/images/10/meta": () => [200, { image: IMG(10, "raw"), char: { id: 3, name: "Gon Freecss" } }],
    "POST /hxh/api/db/images/10/crop": init => { const r = JSON.parse(init.body); const im = IMG(13, "cropped", { source_image_id: 10, width: r.w, height: r.h }); state.gon.images.unshift(im); return [201, { image: im, created: true }]; },
  };
  os = new OS({ win: d.win, fetch: fakeFetch(api, log), env: { reduced: true, floating: () => true, zoom: () => 1, width: 1366, height: 900, wait: () => Promise.resolve() } });
  await os.start({ apps: [RosterApp], boot: false, start: true });
}
const app = () => os.registry.get("roster");
const charWin = () => os.wm.get(winId(3));

/* a 2D context jsdom does not have: a real little raster, so fills and expansions can be checked */
function rasterCtx(canvas) {
  let w = -1, h = -1, buf = null;
  const ensure = () => { if (canvas.width !== w || canvas.height !== h) { w = canvas.width; h = canvas.height; buf = new Uint8ClampedArray(w * h * 4); } };
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const ctx = { calls: [], fillStyle: "#000000", strokeStyle: "#000000", lineWidth: 1,
    getImageData(x, y, gw, gh) { ensure(); const out = new Uint8ClampedArray(gw * gh * 4); for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const s = ((y + j) * w + (x + i)) * 4; out.set(buf.subarray(s, s + 4), (j * gw + i) * 4); } return { width: gw, height: gh, data: out }; },
    putImageData(img, x, y) { ensure(); for (let j = 0; j < img.height; j++) for (let i = 0; i < img.width; i++) { if (x + i >= w || y + j >= h) continue; const s = (j * img.width + i) * 4; buf.set(img.data.subarray(s, s + 4), ((y + j) * w + (x + i)) * 4); } },
    fillRect(x, y, fw, fh) { ensure(); const [r, g, b] = rgb(this.fillStyle); for (let j = y; j < y + fh; j++) for (let i = x; i < x + fw; i++) { const k = (j * w + i) * 4; buf[k] = r; buf[k + 1] = g; buf[k + 2] = b; buf[k + 3] = 255; } },
    clearRect() { ensure(); buf.fill(0); },
    drawImage() { ensure(); ctx.calls.push(["drawImage"]); },
    beginPath() {}, arc(x, y, r) { ctx.calls.push(["arc", x, y, r]); }, fill() {}, moveTo() {}, lineTo(x, y) { ctx.calls.push(["lineTo", x, y]); }, stroke() {},
    pixel(x, y) { ensure(); const k = (y * w + x) * 4; return "#" + [buf[k], buf[k + 1], buf[k + 2]].map(v => v.toString(16).padStart(2, "0")).join(""); } };
  return ctx;
}
function installRaster() {
  const ctxs = new Map();
  d.win.HTMLCanvasElement.prototype.getContext = function () { if (!ctxs.has(this)) ctxs.set(this, rasterCtx(this)); return ctxs.get(this); };
  return ctxs;
}

test("only hxh admins see the app", async () => {
  await boot(GUEST);
  assert.ok(!os.desktop.icons.get("roster"));
  assert.equal(app().visible(GUEST), false);
  await boot(ADMIN);
  assert.ok(os.desktop.icons.get("roster"));
  assert.equal(app().name, "Roster DB");
});

test("launch opens the list: every verdict, pending first; headers inside the list from the shared field names; per-category counts; Enter opens", async () => {
  await boot();
  state.gon.review_status = "accepted";   // Gon accepted, Killua (also accepted) plus a rejected and a pending one to sort
  api["GET /hxh/api/db/chars"] = () => [200, [
    { ...killua(), id: 7, name: "Zzz Rejected", review_status: "rejected" }, { ...killua(), id: 4 }, { ...state.gon, images: undefined, reviews: undefined, image_counts: { raw: 11, cropped: 2 } }, { ...killua(), id: 6, name: "Aaa Pending", review_status: "pending" },
  ]];
  await os.launch("roster");
  await tick();
  const w = os.wm.get("win-roster");
  assert.ok(w instanceof RosterWindow && w.state.open);
  assert.equal(w.el.style.width, "1280px");
  assert.equal(w.filter, "");
  assert.deepEqual([...w.body.querySelectorAll(".row .c-name")].map(e => e.textContent), ["Aaa Pending", "Gon Freecss", "Killua Zoldyck", "Zzz Rejected"]);
  assert.equal(w.head.parentElement, w.rows);   // the header scrolls with the rows, under the same scrollbar
  assert.deepEqual([...w.head.children].map(e => e.textContent), ["#", "", "Name", "Japanese", "Card Rank", "Nen", "Affiliation", "Pics", "v", "Review"]);
  assert.equal(w.countEl.textContent, "4 characters · 1 pending");
  const gonRow = w.body.querySelector('.row[data-id="3"]');
  assert.equal(gonRow.querySelector(".c-ver").textContent, "4");
  assert.deepEqual([...gonRow.querySelectorAll(".c-pics i")].map(i => i.textContent), ["11", "0", "2", "0", "0", "0"]);
  assert.equal(gonRow.querySelector(".c-pics").title, "Random · Uploaded · Edited · Pixel art · Upscaled · Transparent");
  w.setFilter("rejected");
  assert.equal(w.body.querySelectorAll(".row").length, 1);
  w.setFilter("");
  const items = w.menuBar.menus[1].itemsNow();
  assert.deepEqual(items.filter(i => i !== "sep").map(i => i.label), ["All", "Pending", "Accepted", "Rejected", "Refresh"]);
  assert.equal(items[0].check(), true);
  w.select(3);
  d.key(w.rows, "Enter");
  await tick();
  assert.ok(charWin() instanceof CharacterWindow && charWin().state.open);
  assert.equal(charWin().title, "#3 Gon Freecss");
});

test("the character window: profile, review box, every picture category (empty ones too), thumbnails by proportion; a field change PATCHes and bumps the version", async () => {
  await boot();
  await app().openChar(3);
  await tick();
  const w = charWin(), el = w.el;
  assert.equal(el.querySelector('[data-f="name_ja"]').value, "ゴン＝フリークス");
  assert.equal(el.querySelector('[data-nen="0"]').value, "enhancement");
  assert.equal(el.querySelector('[data-arc="greed-island"]').checked, true);
  assert.equal(el.querySelector('[data-f="arms"]').value, "fishing-rod");
  assert.equal(el.querySelector(".verdict .st").textContent, "Pending");
  assert.equal(el.querySelector(".verdict .ver").textContent, "v4");
  assert.match(el.querySelector(".log").textContent, /v2 rejected andrew — wrong Nen/);
  assert.deepEqual([...el.querySelectorAll(".sec")].map(s => s.dataset.type), ["raw", "uploaded", "cropped", "pixelated", "upscaled", "transparent"]);
  assert.deepEqual([...el.querySelectorAll(".sec .sech")].map(s => s.textContent), ["Random1", "Uploaded0", "Edited2", "Pixel art0", "Upscaled0", "Transparent0"]);
  assert.equal(el.querySelector(".profile .lbl").textContent, "Name");
  assert.equal([...el.querySelectorAll(".profile .lbl")].find(l => l.textContent === "Card Rank")?.textContent, "Card Rank");
  assert.equal(el.querySelector('.tile[data-id="10"] .pic').className, "pic fit");     // 16:9 is the edge of the range — shows whole
  assert.equal(el.querySelector('.tile[data-id="11"] .pic').className, "pic fit");     // 1:1 shows whole
  assert.equal(el.querySelector('.tile[data-id="12"] .pic').className, "pic fit");     // 16:9 shows whole
  assert.ok(el.querySelector('[data-f="card_description"]'), "the card description field exists");
  assert.equal([...el.querySelectorAll(".profile .lbl")].some(l => l.textContent.startsWith("Card description")), true);
  state.gon.images.push(IMG(15, "raw", { width: 2000, height: 500 }), IMG(16, "raw", { width: 500, height: 2000 }));
  w.setChar(state.gon);
  assert.equal(el.querySelector('.tile[data-id="15"] .pic').className, "pic cut-x");   // 4:1 — short side full, chevrons left/right
  assert.equal(el.querySelector('.tile[data-id="16"] .pic').className, "pic cut-y");
  const first = el.querySelector('[data-f="first"]');
  first.value = "Gonny";
  d.fire(first, "change");
  assert.equal(el.querySelector(":scope > .busy").hidden, false);   // frozen while the database answers
  await tick();
  assert.equal(el.querySelector(":scope > .busy").hidden, true);
  assert.deepEqual(log.filter(l => l.method === "PATCH").map(l => l.body), [{ first: "Gonny" }]);
  assert.equal(el.querySelector(".verdict .ver").textContent, "v5");
  assert.equal(w.msgEl.textContent, "Saved");
});

test("the toolbar: Set as Avatar only for 1:1, Set as Card only for 16:9; Crop, Open in New Tab, Delete for any; no picture-level reject", async () => {
  await boot();
  await app().openChar(3);
  await tick();
  const w = charWin(), el = w.el;
  assert.deepEqual([...el.querySelectorAll(".gtools [data-img]")].map(b => b.textContent), ["Set as Avatar", "Set as Card", "Crop", "Open in New Tab", "Delete", "Upload…"]);
  assert.ok(!el.querySelector('[data-img="reject"]') && !el.querySelector("[data-show-rejected]"));
  const enabled = () => [...el.querySelectorAll(".gtools [data-img]")].filter(b => !b.disabled).map(b => b.dataset.img);
  assert.deepEqual(enabled(), ["upload"]);
  d.click(el.querySelector('.tile[data-id="10"]'));   // 16:9 raw: card-shaped already
  assert.deepEqual(enabled(), ["card", "crop", "open", "delete", "upload"]);
  d.click(el.querySelector('.tile[data-id="11"]'));   // 1:1
  assert.deepEqual(enabled(), ["avatar", "crop", "open", "delete", "upload"]);
  d.click(el.querySelector('.tile[data-id="12"]'));   // 16:9
  assert.deepEqual(enabled(), ["card", "crop", "open", "delete", "upload"]);
  assert.match(w.selEl.textContent, /#12 · cropped · 640×360/);
  d.click(el.querySelector('[data-img="card"]'));
  await tick();
  assert.deepEqual(log.at(-1).body, { card_image_id: 12 });
  assert.ok(el.querySelector(".slot.cd.set img"));
  assert.equal(el.querySelector('.tile[data-id="12"] .role').textContent, "card");
  // delete asks first
  d.click(el.querySelector('.tile[data-id="10"]'));
  d.click(el.querySelector('[data-img="delete"]'));
  await tick();
  const dlg = os.wm.all().find(x => x instanceof Dialog);
  assert.match(dlg.el.textContent, /Delete picture #10\?/);
  d.click(dlg.$('[data-act="ok"]'));
  await tick(); await tick();
  assert.ok(log.some(l => l.method === "DELETE" && l.path === "/hxh/api/db/images/10"));
  assert.ok(!el.querySelector('.tile[data-id="10"]'));
});

test("Reject… asks for an optional reason and logs the verdict with its owner; Accept needs none", async () => {
  await boot();
  await app().openChar(3);
  await tick();
  const w = charWin();
  d.click(w.el.querySelector('[data-review="rejected"]'));
  await tick();
  const dlg = os.wm.all().find(x => x instanceof Dialog);
  assert.ok(dlg && dlg.state.open && dlg.title === "Reject");
  assert.equal(dlg.$(".lbl").textContent, "Rejection reason (optional):");
  assert.equal(dlg.$('[data-act="ok"]').disabled, false);   // empty is fine
  d.click(dlg.$('[data-act="ok"]'));
  await tick(); await tick();
  assert.deepEqual(log.at(-1).body, { status: "rejected", reason: "" });
  assert.equal(w.el.querySelector(".verdict .st").textContent, "Rejected");
  assert.equal(w.el.querySelector(".verdict .by").textContent, "by andrew");
  assert.match(w.el.querySelector(".log").textContent, /v4 rejected andrew/);
  d.click(w.el.querySelector('[data-review="accepted"]'));
  await tick();
  assert.deepEqual(log.at(-1).body, { status: "accepted", reason: "" });
  assert.equal(w.el.querySelector(".verdict .st").textContent, "Accepted");
});

test("crop window: sized to show the whole picture; a ratio button starts a centred selection; the status reads the picture size; save closes it", async () => {
  await boot();
  await app().openChar(3);
  await tick();
  const w = charWin();
  w.el.querySelector('.tile[data-id="10"]').dispatchEvent(new d.win.MouseEvent("dblclick", { bubbles: true }));
  await tick();
  const c = os.wm.get(cropId(10));
  assert.ok(c instanceof CropWindow && c.state.open);
  assert.equal(c.title, "Crop #10 — Gon Freecss");
  assert.ok(!c.el.querySelector('[data-act="fit"]'), "no Fit toggle any more");
  assert.equal(c.canvas.style.width, "1049px");   // 1920×1080 fitted into 1276×590 → 590/1080 zoom
  assert.equal(c.canvas.style.height, "590px");
  assert.equal(c.posEl.textContent, "1920 × 1080");
  assert.equal(c.saveBtn.textContent, "Save");
  assert.equal(c.saveBtn.disabled, true);
  assert.deepEqual([...c.el.querySelectorAll("[data-r]")].map(b => b.textContent), ["Free", "1:1 Avatar", "2:3", "3:2", "4:5", "5:4", "16:9 Card", "9:16"]);
  assert.deepEqual(c.menuBar.menus[0].itemsNow().filter(i => i !== "sep").map(i => i.label), ["Save", "Exit"]);
  d.click(c.el.querySelector('[data-r="1"]'));
  assert.deepEqual(c.box, { x: 636, y: 216, w: 648, h: 648 });   // 60 % of the short side, centred
  assert.equal(c.posEl.textContent, "636, 216  ·  648 × 648");
  assert.equal(c.saveBtn.disabled, false);
  assert.ok(c.el.querySelector('[data-r="1"]').classList.contains("pressed"));
  d.click(c.el.querySelector('[data-r="1"]'));   // again: cancels the selection and unpresses
  assert.equal(c.box, null);
  assert.equal(c.preset, null);
  assert.ok(!c.el.querySelector('[data-r="1"]').classList.contains("pressed"));
  assert.equal(c.posEl.textContent, "1920 × 1080");
  d.click(c.el.querySelector('[data-r="1"]'));
  d.click(c.el.querySelector(`[data-r="${2 / 3}"]`));
  assert.deepEqual(c.box, { x: 744, y: 216, w: 432, h: 648 });   // refit around the centre
  d.click(c.saveBtn);
  await tick(); await tick();
  assert.deepEqual(log.find(l => l.method === "POST" && l.path === "/hxh/api/db/images/10/crop").body, { x: 744, y: 216, w: 432, h: 648 });
  assert.ok(!os.wm.has(cropId(10)), "closed once the database answered");
  assert.equal(w.el.querySelectorAll('.sec[data-type="cropped"] .tile').length, 3);
});

test("paint: strokes, bucket fill, expand canvas and revert all go through one undo / redo history; a painted save uploads the pixels", async () => {
  await boot();
  const ctxs = installRaster();
  await app().openChar(3);
  await tick();
  await app().openCrop(10);
  await tick();
  const c = os.wm.get(cropId(10)), el = c.el, ctx = ctxs.get(c.pic);
  c.doc.load({});   // as if the picture had loaded
  assert.deepEqual([...el.querySelectorAll("button[data-tool]")].map(b => b.dataset.tool), ["marquee", "brush", "bucket", "dropper"]);
  assert.equal(el.querySelectorAll(".palette [data-color]").length, 16);
  const hist = () => ["undo", "redo", "revert"].map(a => !el.querySelector(`[data-act="${a}"]`).disabled);
  assert.deepEqual(hist(), [false, false, false]);
  // bucket: an exact-match fill of the empty raster paints everything
  d.click(el.querySelector('[data-tool="bucket"]'));
  d.click(el.querySelector('.palette [data-color="#ff0000"]'));
  const ev = (type, x, y) => c.wrap.dispatchEvent(new d.win.PointerEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }));
  c.wrap.getBoundingClientRect = () => ({ left: 0, top: 0 });
  ev("pointerdown", 10, 10); ev("pointerup", 10, 10);
  assert.equal(ctx.pixel(0, 0), "#ff0000");
  assert.equal(ctx.pixel(1919, 1079), "#ff0000");
  assert.equal(c.dirty, true);
  assert.deepEqual(hist(), [true, false, true]);
  assert.equal(c.posEl.textContent, "1920 × 1080  ·  painted");
  // a stroke in blue on top
  d.click(el.querySelector('[data-tool="brush"]'));
  d.click(el.querySelector('.palette [data-color="#0000ff"]'));
  ev("pointerdown", 100, 100); ev("pointermove", 200, 150); ev("pointerup", 200, 150);
  assert.ok(ctx.calls.some(k => k[0] === "arc"));
  const line = ctx.calls.find(k => k[0] === "lineTo");
  assert.ok(line && Math.abs(line[1] - 200 / c.z) < 0.01, `line in picture pixels: ${JSON.stringify(line)}`);
  assert.equal(c.doc.pos, 2);
  // expand: 20 px of white all round, the box (if any) rides along
  c.setBox({ x: 100, y: 100, w: 300, h: 200 });
  d.click(el.querySelector('[data-act="expand"]'));
  assert.equal(c.W, 1960); assert.equal(c.H, 1120);
  assert.deepEqual(c.box, { x: 120, y: 120, w: 300, h: 200 });
  assert.equal(ctx.pixel(0, 0), "#ffffff");
  assert.equal(ctx.pixel(25, 25), "#ff0000");
  assert.equal(c.pic.width, 1960);
  assert.equal(c.canvas.style.width, "1033px");   // re-fitted: 590/1120 zoom
  // undo the expansion, redo it
  d.click(el.querySelector('[data-act="undo"]'));
  assert.equal(c.W, 1920);
  assert.deepEqual(c.box, { x: 120, y: 120, w: 300, h: 200 });   // still fits, so it stays
  assert.deepEqual(hist(), [true, true, true]);
  c.setBox({ x: 1700, y: 900, w: 260, h: 220 });
  d.click(el.querySelector('[data-act="undo"]'));   // back to the filled 1920×1080: a box past the edge is dropped
  assert.equal(c.box, null);
  d.click(el.querySelector('[data-act="redo"]'));
  d.click(el.querySelector('[data-act="redo"]'));
  assert.equal(c.W, 1960);
  // eyedropper reads the raster, then hands back to the brush
  d.click(el.querySelector('[data-tool="dropper"]'));
  ev("pointerdown", 1, 1); ev("pointerup", 1, 1);
  assert.equal(c.color, "#ffffff");
  assert.equal(c.tool, "brush");
  // revert asks, then goes back to the stored picture — still undoable
  d.click(el.querySelector('[data-act="revert"]'));
  await tick();
  const ask = os.wm.all().find(x => x instanceof Dialog);
  assert.match(ask.el.textContent, /All changes will be lost\./);
  d.click(ask.$('[data-act="ok"]'));
  await tick();
  assert.equal(c.dirty, false);
  assert.equal(c.W, 1920);
  assert.deepEqual(hist(), [true, false, false]);
  d.click(el.querySelector('[data-act="undo"]'));
  assert.equal(c.dirty, true);
  assert.equal(c.W, 1960);
  // a painted save uploads the canvas pixels (cropped to the box) as a cropped picture and closes the window
  c.setTool("marquee");
  c.setBox({ x: 10, y: 20, w: 300, h: 200 });
  const uploads = [];
  app().api.upload = async (id, blob, opts) => { uploads.push({ id, blob, opts }); return { image: IMG(14, "cropped", { source_image_id: 10, width: 300, height: 200 }), created: true }; };
  c.exportPNG = async rect => ({ rect, type: "image/png" });
  d.click(c.saveBtn);
  await tick(); await tick(); await tick();
  assert.equal(uploads.length, 1);
  assert.deepEqual(uploads[0].blob.rect, { x: 10, y: 20, w: 300, h: 200 });
  assert.deepEqual(uploads[0].opts, { type: "cropped", source_image_id: 10, caption: "cap 10", name: "paint-10.png" });
  assert.equal(log.some(l => l.path.endsWith("/crop")), false);
  assert.ok(!os.wm.has(cropId(10)));
});

test("PaintDoc: history is a list of whole states with a cursor; clean marks the stored state; packRGBA matches canvas memory order", () => {
  d = setupDom();
  const ctxs = installRaster();
  const canvas = d.doc.createElement("canvas");
  const doc = new PaintDoc({ canvas, width: 4, height: 3, depth: 3 });
  const ctx = ctxs.get(canvas);
  doc.load({});
  assert.equal(doc.pos, 0); assert.equal(doc.dirty, false);
  doc.fill({ x: 0, y: 0 }, "#00ff00");
  assert.equal(ctx.pixel(3, 2), "#00ff00");
  doc.fill({ x: 1, y: 1 }, "#0000ff");
  doc.fill({ x: 1, y: 1 }, "#0000ff");   // no-op: already that colour, no state
  assert.equal(doc.pos, 2); assert.equal(doc.states.length, 3);
  doc.expand(1);
  assert.equal(doc.states.length, 4); assert.equal(doc.pos, 3); assert.equal(doc.clean, 0);   // depth 3 → up to 4 states
  doc.fill({ x: 0, y: 0 }, "#123456");
  assert.equal(doc.states.length, 4); assert.equal(doc.pos, 3);
  assert.equal(doc.clean, -1);   // the stored state fell off the end, so it stays dirty for good
  doc.undo(); doc.undo(); doc.undo();
  assert.equal(doc.pos, 0); assert.equal(doc.canUndo, false);
  assert.equal(ctx.pixel(0, 0), "#00ff00");
  doc.redo();
  assert.equal(ctx.pixel(0, 0), "#0000ff");
  const packed = packRGBA("#ff0000");
  const bytes = new Uint8ClampedArray(new Uint32Array([packed]).buffer);
  assert.deepEqual([...bytes], [255, 0, 0, 255]);
});

test("File › New character… prompts for a name, creates and opens it; delete asks first", async () => {
  await boot();
  await os.launch("roster");
  await tick();
  const p = app().newCharacter();
  await tick();
  const dlg = os.wm.all().find(x => x instanceof Dialog);
  assert.equal(dlg.title, "New character");
  const input = dlg.$("input");
  input.value = "Leorio"; d.fire(input, "input");
  d.click(dlg.$('[data-act="ok"]'));
  await p; await tick();
  assert.deepEqual(log.find(l => l.method === "POST" && l.path === "/hxh/api/db/chars").body, { name: "Leorio" });
  assert.ok(os.wm.get(winId(5))?.state.open);
  await app().openChar(3);
  await tick();
  const del = app().deleteChar(3);
  await tick();
  const ask = os.wm.all().find(x => x instanceof Dialog && x.title === "Roster DB");
  assert.match(ask.el.textContent, /Delete Gon Freecss and all its pictures\?/);
  d.click(ask.$('[data-act="cancel"]'));
  await del;
  assert.equal(log.some(l => l.method === "DELETE"), false);
  assert.ok(charWin().state.open);
});
