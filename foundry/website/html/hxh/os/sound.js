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

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** "A4" → 440, "C#5" → 554.37 … */
export function noteFreq(tok) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(tok);
  if (!m) return 440;
  const semi = NOTE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + (+m[3] + 1) * 12;
  return 440 * Math.pow(2, (semi - 69) / 12);
}

/* "Beetle 07" — an original cracktro loop in A minor: square lead,
   arpeggio, triangle bass. Eight bars of sixteenths. */
export const TUNES = {
  beetle: {
    bpm: 150, volume: 0.11,
    channels: [
      { wave: "square", gain: 0.35, steps: `
        A4 . A4 . C5 . E5 . A5 - - . G5 . E5 .   F5 - . E5 D5 - . C5 D5 - - - . . . .
        A4 . A4 . C5 . E5 . A5 - - . G5 . A5 .   B5 - . A5 G5 - . E5 F5 - - - . . . .
        F5 . F5 . A5 . C6 . F6 - - . E6 . C6 .   D6 - . C6 B5 - . A5 G5 - - - . . . .
        E5 . E5 . G5 . B5 . E6 - - . D6 . B5 .   C6 - . B5 A5 - - - - - - - . . . .` },
      { wave: "square", gain: 0.12, gate: 0.6, steps: `
        A3 C4 E4 A4 A3 C4 E4 A4 A3 C4 E4 A4 A3 C4 E4 A4   A3 C4 E4 A4 A3 C4 E4 A4 A3 C4 E4 A4 A3 C4 E4 A4
        A3 C4 E4 A4 A3 C4 E4 A4 A3 C4 E4 A4 A3 C4 E4 A4   E3 G#3 B3 E4 E3 G#3 B3 E4 E3 G#3 B3 E4 E3 G#3 B3 E4
        F3 A3 C4 F4 F3 A3 C4 F4 F3 A3 C4 F4 F3 A3 C4 F4   D3 F3 A3 D4 D3 F3 A3 D4 G3 B3 D4 G4 G3 B3 D4 G4
        E3 G#3 B3 E4 E3 G#3 B3 E4 E3 G#3 B3 E4 E3 G#3 B3 E4   A3 C4 E4 A4 A3 C4 E4 A4 A3 C4 E4 A4 A3 C4 E4 A4` },
      { wave: "triangle", gain: 0.6, gate: 0.8, steps: `
        A2 . . . A2 . . . E2 . . . E2 . . .   A2 . . . A2 . . . E2 . . . E2 . . .
        A2 . . . A2 . . . E2 . . . E2 . . .   E2 . . . E2 . . . E2 . . . E2 . . .
        F2 . . . F2 . . . F2 . . . F2 . . .   D2 . . . D2 . . . G2 . . . G2 . . .
        E2 . . . E2 . . . E2 . . . E2 . . .   A2 . . . A2 . . . A2 . . . A2 . . .` },
    ],
  },
};

export class Sounds {
  constructor({ storage = globalThis.localStorage, AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext } = {}) {
    this.storage = storage;
    this.AC = AudioContext;
    this.context = null;
    this.tune = null;
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

  /* ---------- tunes: a tiny chiptune tracker ----------
     A tune is channels of 16th-note steps: "A4" starts a note, "-"
     holds it, "." rests. Scheduled a little ahead on the audio clock so
     timers can be sloppy. One tune plays at a time; it loops until
     stopTune(). Original music — no MIDI transcriptions of copyrighted
     songs live here. */
  playTune(name, { loop = true } = {}) {
    const tune = TUNES[name];
    if (!tune || !this.on) return false;
    const ctx = this.ctx();
    if (!ctx) return false;
    this.stopTune();
    const step = 60 / tune.bpm / 4;                       // seconds per 16th
    const chans = tune.channels.map(c => ({ ...c, steps: c.steps.trim().split(/\s+/) }));
    const len = Math.max(...chans.map(c => c.steps.length));
    const master = ctx.createGain(); master.gain.value = tune.volume ?? 0.12; master.connect(ctx.destination);
    const state = { name, ctx, master, pos: 0, at: ctx.currentTime + 0.05, timer: null, stopped: false };
    const schedule = () => {
      if (state.stopped) return;
      const horizon = ctx.currentTime + 0.3;
      while (state.at < horizon) {
        if (state.pos >= len) { if (!loop) { this.stopTune(); return; } state.pos = 0; }
        for (const c of chans) {
          const tok = c.steps[state.pos % c.steps.length];
          if (!tok || tok === "." || tok === "-") continue;
          let held = 1;
          while (c.steps[(state.pos + held) % c.steps.length] === "-" && held < 64) held++;
          const osc = ctx.createOscillator(), g = ctx.createGain();
          osc.type = c.wave || "square";
          osc.frequency.setValueAtTime(noteFreq(tok), state.at);
          const dur = held * step * (c.gate ?? 0.9);
          g.gain.setValueAtTime(0.0001, state.at);
          g.gain.linearRampToValueAtTime(c.gain ?? 0.5, state.at + 0.005);
          g.gain.exponentialRampToValueAtTime(0.0001, state.at + dur);
          osc.connect(g); g.connect(master);
          osc.start(state.at); osc.stop(state.at + dur + 0.02);
        }
        state.pos++;
        state.at += step;
      }
      state.timer = setTimeout(schedule, 100);
      state.timer.unref?.();
    };
    this.tune = state;
    schedule();
    return true;
  }

  stopTune() {
    const t = this.tune;
    if (!t) return false;
    t.stopped = true;
    clearTimeout(t.timer);
    try { t.master.gain.setValueAtTime(0.0001, t.ctx.currentTime); t.master.disconnect(); } catch {}
    this.tune = null;
    return true;
  }

  get tunePlaying() { return !!this.tune; }

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
