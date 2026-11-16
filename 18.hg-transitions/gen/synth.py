"""Deterministic renderers: tuned drone, tempo-locked pulse, noise riser. numpy + scipy only."""
import numpy as np
from scipy.signal import butter, sosfilt, sosfilt_zi
from plans import PRE, DUR, FADE_IN
SR = 48000
NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]
def hz(note):
    n, octv = note[:-1], int(note[-1]); return 440*2**((NAMES.index(n) + 12*(octv+1) - 69)/12)
T = np.arange(int(SR*DUR))/SR
def env(points):  # times relative to gap start -> absolute
    xs, ys = zip(*points); return np.interp(T, [x + PRE for x in xs], ys)
def crescendo(fade_in=FADE_IN, tail=1.2):
    f = np.where(T < fade_in, np.sin(0.5*np.pi*np.clip(T/fade_in, 0, 1))**2, 1.0)
    return f*np.interp(T, [DUR-tail, DUR], [1, 0])
def reverb(x, seconds=2.2, decay=0.45, wet=0.4, seed=7):
    rng = np.random.default_rng(seed); n = int(seconds*SR)
    ir = rng.standard_normal(n)*np.exp(-np.arange(n)/(decay*SR)); ir /= np.abs(ir).sum()**0.5*8
    def conv(a, h):
        m = 1 << (len(a)+len(h)-1).bit_length()
        return np.fft.irfft(np.fft.rfft(a, m)*np.fft.rfft(h, m), m)[:len(a)]
    return (1-wet)*x + wet*np.stack([conv(x[0], ir), conv(x[1], ir[::-1]*0.9 + ir*0.1)])
def voice(freq, amp, bright=1.0, detune=0.004, seed=0):
    rng = np.random.default_rng(seed); o = np.zeros((2, len(T)))
    for ch, d in enumerate((1-detune/2, 1+detune/2)):
        f = freq*d*(1 + 0.0015*np.sin(2*np.pi*0.11*T + rng.uniform(0, 6)))
        ph = 2*np.pi*np.cumsum(f)/SR
        tilt = 1.6 - 0.5*bright*np.sin(2*np.pi*0.045*T + rng.uniform(0, 6))
        sig = np.zeros(len(T))
        for n in range(1, 40):
            if freq*n > 6000: break
            sig += np.sin(n*ph + rng.uniform(0, 6)) / n**tilt
        o[ch] = sig
    return o*amp
def normalize(x, peak=0.5): return x*peak/max(np.abs(x).max(), 1e-9)

def drone(plan):
    mix = sum(voice(hz(n), env(e), seed=i+1) for i, (n, e) in enumerate(plan["voices"]))
    return normalize(reverb(mix)*crescendo())

def pluck(freq, t0, dur=1.2, amp=0.3, seed=0):
    i0 = int(t0*SR); n = min(int(dur*SR), len(T)-i0)
    if n <= 0: return None
    tt = np.arange(n)/SR; e = np.exp(-tt/(dur/4))*(1-np.exp(-tt/0.004))
    s = sum(np.sin(2*np.pi*freq*k*tt)/k**1.5 for k in (1, 2, 3, 4))*e*amp
    return i0, s
def pulse(plan, bpm):
    """Soft plucked arpeggio: hold chord, then lead chord from 17 s; quarter notes, eighths in the last 4 s."""
    out = np.zeros((2, len(T))); beat = 60/bpm
    hold = [hz(n) for n in plan["hold"]] + [hz(plan["hold"][0])*2]
    lead = [hz(n) for n in plan["lead"]] + [hz(plan["lead"][0])*2]
    t, k = 0.0, 0
    while t < DUR - 0.05:
        rel = t - PRE; chord = hold if rel < 17 else lead
        step = beat/2 if rel > 26 else beat
        f = chord[k % len(chord)]; r = pluck(f, t, dur=min(1.4, step*1.8), amp=0.35, seed=k)
        if r:
            i0, s = r; pan = 0.5 + 0.35*np.sin(k*2.1)
            out[0, i0:i0+len(s)] += s*(1-pan); out[1, i0:i0+len(s)] += s*pan
        t += step; k += 1
    # gentle low-pass so it sits back
    sos = butter(2, 2500, "low", fs=SR, output="sos"); out = sosfilt(sos, out, axis=1)
    bed = sum(voice(hz(n), env([( -PRE, .4), (29.6, .4), (30, 0)]), seed=9+i) for i, n in enumerate(plan["hold"][:1]))
    bed = bed*np.interp(T, [0, PRE+17, PRE+21, DUR], [1, 1, 0, 0])
    bed2 = voice(hz(plan["lead"][0]), env([(17, 0), (21, .4), (29.6, .4), (30, 0)]), seed=12)
    return normalize(reverb(out*crescendo() + 0.5*(bed+bed2)*crescendo(), seconds=1.6, wet=0.35))

def riser(plan):
    """Band-passed noise sweeping 150 Hz -> 7 kHz over the gap, a sub hit at 29 s, lead-in power chord under it."""
    rng = np.random.default_rng(3); noise = rng.standard_normal((2, len(T)))*0.3
    out = np.zeros_like(noise); block = 2048
    zi = None
    for i in range(0, len(T), block):
        rel = max(0.0, (i/SR - PRE)/30.0)
        fc = 150*(7000/150)**rel; lo, hi = fc/1.6, min(fc*1.6, 20000)
        sos = butter(2, [lo, hi], "band", fs=SR, output="sos")
        if zi is None: zi = np.stack([sosfilt_zi(sos)*0 for _ in range(2)], axis=1)  # (sections, 2ch, 2)
        for ch in range(2):
            out[ch, i:i+block], zi[:, ch] = sosfilt(sos, noise[ch, i:i+block], zi=zi[:, ch])
    out *= np.interp(T, [0, PRE, PRE+22, PRE+29.4, PRE+29.9], [0, 0.15, 0.6, 1.0, 0])[None]
    # sub hit at 29 s
    i0 = int((PRE+29.0)*SR); n = int(1.0*SR); tt = np.arange(n)/SR
    hit = np.sin(2*np.pi*(hz(plan["lead"][0])/2)*tt*(1+0.6*np.exp(-tt/0.05)))*np.exp(-tt/0.25)*0.9
    out[:, i0:i0+n] += hit
    chord = sum(voice(hz(n), env([(20, 0), (26, .5), (29.6, .5), (30, 0)]), seed=20+i) for i, n in enumerate(plan["lead"]))
    bed = voice(hz(plan["hold"][0]), env([(-PRE, .4), (22, .4), (27, 0)]), seed=30)
    return normalize(reverb(out + 0.6*(chord + bed)*crescendo(fade_in=12), seconds=1.8, wet=0.3))
