import { test } from "node:test";
import assert from "node:assert/strict";
import { Live } from "../html/hxh/os/live.js";

/* A fake clock: setInterval registers, tick() fires every registered job. */
function clock() {
  const timers = new Map(); let n = 0;
  return { timers, setInterval: (fn, ms) => { timers.set(++n, { fn, ms }); return n; }, clearInterval: id => timers.delete(id), tick() { for (const t of [...timers.values()]) t.fn(); } };
}
const fakeDoc = () => { const ls = {}; return { hidden: false, addEventListener: (ev, fn) => { ls[ev] = fn; }, fire: ev => ls[ev]?.() }; };

test("Live runs a job on its clock only while the window is open and the page is visible; a returning page wakes it; stop removes it", () => {
  const c = clock(), doc = fakeDoc(), live = new Live({ doc, setInterval: c.setInterval, clearInterval: c.clearInterval });
  const win = { state: { open: true } };
  let runs = 0;
  const stop = live.every(win, 5000, () => { runs++; });
  assert.equal(c.timers.get(1).ms, 5000);
  c.tick(); assert.equal(runs, 1);
  win.state.open = false; c.tick(); assert.equal(runs, 1, "closed window: no refresh");
  win.state.open = true; doc.hidden = true; c.tick(); assert.equal(runs, 1, "hidden page: no refresh");
  doc.hidden = false; doc.fire("visibilitychange"); assert.equal(runs, 2, "the page came back: refresh at once");
  live.wake(); assert.equal(runs, 3);
  stop(); c.tick(); assert.equal(runs, 3, "stopped");
  assert.equal(c.timers.size, 0);
});

test("a refresh that throws or rejects does not stop the clock", async () => {
  const c = clock(), live = new Live({ doc: fakeDoc(), setInterval: c.setInterval, clearInterval: c.clearInterval });
  const win = { state: { open: true } };
  let n = 0;
  live.every(win, 1000, () => { n++; if (n === 1) throw new Error("boom"); return Promise.reject(new Error("later")); });
  c.tick(); c.tick();
  await new Promise(r => setTimeout(r, 0));
  assert.equal(n, 2);
});
