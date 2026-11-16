"""Tuned drone for Beacon of Emerald (C# minor) -> Falling (G major).
Plan from keys.md: hold E (+B, both shared by the two keys), lead-in D, land on G (the song).
The piece starts PRE seconds before Beacon ends, swelling under its tail (E is the 3rd of C#m).
PRE+0..18   E2 E3 B3 hold (long raised-cosine crescendo over the first FADE_IN seconds)
PRE+18..25  D3 fades in, E3 fades out (E2 stays under it: suspended feel)
PRE+25..29  E2 slides down to D2, A3 joins -> a D chord, the pull into G
PRE+29..30  fast fade; the song's first downbeat lands on G
usage: python drone-beacon-to-falling.py OUT.wav [PRE=10] [FADE_IN=18]
"""
import numpy as np, wave, sys
out = sys.argv[1]; PRE = float(sys.argv[2]) if len(sys.argv) > 2 else 10.0
FADE_IN = float(sys.argv[3]) if len(sys.argv) > 3 else 18.0
SR, DUR = 48000, PRE + 30.0
t = np.arange(int(SR*DUR))/SR
def env(points):  # piecewise-linear envelope, times relative to the gap start
    xs, ys = zip(*points); return np.interp(t, [x + PRE for x in xs], ys)
def voice(freq, amp_env, bright=1.0, detune=0.004, seed=0):
    rng = np.random.default_rng(seed); o = np.zeros((2, len(t)))
    for ch, d in enumerate((1-detune/2, 1+detune/2)):
        f = freq*d*(1 + 0.0015*np.sin(2*np.pi*0.11*t + rng.uniform(0, 6)))
        ph = 2*np.pi*np.cumsum(f)/SR
        tilt = 1.6 - 0.5*bright*np.sin(2*np.pi*0.045*t + rng.uniform(0, 6))
        sig = np.zeros(len(t))
        for n in range(1, 40):
            if freq*n > 6000: break
            sig += np.sin(n*ph + rng.uniform(0, 6)) / n**tilt
        o[ch] = sig
    return o*amp_env
E2, E3, B3, D3, D2, A3 = 82.41, 164.81, 246.94, 146.83, 73.42, 220.0
mix  = voice(E2, env([(-PRE,0.9),(24,0.9),(28,0)]), seed=1)
mix += voice(E3, env([(-PRE,0),(-PRE+5,0.5),(18,0.5),(23,0)]), seed=2)
mix += voice(B3, env([(-PRE,0),(-PRE+8,0.3),(27,0.3),(29.5,0)]), seed=3)
mix += voice(D3, env([(17,0),(21,0.55),(29.5,0.55),(30,0)]), seed=4)
mix += voice(D2, env([(24,0),(27.5,0.9),(29.6,0.9),(30,0)]), seed=5)
mix += voice(A3, env([(25,0),(28,0.3),(29.6,0.3),(30,0)]), seed=6)
ir_len = int(2.2*SR); rng = np.random.default_rng(7)
ir = rng.standard_normal(ir_len)*np.exp(-np.arange(ir_len)/(0.45*SR)); ir /= np.abs(ir).sum()**0.5*8
def conv(x, h):
    n = 1 << (len(x)+len(h)-1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, n)*np.fft.rfft(h, n), n)[:len(x)]
wet = np.stack([conv(mix[0], ir), conv(mix[1], ir[::-1]*0.9 + ir*0.1)])
mix = 0.6*mix + 0.4*wet
# gentle crescendo: raised cosine from silence over FADE_IN s, then a quick tail fade
fade = np.where(t < FADE_IN, np.sin(0.5*np.pi*np.clip(t/FADE_IN, 0, 1))**2, 1.0)
fade *= np.interp(t, [DUR-1.2, DUR], [1, 0])
mix *= fade
mix *= 0.5/np.abs(mix).max()
with wave.open(out, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix.T*32767).astype(np.int16).tobytes())
print(f"wrote {out} {DUR:.0f}s (pre-roll {PRE:.0f}s, crescendo {FADE_IN:.0f}s)")
