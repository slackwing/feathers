import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom, fakeFetch, tick } from "./dom.js";
import { LogonDialog } from "../html/hxh/os/logon.js";
import { Session } from "../html/hxh/os/session.js";

const d = setupDom();

function dialog(routes, log) {
  const session = new Session({ fetch: fakeFetch(routes, log) });
  return new LogonDialog({ session }).mount(document.body);
}

test("a static, unclosable, untasked dialog with the logotype and the forgot link", () => {
  const dlg = dialog({});
  assert.equal(dlg.id, "win-logon");
  assert.equal(dlg.title, "Hunter × Halloween — Log in");
  assert.ok(dlg.static && !dlg.hasTask);
  assert.equal(dlg.el.querySelectorAll(".tbtn").length, 0);
  assert.ok(dlg.el.classList.contains("logon"));
  assert.match(dlg.el.querySelector(".logo").textContent, /HUNTER×HALLOWEEN/);
  assert.equal(dlg.el.querySelector("#lg-forgot").textContent, "Forgot password?");
  dlg.focusUser();
  assert.equal(document.activeElement, dlg.el.querySelector("#lg-u"));
  dlg.unmount();
});

test("submit logs in and emits the account; a bad password shows the committee's line", async () => {
  const log = [];
  const dlg = dialog({ "POST /admin/api/login": init => JSON.parse(init.body).password === "ok" ? [200, { username: "andrew" }] : [401, {}] }, log);
  let me = null;
  dlg.on("login", m => { me = m; });
  dlg.el.querySelector("#lg-u").value = " andrew ";
  dlg.el.querySelector("#lg-p").value = "bad";
  d.fire(dlg.el.querySelector("#logon-form"), "submit");
  await tick();
  assert.equal(me, null);
  assert.equal(dlg.el.querySelector("#lg-msg").textContent, "The committee does not recognize you.");
  dlg.el.querySelector("#lg-p").value = "ok";
  d.fire(dlg.el.querySelector("#logon-form"), "submit");
  await tick();
  assert.deepEqual(me, { username: "andrew" });
  assert.deepEqual(log.at(-1).body, { username: "andrew", password: "ok" });
  dlg.unmount();
});

test("forgot needs a username, then posts it and says a link is on its way", async () => {
  const log = [];
  const dlg = dialog({}, log);
  const msg = dlg.el.querySelector("#lg-msg");
  d.click(dlg.el.querySelector("#lg-forgot"));
  await tick();
  assert.equal(msg.textContent, "Type your applicant name first.");
  assert.equal(log.length, 0);
  dlg.el.querySelector("#lg-u").value = "abi";
  d.click(dlg.el.querySelector("#lg-forgot"));
  await tick();
  assert.equal(log[0].path, "/admin/api/forgot");
  assert.ok(msg.classList.contains("ok"));
  assert.match(msg.textContent, /reset link is on its way/);
  dlg.unmount();
});
