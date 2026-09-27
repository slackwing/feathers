import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom, fakeFetch, tick } from "./dom.js";
import { OS } from "../html/hxh/os/os.js";
import { BugReportApp, bugContext, BUGS_API } from "../html/hxh/apps/bugs/app.js";
import { hasIconPair } from "../html/hxh/os/icons.js";

const d = setupDom();
const ADMIN = { username: "andrew", display_name: "Andrew", initial: "AC", color: "#d914e3", roles: [{ website: "hxh", role: "admin" }] };
const GUEST = { username: "gon", display_name: "Gon", initial: "GF", color: "#2fb54a", roles: [{ website: "hxh", role: "guest" }] };

function make(me, extra = {}) {
  const log = [], db = { reports: [], pending: 2 };
  const routes = {
    "GET /admin/api/me": [200, me],
    "POST /hxh/api/chat/image": [200, { id: 41, width: 10, height: 8 }],
    [`POST ${BUGS_API}`]: init => { const b = JSON.parse(init.body); const rep = { id: 7, reporter: me.username, status: "pending", created_at: new Date().toISOString(), ...b }; db.reports.unshift(rep); db.pending++; return [200, rep]; },
    [`GET ${BUGS_API}/count`]: () => [200, { pending: db.pending }],
    [`GET ${BUGS_API}?status=pending`]: () => [200, db.reports.filter(r => r.status === "pending")],
    [`GET ${BUGS_API}?status=resolved`]: () => [200, db.reports.filter(r => r.status === "resolved")],
    [`POST ${BUGS_API}/7/status`]: init => { const { status } = JSON.parse(init.body); db.reports.forEach(r => { if (r.id === 7) r.status = status; }); db.pending += status === "resolved" ? -1 : 1; return [200, db.reports[0]]; },
    ...extra,
  };
  const fetch = fakeFetch(routes, log);
  const timers = [];
  const os = new OS({ win: d.win, fetch, env: { reduced: true, floating: () => true, zoom: () => 1, width: 1366, height: 900, wait: () => Promise.resolve() } });
  return { os, log, db, timers, options: { fetch, setInterval: (f, ms) => { timers.push({ f, ms }); return timers.length; } } };
}

test("Report a Bug: an app for everyone, with a 16×16 bug icon; the window is BeetleChat's compose box — Paste, Image, Emoji, the field, Send (Andrew, 2026-09-27)", async () => {
  const { os, options } = make(GUEST);
  await os.start({ apps: [[BugReportApp, options]], start: true });
  assert.ok(hasIconPair("tools"), "a hammer and wrench, not a bug (too like BeetleChat, Andrew 2026-09-27)");
  assert.equal(BugReportApp.icon, "tools");
  assert.ok(os.startItems().some(i => i.label === "Report a Bug"));
  await os.launch("bugs");
  const w = os.wm.get("win-bugs");
  assert.ok(w.state.open);
  for (const act of ["clip", "pic", "emoji", "send"]) assert.ok(w.el.querySelector(`.compose [data-act="${act}"]`), act);
  assert.equal(w.el.querySelector(".compose textarea").placeholder, "What went wrong?");
  assert.equal(os.taskbar.tray.has("bugs"), false, "no tray alert for a member who is not an admin");
});

test("sending a report posts the text, the attached picture's id and a snapshot of the screen; the box empties, the window closes, a toast thanks them", async () => {
  const { os, log, options } = make(GUEST);
  await os.start({ apps: [[BugReportApp, options]], start: true });
  const app = os.registry.get("bugs");
  await os.launch("bugs");
  await app.attach(new d.win.Blob(["x"], { type: "image/png" }));
  assert.equal(app.composer.image.id, 41, "the uploaded picture is attached, as in chat");
  app.composer.input.value = "  the binder shrank on the iPad  ";
  app.composer.submit();
  await tick(5);
  const sent = log.find(l => l.method === "POST" && l.path === BUGS_API);
  assert.equal(sent.body.body, "the binder shrank on the iPad");
  assert.equal(sent.body.image_id, 41);
  for (const k of ["url", "ua", "viewport", "zoom", "theme", "sky", "windows", "at"]) assert.ok(k in sent.body.context, "context has " + k);
  assert.equal(app.composer.input.value, "");
  assert.equal(os.wm.get("win-bugs").state.open, false, "the window closes");
  assert.match(os.toast.body.textContent, /Thanks/);
});

