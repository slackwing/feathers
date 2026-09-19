import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { Sounds, CUES, SOUND_KEY, TUNES, noteFreq } from "../html/hxh/os/sound.js";

const d = setupDom();

/** A fake AudioContext that records what was scheduled. */
function fakeAC() {
  const calls = [];
  class Node { connect() { return this; } }
  class Param { constructor(name) { this.name = name; } setValueAtTime(v, t) { calls.push([this.name, "set", v, t]); } linearRampToValueAtTime(v, t) { calls.push([this.name, "lin", v, t]); } exponentialRampToValueAtTime(v, t) { calls.push([this.name, "exp", v, t]); } }
  class Osc extends Node { constructor() { super(); this.frequency = new Param("freq"); } start(t) { calls.push(["start", t]); } stop(t) { calls.push(["stop", t]); } }
  class Gain extends Node { constructor() { super(); this.gain = new Param("gain"); } }
  class AC { constructor() { this.currentTime = 10; this.state = "suspended"; this.destination = new Node(); this.resumed = 0; } resume() { this.resumed++; this.state = "running"; } createOscillator() { return new Osc(); } createGain() { const g = new Gain(); g.gain.value = 1; g.disconnect = () => {}; return g; } }
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

test("the chiptune tracker schedules notes on the audio clock and stops cleanly", async () => {
  const { AC, calls } = fakeAC();
  const s = new Sounds({ storage: d.win.localStorage, AudioContext: AC });
  s.set(true);
  assert.equal(noteFreq("A4"), 440);
  assert.ok(Math.abs(noteFreq("C#5") - 554.37) < 0.01);
  assert.ok(TUNES.beetle.channels.every(c => c.steps.trim().split(/\s+/).length === 128), "eight bars of sixteenths per channel");
  assert.equal(s.playTune("beetle"), true);
  assert.equal(s.tunePlaying, true);
  assert.ok(calls.filter(c => c[0] === "start").length >= 3, "the first steps are scheduled ahead on the audio clock");
  assert.ok(calls.some(c => c[0] === "freq" && c[1] === "set" && Math.abs(c[2] - 440) < 0.01), "the lead opens on A4");
  assert.equal(s.playTune("nope"), false);
  assert.equal(s.stopTune(), true);
  assert.equal(s.tunePlaying, false);
  assert.equal(s.stopTune(), false);
  s.set(false);
  assert.equal(s.playTune("beetle"), false);   // muted
  s.set(true);
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
