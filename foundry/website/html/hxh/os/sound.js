/* Sounds — the classic messenger cues, synthesised with WebAudio (no
   samples, nothing copyrighted): a message blip, a "sent" tick, and the
   door opening / closing when someone comes online / goes away. Muted
   per browser via localStorage hxh.sound. The AudioContext is created
   lazily and resumed on use, since browsers only allow audio after a
   user gesture. */
export const SOUND_KEY = "hxh.sound";

/* name → [[freq, startOffset, duration, glideToFreq?, type?], …] */
export const CUES = {
  message:   [[880, 0, 0.07, null, "sine"], [1320, 0.09, 0.09, null, "sine"]],
  sent:      [[1000, 0, 0.04, null, "sine"]],
  dooropen:  [[220, 0, 0.28, 520, "triangle"]],
  doorclose: [[520, 0, 0.28, 220, "triangle"]],
};

export class Sounds {
  constructor({ storage = globalThis.localStorage, AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext } = {}) {
    this.storage = storage;
    this.AC = AudioContext;
    this.context = null;
    this.played = [];   // names played, for tests and debugging
  }

  get on() {
    try { return this.storage?.getItem(SOUND_KEY) !== "0"; } catch { return true; }
  }
  set(on) {
    try { this.storage?.setItem(SOUND_KEY, on ? "1" : "0"); } catch {}
    return !!on;
  }
  toggle() { return this.set(!this.on); }

  ctx() {
    if (!this.AC) return null;
    if (!this.context) { try { this.context = new this.AC(); } catch { return null; } }
    if (this.context.state === "suspended") this.context.resume?.();
    return this.context;
  }

  /** Play a cue; returns false when muted or audio is unavailable. */
  play(name) {
    const cue = CUES[name];
    if (!cue || !this.on) return false;
    const ctx = this.ctx();
    if (!ctx) return false;
    const t0 = ctx.currentTime;
    for (const [freq, at, dur, glide, type] of cue) {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freq, t0 + at);
      if (glide) osc.frequency.linearRampToValueAtTime(glide, t0 + at + dur);
      gain.gain.setValueAtTime(0.0001, t0 + at);
      gain.gain.linearRampToValueAtTime(0.18, t0 + at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t0 + at); osc.stop(t0 + at + dur + 0.02);
    }
    this.played.push(name);
    return true;
  }
}
