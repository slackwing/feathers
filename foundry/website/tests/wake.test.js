import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { EventBus } from "../html/hxh/os/bus.js";
import { WakeWatch } from "../html/hxh/os/wake.js";

function make({ hidden = false } = {}) {
  const d = setupDom();
  let t = 1_000_000;
  Object.defineProperty(d.doc, "visibilityState", { get: () => (hidden ? "hidden" : "visible"), configurable: true });
  const bus = new EventBus(), wakes = [];
  bus.on("wake", w => wakes.push(w.reason));
  const ww = new WakeWatch({ win: d.win, bus, now: () => t }).start();
  return { d, ww, wakes, tick: ms => { t += ms; }, setHidden: h => { hidden = h; } };
}

test("visible, online and focus each wake, debounced", () => {
  const { d, ww, wakes, tick } = make();
  d.fire(d.doc, "visibilitychange");
  d.fire(d.win, "online");          // 0 ms later: swallowed
  assert.deepEqual(wakes, ["visible"]);
  tick(2500);
  d.fire(d.win, "online");
  tick(2500);
  d.fire(d.win, "focus");
  assert.deepEqual(wakes, ["visible", "online", "focus"]);
  ww.stop();
  tick(2500);
  d.fire(d.win, "focus");
  assert.equal(wakes.length, 3);
});

test("a heartbeat that arrives far too late means the machine slept — unless the tab was merely hidden", () => {
  const { ww, wakes, tick, setHidden } = make();
  tick(15000); ww.tick();           // on time
  tick(30000); ww.tick();           // slow, within the gap
  assert.deepEqual(wakes, []);
  tick(8 * 3600 * 1000); ww.tick(); // eight hours late: asleep
  assert.deepEqual(wakes, ["sleep"]);
  setHidden(true);
  tick(60000); ww.tick();           // a hidden tab's timers run once a minute: not a sleep
  assert.deepEqual(wakes, ["sleep"]);
  setHidden(false);
  tick(60000); ww.tick();           // visible again and the gap is real
  assert.deepEqual(wakes, ["sleep", "sleep"]);
  ww.stop();
});

test("a hidden tab does not wake on visibilitychange until it is visible", () => {
  const { d, wakes, ww } = make({ hidden: true });
  d.fire(d.doc, "visibilitychange");
  assert.deepEqual(wakes, []);
  ww.stop();
});
