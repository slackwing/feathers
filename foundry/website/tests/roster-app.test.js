import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupDom, fakeFetch, tick } from "./dom.js";
import { OS } from "../html/hxh/os/os.js";
import { RosterApp, RosterWindow, CharacterWindow, CropWindow, winId, cropId } from "../html/hxh/apps/roster/app.js";
import { Dialog } from "../html/hxh/apps/roster/dialogs.js";

const ADMIN = { username: "andrew", display_name: "Andrew", initial: "AC", color: "#d914e3", roles: [{ website: "hxh", role: "admin" }] };
const GUEST = { username: "abi", display_name: "Abi", initial: "AG", color: "#349db2", roles: [{ website: "hxh", role: "guest" }] };
const IMG = (id, type, extra = {}) => ({ id, char_id: 3, type, source_image_id: null, mime: "image/png", width: 1920, height: 1080, bytes: 100000, sha256: "x", source_url: "", caption: "cap " + id, status: "kept", created_by: "andrew", created_at: "2026-09-19T00:00:00Z", ...extra });
const gon = () => ({ id: 3, name: "Gon Freecss", name_ja: "ゴン＝フリークス", first: "Gon", rank: "S", nen_types: ["enhancement"], affiliation: "Hunter Association",
  arcs: ["hunter-exam", "greed-island"], arms: ["fishing-rod"], description: "A boy.", notes: "n", version: 4, review_status: "pending", review_reason: "",
  avatar_image_id: null, card_image_id: null, created_by: "roster", created_at: "2026-09-19T00:00:00Z", updated_at: "2026-09-19T00:00:00Z", image_count: 2,
  images: [IMG(11, "cropped", { source_image_id: 10, width: 500, height: 500 }), IMG(10, "raw")], reviews: [{ id: 1, char_id: 3, version: 2, status: "rejected", reason: "wrong Nen", reviewer: "andrew", created_at: "2026-09-18T00:00:00Z" }] });
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
    "POST /hxh/api/db/chars/3/review": init => { const body = JSON.parse(init.body); if (body.status === "rejected" && !body.reason) return [400, { error: "a rejection needs a reason" }];
      state.gon = { ...state.gon, review_status: body.status, review_reason: body.reason, reviews: [{ id: 9, char_id: 3, version: state.gon.version, status: body.status, reason: body.reason, reviewer: "andrew", created_at: "2026-09-19T01:00:00Z" }, ...state.gon.reviews] }; return [200, state.gon]; },
    "POST /hxh/api/db/chars": init => [201, { ...killua(), id: 5, name: JSON.parse(init.body).name }],
    "GET /hxh/api/db/chars/5": () => [200, { ...killua(), id: 5, name: "Leorio" }],
    "DELETE /hxh/api/db/chars/3": [204, null],
    "PATCH /hxh/api/db/images/10": init => { const b = JSON.parse(init.body); state.gon.images[1] = { ...state.gon.images[1], ...b }; return [200, state.gon.images[1]]; },
    "DELETE /hxh/api/db/images/10": () => { state.gon.images = state.gon.images.filter(i => i.id !== 10); return [204, null]; },
    "GET /hxh/api/db/images/10/meta": () => [200, { image: IMG(10, "raw"), char: { id: 3, name: "Gon Freecss" } }],
    "POST /hxh/api/db/images/10/crop": init => { const r = JSON.parse(init.body); const im = IMG(12, "cropped", { source_image_id: 10, width: r.w, height: r.h }); state.gon.images.unshift(im); return [201, { image: im, created: true }]; },
  };
  os = new OS({ win: d.win, fetch: fakeFetch(api, log), env: { reduced: true, floating: () => true, zoom: () => 1, width: 1366, height: 900, wait: () => Promise.resolve() } });
  await os.start({ apps: [RosterApp], boot: false, start: true });
}
const app = () => os.registry.get("roster");
const charWin = () => os.wm.get(winId(3));

test("only hxh admins see the app", async () => {
  await boot(GUEST);
  assert.ok(!os.desktop.icons.get("roster"));
  assert.equal(app().visible(GUEST), false);
  await boot(ADMIN);
  assert.ok(os.desktop.icons.get("roster"));
  assert.equal(app().name, "Roster DB");
});

