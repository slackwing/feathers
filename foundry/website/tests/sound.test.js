import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { Sounds, CUES, SOUND_KEY } from "../html/hxh/os/sound.js";

const d = setupDom();

/** A fake AudioContext that records what was scheduled. */
function fakeAC() {
  const calls = [];
  class Node { connect() { return this; } }
  class Param { constructor(name) { this.name = name; } setValueAtTime(v, t) { calls.push([this.name, "set", v, t]); } linearRampToValueAtTime(v, t) { calls.push([this.name, "lin", v, t]); } exponentialRampToValueAtTime(v, t) { calls.push([this.name, "exp", v, t]); } }
  class Osc extends Node { constructor() { super(); this.frequency = new Param("freq"); } start(t) { calls.push(["start", t]); } stop(t) { calls.push(["stop", t]); } }
  class Gain extends Node { constructor() { super(); this.gain = new Param("gain"); } }
  class AC { constructor() { this.currentTime = 10; this.state = "suspended"; this.destination = new Node(); this.resumed = 0; } resume() { this.resumed++; this.state = "running"; } createOscillator() { return new Osc(); } createGain() { return new Gain(); } }
  return { AC, calls };
}

test("plays cues on a lazily created, resumed context", () => {
  const { AC, calls } = fakeAC();
  const s = new Sounds({ storage: d.win.localStorage, AudioContext: AC });
  assert.equal(s.context, null);
  assert.equal(s.play("message"), true);
  assert.equal(s.context.resumed, 1);
  assert.equal(calls.filter(c => c[0] === "start").length, CUES.message.length);
  assert.ok(calls.some(c => c[0] === "freq" && c[1] === "set" && c[2] === 880));
  assert.equal(s.play("dooropen"), true);
  assert.ok(calls.some(c => c[0] === "freq" && c[1] === "lin" && c[2] === 520), "door open glides up");
  assert.deepEqual(s.played, ["message", "dooropen"]);
  assert.equal(s.play("nope"), false);
});

test("mute is remembered; no AudioContext means silence, not errors", () => {
  const { AC } = fakeAC();
  const s = new Sounds({ storage: d.win.localStorage, AudioContext: AC });
  assert.equal(s.on, true);
  assert.equal(s.toggle(), false);
  assert.equal(d.win.localStorage.getItem(SOUND_KEY), "0");
  assert.equal(s.play("message"), false);
  assert.equal(new Sounds({ storage: d.win.localStorage, AudioContext: AC }).on, false);
  s.set(true);
  const mute = new Sounds({ storage: d.win.localStorage, AudioContext: undefined });
  assert.equal(mute.play("message"), false);
});
