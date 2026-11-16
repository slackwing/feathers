import numpy as np, wave, sys, os, glob, json
NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]
MAJ = np.array([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88])
MIN = np.array([6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17])

def load(path):
    with wave.open(path) as w:
        sr, n, ch = w.getframerate(), w.getnframes(), w.getnchannels()
        x = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768
    if ch > 1: x = x.reshape(-1, ch).mean(1)
    return x, sr

def bands(sr, N, lo_midi, hi_midi):
    freqs = np.fft.rfftfreq(N, 1/sr)
    out = []
    for m in range(lo_midi, hi_midi+1):
        f0 = 440*2**((m-69)/12)
        sel = np.where((freqs >= f0*2**(-0.5/12)) & (freqs < f0*2**(0.5/12)))[0]
        out.append((m % 12, sel))
    return out

def chroma(x, sr, lo_midi=36, hi_midi=95, N=16384, hop=4096):  # C2..B6, 5 whole octaves
    win = np.hanning(N); B = bands(sr, N, lo_midi, hi_midi)
    acc = np.zeros(12); frames = 0
    for s in range(0, len(x)-N, hop):
        X = np.abs(np.fft.rfft(x[s:s+N]*win))
        c = np.zeros(12)
        for pc, sel in B:
            if len(sel): c[pc] += X[sel].max()      # peak in the semitone band
        c = np.log1p(100*c)
        if c.sum() > 0: acc += c/c.sum(); frames += 1
    return acc/max(frames,1)

def score(c):
    c = c - c.mean(); out = []
    for i in range(12):
        for name, prof in (("", MAJ), ("m", MIN)):
            p = np.roll(prof, i); p = p - p.mean()
            out.append((float((c*p).sum()/np.sqrt((c*c).sum()*(p*p).sum())), NAMES[i]+name))
    return sorted(out, reverse=True)

def analyze(path):
    x, sr = load(path); res = {}
    for k, s in {"all": x, "first30": x[:30*sr], "last30": x[-30*sr:]}.items():
        c = chroma(s, sr)
        bass = chroma(s, sr, 28, 51)   # E1..D#3: bass register, where the roots live
        res[k] = {"kk": score(c)[:3], "pcs": [NAMES[i] for i in np.argsort(-c)[:4]],
                  "bass": [NAMES[i] for i in np.argsort(-bass)[:3]]}
    return res

if __name__ == "__main__":
    files = sys.argv[1:]; out = {}
    for f in files:
        title = os.path.basename(f)[:-4].split(" - ",1)[-1]
        r = analyze(f); out[title] = r
        a, fi, la = r["all"], r["first30"], r["last30"]
        print(f"{title:24s} {a['kk'][0][1]:>4s} {a['kk'][0][0]:.2f} | {a['kk'][1][1]:>4s} {a['kk'][1][0]:.2f} | {a['kk'][2][1]:>4s} {a['kk'][2][0]:.2f}   pcs {' '.join(a['pcs']):12s} bass {' '.join(a['bass'])}")
        print(f"{'':24s} first30: {fi['kk'][0][1]:>4s} {fi['kk'][0][0]:.2f} bass {' '.join(fi['bass']):9s}  last30: {la['kk'][0][1]:>4s} {la['kk'][0][0]:.2f} bass {' '.join(la['bass'])}")
    json.dump(out, open("keys2.json","w"), indent=1)