test("launch opens the list with pending rows, View filters, Enter opens a character", async () => {
  await boot();
  await os.launch("roster");
  await tick();
  const w = os.wm.get("win-roster");
  assert.ok(w instanceof RosterWindow && w.state.open);
  assert.deepEqual([...w.rows.querySelectorAll(".row .c-name")].map(e => e.textContent), ["Gon Freecss"]);   // Killua is accepted
  assert.equal(w.countEl.textContent, "2 characters · 1 pending");
  w.setFilter("");
  assert.equal(w.rows.querySelectorAll(".row").length, 2);
  assert.equal(w.rows.querySelector(".row .c-ver").textContent, "v4");
  assert.equal(w.rows.querySelector(".row .verdict").textContent, "Pending");
  const view = w.menuBar.menus[1];
  const items = view.itemsNow();
  assert.deepEqual(items.filter(i => i !== "sep").map(i => i.label), ["Pending", "Accepted", "Rejected", "All", "Refresh"]);
  assert.equal(items[3].check(), true);
  w.select(3);
  d.key(w.rows, "Enter");
  await tick();
  assert.ok(charWin() instanceof CharacterWindow && charWin().state.open);
  assert.equal(charWin().title, "#3 Gon Freecss");
});

test("the character window shows the profile, review box and gallery; a field change PATCHes and bumps the version", async () => {
  await boot();
  await app().openChar(3);
  await tick();
  const w = charWin(), el = w.el;
  assert.equal(el.querySelector('[data-f="name_ja"]').value, "ゴン＝フリークス");
  assert.equal(el.querySelector('[data-nen="0"]').value, "enhancement");
  assert.equal(el.querySelector('[data-arc="greed-island"]').checked, true);
  assert.equal(el.querySelector('[data-arc="chimera-ant"]').checked, false);
  assert.equal(el.querySelector('[data-f="arms"]').value, "fishing-rod");
  assert.equal(el.querySelector(".verdict .st").textContent, "Pending");
  assert.equal(el.querySelector(".verdict .ver").textContent, "v4");
  assert.equal(el.querySelector('[data-review="pending"]').disabled, true);
  assert.match(el.querySelector(".log").textContent, /v2 rejected andrew — wrong Nen/);
  assert.deepEqual([...el.querySelectorAll(".sec")].map(s => s.dataset.type), ["raw", "cropped"]);
  assert.equal(el.querySelectorAll(".tile").length, 2);
  const first = el.querySelector('[data-f="first"]');
  first.value = "Gonny";
  d.fire(first, "change");
  await tick();
  assert.deepEqual(log.filter(l => l.method === "PATCH").map(l => l.body), [{ first: "Gonny" }]);
  assert.equal(el.querySelector(".verdict .ver").textContent, "v5");
  assert.equal(w.msgEl.textContent, "Saved");
  const arc = el.querySelector('[data-arc="chimera-ant"]');
  arc.checked = true; d.fire(arc, "change");
  await tick();
  assert.deepEqual(log.at(-1).body, { arcs: ["hunter-exam", "greed-island", "chimera-ant"] });
});