test("a report the server refuses keeps what they wrote and says why", async () => {
  const { os, options } = make(GUEST, { [`POST ${BUGS_API}`]: [400, { error: "say what went wrong, or attach a picture" }] });
  await os.start({ apps: [[BugReportApp, options]], start: true });
  const app = os.registry.get("bugs");
  await os.launch("bugs");
  assert.equal(await app.submit({ body: "it broke", image: null }), false);
  assert.equal(app.composer.input.value, "it broke");
  assert.ok(os.wm.get("win-bugs").state.open);
  assert.match(os.toast.body.textContent, /say what went wrong/);
});

test("admins: a tray bug with a red count of pending reports, lit while any wait, re-read every minute; it opens the list, where Resolve and Reopen work and the count follows", async () => {
  const { os, db, timers, options } = make(ADMIN);
  await os.start({ apps: [[BugReportApp, options]], start: true });
  const app = os.registry.get("bugs");
  await tick(5);
  assert.ok(os.taskbar.tray.has("bugs"), "the admin has the tray alert");
  const icon = os.taskbar.tray.get("bugs");
  icon.refresh();
  assert.equal(icon.badgeEl.hidden, false);
  assert.equal(icon.badgeEl.textContent, "2");
  assert.ok(icon.btn.classList.contains("on"));
  assert.match(icon.btn.title, /2 pending/);
  assert.equal(timers[0].ms, 60000, "re-read every minute");
  db.reports.push({ id: 7, reporter: "gon", body: "the binder shrank", image_id: 41, status: "pending", created_at: new Date().toISOString(), context: { viewport: [820, 1180] }, note: "" });
  icon.press();
  await tick(5);
  const list = os.wm.get("win-bug-list");
  assert.ok(list.state.open);
  const row = list.el.querySelector('.breport[data-id="7"]');
  assert.match(row.textContent, /the binder shrank/);
  assert.ok(row.querySelector(".bpic img").getAttribute("src").endsWith("/image/41"));
  assert.match(row.querySelector(".bctx pre").textContent, /820/);
  row.querySelector('[data-act="resolve"]').click();
  await tick(5);
  assert.equal(db.reports[0].status, "resolved");
  assert.equal(list.el.querySelectorAll(".breport").length, 0, "gone from Pending");
  await app.poll(); icon.refresh();
  assert.equal(icon.badgeEl.textContent, "1", "the count follows");
  list.el.querySelector('[data-filter="resolved"]').click();
  await tick(5);
  list.el.querySelector('.breport[data-id="7"] [data-act="reopen"]').click();
  await tick(5);
  assert.equal(db.reports[0].status, "pending");
  db.pending = 0; await app.poll(); icon.refresh();
  assert.equal(icon.badgeEl.hidden, true, "no count at zero");
  assert.equal(icon.btn.classList.contains("on"), false, "dimmed when nothing waits");
});

test("bugContext: the screen's state, nothing more", () => {
  const ctx = bugContext({ win: d.win, doc: document, env: { zoom: () => 0.9 }, theme: "seapumpkin", sky: "hypergradient", wm: { appWindows: () => [{ id: "win-binder", state: { open: true, minimized: true } }, { id: "win-x", state: { open: false } }] } });
  assert.deepEqual(ctx.windows, ["win-binder (min)"]);
  assert.equal(ctx.zoom, 0.9);
  assert.equal(ctx.theme, "seapumpkin");
  assert.ok(Array.isArray(ctx.viewport) && ctx.at);
});