test("selecting a tile enables the toolbar; Avatar sets the slot; Reject is for raws only", async () => {
  await boot();
  await app().openChar(3);
  await tick();
  const w = charWin(), el = w.el;
  assert.equal(el.querySelector('[data-img="avatar"]').disabled, true);
  d.click(el.querySelector('.tile[data-id="11"]'));
  assert.equal(el.querySelector('[data-img="avatar"]').disabled, false);
  assert.equal(el.querySelector('[data-img="reject"]').disabled, true);   // a crop cannot be rejected, only deleted
  assert.match(w.selEl.textContent, /#11 · cropped · 500×500/);
  d.click(el.querySelector('[data-img="avatar"]'));
  await tick();
  assert.deepEqual(log.at(-1).body, { avatar_image_id: 11 });
  assert.ok(el.querySelector(".slot.av.set img"));
  assert.equal(el.querySelector('.tile[data-id="11"] .role').textContent, "avatar");
  d.click(el.querySelector('.tile[data-id="10"]'));
  assert.equal(el.querySelector('[data-img="reject"]').disabled, false);
  d.click(el.querySelector('[data-img="reject"]'));
  await tick();
  assert.deepEqual(log.find(l => l.method === "PATCH" && l.path === "/hxh/api/db/images/10").body, { status: "rejected" });
  assert.equal(el.querySelectorAll('.sec[data-type="raw"] .tile').length, 0);   // hidden until "Rejected" is ticked
  const show = el.querySelector("[data-show-rejected]");
  show.checked = true; d.fire(show, "change");
  assert.ok(el.querySelector('.tile[data-id="10"].rejected'));
});

test("Reject… asks for a reason in a dialog and logs the verdict; Accept needs none", async () => {
  await boot();
  await app().openChar(3);
  await tick();
  const w = charWin();
  d.click(w.el.querySelector('[data-review="rejected"]'));
  await tick();
  const dlg = os.wm.all().find(x => x instanceof Dialog);
  assert.ok(dlg && dlg.state.open && dlg.title === "Reject");
  assert.equal(dlg.$('[data-act="ok"]').disabled, true);
  const ta = dlg.$("textarea");
  ta.value = "picture 10 is a group shot"; d.fire(ta, "input");
  assert.equal(dlg.$('[data-act="ok"]').disabled, false);
  d.click(dlg.$('[data-act="ok"]'));
  await tick(); await tick();
  assert.deepEqual(log.at(-1).body, { status: "rejected", reason: "picture 10 is a group shot" });
  assert.equal(w.el.querySelector(".verdict .st").textContent, "Rejected");
  assert.equal(w.el.querySelector(".reason").textContent, "picture 10 is a group shot");
  assert.match(w.el.querySelector(".log").textContent, /v4 rejected andrew — picture 10/);
  assert.ok(!os.wm.has(dlg.id));
  d.click(w.el.querySelector('[data-review="accepted"]'));
  await tick();
  assert.deepEqual(log.at(-1).body, { status: "accepted", reason: "" });
  assert.equal(w.el.querySelector(".verdict .st").textContent, "Accepted");
});

test("double-clicking a tile opens a crop window sized to the desktop; a drawn box saves through the API and the gallery refreshes", async () => {
  await boot();
  await app().openChar(3);
  await tick();
  const w = charWin();
  w.el.querySelector('.tile[data-id="10"]').dispatchEvent(new d.win.MouseEvent("dblclick", { bubbles: true }));
  await tick();
  const c = os.wm.get(cropId(10));
  assert.ok(c instanceof CropWindow && c.state.open);
  assert.equal(c.title, "Crop #10 — Gon Freecss");
  assert.equal(c.fit, true);
  assert.equal(c.canvas.style.width, "1049px");   // 1920×1080 fitted into 1276×590 → 590/1080 zoom
  assert.equal(c.canvas.style.height, "590px");
  assert.equal(c.pic.width, 1920);   // the picture lives on a canvas at native size
  assert.equal(c.saveBtn.disabled, true);
  assert.equal(c.tool, "marquee");
  c.setRatio(1);
  c.setBox({ x: 100, y: 100, w: 400, h: 400 });
  assert.equal(c.posEl.textContent, "100, 100  ·  400 × 400");
  assert.equal(c.saveBtn.disabled, false);
  c.setRatio(2 / 3);
  assert.equal(c.posEl.textContent, "167, 100  ·  267 × 400");   // refit around the centre
  c.setFit(false);
  assert.equal(c.z, 1);
  assert.equal(c.wrap.style.width, "1920px");
  d.click(c.saveBtn);
  await tick(); await tick();
  assert.deepEqual(log.find(l => l.method === "POST" && l.path === "/hxh/api/db/images/10/crop").body, { x: 167, y: 100, w: 267, h: 400 });
  assert.equal(c.savedEl.textContent, "Saved #12 267×400");
  assert.equal(w.el.querySelectorAll('.sec[data-type="cropped"] .tile').length, 2);
});

/* a 2D context jsdom does not have: records strokes, answers a fixed pixel */
function fakeCtx() {
  const calls = [];
  return { calls,
    drawImage: (...a) => calls.push(["drawImage", a.length]), getImageData: () => ({ data: new Uint8ClampedArray([200, 16, 46, 255]), width: 1, height: 1 }),
    putImageData: () => calls.push(["putImageData"]), clearRect: () => calls.push(["clearRect"]),
    beginPath: () => {}, arc: () => calls.push(["arc"]), fill: () => {}, moveTo: () => {}, lineTo: (x, y) => calls.push(["lineTo", x, y]), stroke: () => {} };
}

test("paint: brush strokes mark the picture painted with undo / redo / revert; the eyedropper picks a colour; a painted save uploads the pixels", async () => {
  await boot();
  const ctx = fakeCtx();
  d.win.HTMLCanvasElement.prototype.getContext = () => ctx;
  await app().openChar(3);
  await tick();
  await app().openCrop(10);
  await tick();
  const c = os.wm.get(cropId(10));
  c.source = {};   // as if the picture had loaded
  const el = c.el;
  assert.deepEqual([...el.querySelectorAll("button[data-tool]")].map(b => b.dataset.tool), ["marquee", "brush", "dropper"]);
  assert.equal(el.querySelectorAll(".palette [data-color]").length, 16);
  d.click(el.querySelector('[data-tool="brush"]'));
  assert.equal(c.tool, "brush");
  assert.equal(c.wrap.dataset.tool, "brush");
  d.click(el.querySelector('.palette [data-color="#ff0000"]'));
  assert.equal(c.color, "#ff0000");
  assert.equal(el.querySelector(".swatch input").value, "#ff0000");
  c.setRadius(20);
  assert.equal(el.querySelector(".rv").textContent, "20");
  assert.equal(c.cursorEl.style.width, (40 * c.z) + "px");
  // a stroke: down, move, up — in wrap coordinates (zoomed), so pointer 100,100 is picture 100/z
  const ev = (type, x, y) => c.wrap.dispatchEvent(new d.win.PointerEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }));
  c.wrap.getBoundingClientRect = () => ({ left: 0, top: 0 });
  ev("pointerdown", 100, 100); ev("pointermove", 200, 150); ev("pointerup", 200, 150);
  assert.equal(c.dirty, true);
  assert.equal(c.undoStack.length, 1);
  assert.ok(ctx.calls.some(k => k[0] === "arc"), "a dot at the start");
  const line = ctx.calls.find(k => k[0] === "lineTo");
  assert.ok(line && Math.abs(line[1] - 200 / c.z) < 0.01, `line in picture pixels: ${JSON.stringify(line)}`);
  assert.equal(el.querySelector('[data-act="undo"]').disabled, false);
  assert.equal(el.querySelector('[data-act="revert"]').disabled, false);
  assert.equal(c.saveBtn.disabled, false);   // painted: the whole picture can be saved without a box
  assert.equal(c.posEl.textContent, "painted");
  c.undo();
  assert.equal(c.dirty, false);
  assert.equal(c.redoStack.length, 1);
  assert.equal(el.querySelector('[data-act="redo"]').disabled, false);
  c.redo();
  assert.equal(c.dirty, true);
  c.revert();
  assert.equal(c.dirty, false);
  assert.equal(c.undoStack.length, 2);   // the revert itself can be undone
  assert.ok(ctx.calls.some(k => k[0] === "clearRect"));
  // eyedropper: picks the pixel's colour, then hands back to the brush
  d.click(el.querySelector('[data-tool="dropper"]'));
  ev("pointerdown", 10, 10); ev("pointerup", 10, 10);
  assert.equal(c.color, "#c8102e");
  assert.equal(c.tool, "brush");
  // paint again, box it, save: the pixels go up as a cropped picture, not through the server crop
  ev("pointerdown", 50, 50); ev("pointerup", 50, 50);
  c.setTool("marquee");
  c.setBox({ x: 10, y: 20, w: 300, h: 200 });
  const uploads = [];
  app().api.upload = async (id, blob, opts) => { uploads.push({ id, blob, opts }); return { image: IMG(13, "cropped", { source_image_id: 10, width: 300, height: 200 }), created: true }; };
  c.exportPNG = async rect => ({ rect, type: "image/png" });
  d.click(c.saveBtn);
  await tick(); await tick(); await tick();
  assert.equal(uploads.length, 1);
  assert.deepEqual(uploads[0].blob.rect, { x: 10, y: 20, w: 300, h: 200 });
  assert.deepEqual(uploads[0].opts, { type: "cropped", source_image_id: 10, caption: "cap 10", name: "paint-10.png" });
  assert.equal(log.some(l => l.path.endsWith("/crop")), false);
  assert.equal(c.savedEl.textContent, "Saved #13 300×200");
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
