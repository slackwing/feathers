"""Ingredients for transitions v2: soundfont instruments, paulstretch of the song's own ending,
synth drums (4/4, bar-aligned to the next downbeat, never accelerating), wind, rain, thunder,
chimes, bells, machine hum, heartbeat, reversed cymbals, vinyl, metallic hits; reverbs and
ffmpeg effect chains. Everything returns float stereo arrays shaped (n, 2) at 48 kHz, DUR s."""
import os, subprocess, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt
import tinysoundfont as tsf
SR, PRE, DUR = 48000, 10.0, 40.0
N = int(SR*DUR); T = np.arange(N)/SR
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SF2 = os.path.join(HERE, "media", "sf2", "MuseScore_General.sf2")
TMP = os.path.join(HERE, "media", "transitions", ".tmp"); os.makedirs(TMP, exist_ok=True)
NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]
def midi(note): return NAMES.index(note[:-1]) + 12*(int(note[-1])+1)
def hz(note): return 440*2**((midi(note)-69)/12)
def g(rel): return rel + PRE                      # gap-relative seconds -> absolute
def env(points):                                  # absolute-time piecewise-linear envelope (n,)
    xs, ys = zip(*points); return np.interp(T, xs, ys)
def genv(points): return env([(g(x), y) for x, y in points])
def cos_in(t0, t1):                               # raised-cosine 0->1 between absolute t0..t1
    u = np.clip((T - t0)/max(t1 - t0, 1e-6), 0, 1); return np.sin(0.5*np.pi*u)**2
def zeros(): return np.zeros((N, 2))
def mono2(x, pan=0.5): return np.stack([x*(1-pan)*2**0.5, x*pan*2**0.5], 1) if pan != 0.5 else np.stack([x, x], 1)
def rms(x): return float(np.sqrt((x**2).mean()) + 1e-12)
def level(x, target_rms): return x*(target_rms/rms(x))
def fade(x, points_abs): return x*env(points_abs)[:, None]
def gfade(x, points_rel): return x*genv(points_rel)[:, None]
def place(x, t0):                                 # put a short clip (m,2) at absolute t0 into a DUR buffer
    out = zeros(); i = int(t0*SR); m = min(len(x), N - i)
    if m > 0: out[i:i+m] = x[:m]
    return out
def sos(kind, fc, order=2): return butter(order, fc, kind, fs=SR, output="sos")
def lowpass(x, fc, order=2): return sosfilt(sos("low", fc, order), x, axis=0)
def highpass(x, fc, order=2): return sosfilt(sos("high", fc, order), x, axis=0)
def bandpass(x, lo, hi, order=2): return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x, axis=0)

# ---------------- soundfont ----------------
_synth = None
def _sf():
    global _synth
    if _synth is None:
        _synth = tsf.Synth(samplerate=SR, gain=0); _synth.sfid = _synth.sfload(SF2)
    return _synth
def sf_render(events, preset, bank=0, gain=1.0):
    """events: [(t_on, t_off, midi, vel)] absolute seconds -> (n,2). Fresh channel state per call."""
    s = _sf(); s.notes_off(0); s.sounds_off(0); s.program_select(0, s.sfid, bank, preset, bank == 128)
    ons = sorted(((on, 1, k, v) for on, off, k, v in events), key=lambda e: e[0])
    offs = sorted(((off, 0, k, 0) for on, off, k, v in events), key=lambda e: e[0])
    ev = sorted(ons + offs, key=lambda e: (e[0], e[1])); out = np.zeros(N*2, dtype=np.float32)
    B = 512; i = 0; pos = 0
    while pos < N:
        t = pos/SR
        while i < len(ev) and ev[i][0] <= t:
            _, on, k, v = ev[i]; (s.noteon(0, int(k), int(v)) if on else s.noteoff(0, int(k))); i += 1
        n = min(B, N - pos); out[pos*2:(pos+n)*2] = np.frombuffer(s.generate(n), dtype=np.float32)[:n*2]; pos += n
    s.notes_off(0); s.sounds_off(0)
    return out.reshape(-1, 2).astype(np.float64)*gain
def chord_events(segments, vel=90, overlap=0.35):
    """segments: [(t0, t1, [notes]), ...] absolute -> sustained chord note events with legato overlap."""
    ev = []
    for t0, t1, notes in segments:
        for n in notes: ev.append((t0, t1 + overlap, midi(n) if isinstance(n, str) else n, vel))
    return ev
def pad(preset, segments, vel=90, bank=0, gain=1.0): return sf_render(chord_events(segments, vel), preset, bank, gain)
def arp_events(segments, rate, vel=80, gate=0.9, order="up"):
    """steady arpeggio at `rate` notes/s through each segment's notes; never changes speed."""
    ev = []; k = 0
    for t0, t1, notes in segments:
        seq = [midi(n) if isinstance(n, str) else n for n in notes]
        if order == "updown": seq = seq + seq[-2:0:-1]
        t = t0
        while t < t1:
            ev.append((t, t + gate/rate, seq[k % len(seq)], vel)); t += 1/rate; k += 1
    return ev
def hits(preset, times_notes_vels, length=1.5, bank=0, gain=1.0):
    return sf_render([(t, t + length, midi(n) if isinstance(n, str) else n, v) for t, n, v in times_notes_vels], preset, bank, gain)

# ---------------- the song's own ending, smeared ----------------
def song_end(path, seconds=3.0):
    x, sr = sf.read(path); m = x.mean(1) if x.ndim > 1 else x
    r = np.sqrt(np.convolve(m**2, np.ones(4096)/4096, "same")); end = len(m) - int(np.argmax(r[::-1] > 0.02))
    seg = x[max(0, end - int(seconds*sr)):end]; return (seg if seg.ndim > 1 else np.stack([seg, seg], 1)), sr
def paulstretch(x, sr, out_seconds, window_s=0.35, seed=0):
    rng = np.random.default_rng(seed); W = int(window_s*sr); W += W % 2; win = np.hanning(W)
    out_n = int(out_seconds*sr) + W; out = np.zeros(out_n); hop_out = W//2
    hop_in = (len(x) - W)/max((out_n - W)/hop_out, 1); pos_in = 0.0; pos_out = 0
    while pos_out + W <= out_n:
        i = int(pos_in); seg = x[i:i+W]
        if len(seg) < W: seg = np.pad(seg, (0, W - len(seg)))
        mag = np.abs(np.fft.rfft(seg*win)); ph = rng.uniform(0, 2*np.pi, len(mag))
        out[pos_out:pos_out+W] += np.fft.irfft(mag*np.exp(1j*ph), W)*win
        pos_in += hop_in; pos_out += hop_out
    return out[:int(out_seconds*sr)]
def stretch_bed(path, seconds=3.0, seed=0):
    """the previous song's last `seconds` smeared over the whole piece; stereo from two phase draws."""
    seg, sr = song_end(path, seconds)
    L = paulstretch(seg[:, 0], sr, DUR, seed=seed); R = paulstretch(seg[:, 1], sr, DUR, seed=seed + 1)
    y = np.stack([L, R], 1)
    if sr != SR:
        p = os.path.join(TMP, "st_in.wav"); q = os.path.join(TMP, "st_out.wav"); sf.write(p, y, sr)
        subprocess.run(["ffmpeg","-y","-v","error","-i",p,"-ar",str(SR),q]); y, _ = sf.read(q)
    y = y[:N]; y = np.pad(y, ((0, N - len(y)), (0, 0)))
    return highpass(y, 40)/max(np.abs(y).max(), 1e-9)*0.5

# ---------------- noises & nature ----------------
def _noise(seed, shape): return np.random.default_rng(seed).standard_normal(shape)
def _smooth_walk(seed, rate_hz, n=N):
    rng = np.random.default_rng(seed); k = max(int(SR/rate_hz), 1)
    pts = rng.standard_normal(n//k + 3); return np.interp(np.arange(n)/k, np.arange(len(pts)), pts)
def wind(seed=1, lo=200, hi=1600, gust=0.08, strength=1.0):
    """band-passed noise whose center wanders, with slow gusts. stereo decorrelated."""
    out = zeros()
    for ch in range(2):
        n = _noise(seed + ch, N); walk = _smooth_walk(seed + 10 + ch, 0.25); fc = np.exp(np.interp(walk, [-2, 2], [np.log(lo), np.log(hi)]))
        y = np.zeros(N); B = 2048
        for i in range(0, N, B):
            c = float(np.clip(fc[i], 60, 8000)); y[i:i+B] = sosfilt(butter(2, [c/1.5, c*1.5], "band", fs=SR, output="sos"), n[i:i+B])
        gusts = np.clip(0.35 + 0.65*(_smooth_walk(seed + 20 + ch, gust) + 1)/2, 0, 1.3)
        out[:, ch] = y*gusts
    return out/max(np.abs(out).max(), 1e-9)*0.5*strength
def rain(seed=2, density=600):
    rng = np.random.default_rng(seed); out = zeros()
    for ch in range(2):
        clicks = np.zeros(N); idx = rng.integers(0, N, int(density*DUR)); clicks[idx] = rng.uniform(0.3, 1, len(idx))
        out[:, ch] = highpass(lowpass(clicks, 5500, 4)[:, None], 1500)[:, 0] + 0.02*_noise(seed + 5 + ch, N)
    out = lowpass(highpass(out, 800), 9000, 4); return out/max(np.abs(out).max(), 1e-9)*0.4   # steep top: no inter-sample overs
def thunder(t_abs, seed=3, length=6.0):
    rng = np.random.default_rng(seed); m = int(length*SR); tt = np.arange(m)/SR
    n = np.cumsum(rng.standard_normal(m)); n -= np.convolve(n, np.ones(2000)/2000, "same")  # brownish
    e = (1 - np.exp(-tt/0.25))*np.exp(-tt/(length/3.5))*(1 + 0.4*np.sin(2*np.pi*rng.uniform(1.5, 3)*tt))
    y = lowpass((n*e)[:, None], 180, 4)[:, 0]; y /= max(np.abs(y).max(), 1e-9)
    return place(np.stack([y, np.roll(y, 300)], 1), t_abs)*0.8
def church_bell(freq, t_abs, decay=9.0, amp=0.6, seed=4):
    m = int(min(decay*1.5, DUR - t_abs)*SR); tt = np.arange(m)/SR; y = np.zeros(m)
    for r, a, d in [(0.5, 0.9, 1.0), (1, 1.0, 0.7), (1.2, 0.5, 0.45), (1.5, 0.6, 0.5), (2, 0.6, 0.35), (2.5, 0.3, 0.25), (3, 0.25, 0.2), (4.2, 0.15, 0.12)]:
        y += a*np.sin(2*np.pi*freq*r*tt + 0.3*r)*np.exp(-tt/(decay*d))
    y += 0.4*_noise(seed, m)*np.exp(-tt/0.015)
    y /= max(np.abs(y).max(), 1e-9); return place(np.stack([y, y*0.9], 1), t_abs)*amp
def wind_chimes(notes, density_env, seed=5, amp=0.5):
    """random metal-tube chimes from a note set; density_env (n,) in events/s."""
    rng = np.random.default_rng(seed); out = zeros(); t = 0.0; density_env = np.ravel(density_env)
    keys = [midi(n) if isinstance(n, str) else n for n in notes]
    while t < DUR:
        d = max(float(density_env[min(int(t*SR), N-1)]), 1e-3); t += rng.exponential(1/d)
        if t >= DUR: break
        f = 440*2**((rng.choice(keys) - 69)/12); m = int(2.5*SR); tt = np.arange(m)/SR; y = np.zeros(m)
        for r, a, dec in [(1, 1, 1.6), (2.76, 0.5, 0.9), (5.4, 0.25, 0.5), (8.9, 0.1, 0.3)]:
            y += a*np.sin(2*np.pi*f*r*tt)*np.exp(-tt/dec)
        y *= rng.uniform(0.3, 1)*(1 - np.exp(-tt/0.005)); pan = rng.uniform(0.2, 0.8)   # 5 ms attack: ring, don't tick
        out += place(np.stack([y*(1-pan), y*pan], 1), t)
    return out/max(np.abs(out).max(), 1e-9)*amp
def machine_hum(freq, am_hz=4.0, amp=0.5, seed=6):
    saw = lambda f, ph: 2*((f*T + ph) % 1) - 1
    y = saw(freq, 0) + 0.6*saw(freq*1.004, 0.3) + 0.3*saw(freq*2, 0.1)
    am = 0.55 + 0.45*np.clip(np.sin(2*np.pi*am_hz*T)*4, -1, 1)
    y = lowpass((y*am)[:, None], 320, 4)[:, 0]; y += 0.15*lowpass(_noise(seed, N)[:, None], 150)[:, 0]
    y /= max(np.abs(y).max(), 1e-9); return np.stack([y, np.roll(y, 37)], 1)*amp
def heartbeat(bpm, t0, t1, amp=0.7):
    out = zeros(); beat = 60/bpm; t = t0; m = int(0.25*SR); tt = np.arange(m)/SR
    thump = np.sin(2*np.pi*55*tt*(1 + np.exp(-tt/0.03)))*np.exp(-tt/0.06)*(1 - np.exp(-tt/0.006))   # soft attack: no click
    while t < t1:
        out += place(np.stack([thump, thump], 1), t); out += place(np.stack([thump, thump], 1)*0.7, t + 0.19); t += beat
    return out*amp
def reverse_cymbal(t_end, length=3.0, amp=0.6, seed=7, bright=6000):
    m = int(length*SR); tt = np.arange(m)/SR; n = _noise(seed, m)
    y = highpass(bandpass(n[:, None], 1500, bright), 1200)[:, 0]*(tt/length)**2.2
    y = np.concatenate([y, y[-1:]*np.exp(-np.arange(int(0.05*SR))/(0.01*SR))])
    y /= max(np.abs(y).max(), 1e-9); return place(np.stack([y, y], 1), t_end - length)*amp
def vinyl(seed=8, amp=0.25):
    rng = np.random.default_rng(seed); c = np.zeros(N); idx = rng.integers(0, N, int(9*DUR)); c[idx] = rng.uniform(0.2, 1, len(idx))
    y = lowpass(c[:, None], 4000)[:, 0] + 0.06*lowpass(_noise(seed + 1, N)[:, None], 6000)[:, 0]
    return np.stack([y, np.roll(y, 123)], 1)*amp
def metal_hit(t_abs, freq=420, amp=0.6, seed=9, decay=0.6):
    rng = np.random.default_rng(seed); m = int(decay*3*SR); tt = np.arange(m)/SR; y = np.zeros(m)
    for r in [1, 1.41, 1.73, 2.3, 3.1, 4.7, 6.2]:
        y += np.sin(2*np.pi*freq*r*tt + rng.uniform(0, 6))*np.exp(-tt/(decay/(r**0.6)))/r**0.3
    y += 0.8*_noise(seed, m)*np.exp(-tt/0.01); y = np.tanh(2.5*y); y /= max(np.abs(y).max(), 1e-9)
    return place(np.stack([y, y*0.85], 1), t_abs)*amp
def sub(note, t0, t1, amp=0.6, attack=1.5):
    f = hz(note); y = np.sin(2*np.pi*f*T) + 0.3*np.sin(2*np.pi*2*f*T)
    e = env([(0, 0), (t0, 0), (t0 + attack, 1), (t1 - 0.3, 1), (t1, 0), (DUR, 0)])
    return np.stack([y, y], 1)*e[:, None]*amp

# ---------------- drums: 4/4, bar line exactly at DUR, steady ----------------
def _kick(decay=0.4, pitch=110, click=0.6):
    m = int(decay*2.5*SR); tt = np.arange(m)/SR; f = 42 + (pitch - 42)*np.exp(-tt/0.045)
    y = np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tt/decay) + click*_noise(1, m)*np.exp(-tt/0.004); return y/max(np.abs(y).max(), 1e-9)
def _snare(decay=0.22, tone=185, seed=2):
    m = int(decay*4*SR); tt = np.arange(m)/SR; n = bandpass(_noise(seed, m)[:, None], 900, 7000)[:, 0]
    y = n*np.exp(-tt/decay) + 0.9*np.sin(2*np.pi*tone*tt)*np.exp(-tt/0.09) + 0.5*np.sin(2*np.pi*tone*1.6*tt)*np.exp(-tt/0.05)
    return y/max(np.abs(y).max(), 1e-9)
def _hat(decay=0.05, seed=3):
    m = int(decay*5*SR); tt = np.arange(m)/SR; y = highpass(_noise(seed, m)[:, None], 7000)[:, 0]*np.exp(-tt/decay); return y/max(np.abs(y).max(), 1e-9)
def _tom(freq=90, decay=0.5):
    m = int(decay*3*SR); tt = np.arange(m)/SR; f = freq*(1 + 0.6*np.exp(-tt/0.05)); y = np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tt/decay); return y/max(np.abs(y).max(), 1e-9)
def beat_grid(bpm, t_start, t_end=DUR):
    """-> [(t_abs, beat_in_bar 0..3, eighth 0..7)] from the first bar line >= t_start up to the last 8th before t_end.
    Bar lines are placed so one falls exactly on t_end (the next song's downbeat)."""
    beat = 60/bpm; out = []; k = 1
    while t_end - k*beat/2 >= t_start - 1e-9: k += 1
    k -= 1
    # k counts 8ths back from t_end; make the first included 8th a bar line
    while k % 8: k -= 1
    for j in range(k, 0, -1):
        t = t_end - j*beat/2; e = (8 - j % 8) % 8; out.append((t, e//2, e))
    return out
def drums(bpm, t_start, kind="shoegaze", t_end=DUR, amp=0.8, ramp_bars=2):
    out = zeros(); grid = beat_grid(bpm, t_start, t_end)
    if not grid: return out
    t_first = grid[0][0]; bar = 240/bpm
    K, S, H, TM = _kick(), _snare(), _hat(), _tom()
    if kind == "industrial":
        K = np.tanh(3*_kick(0.3, 140, 1.0)); sn = _snare(0.3, 150, 5); tt = np.arange(len(sn))/SR
        S = np.tanh(2*(sn + 0.6*np.sin(2*np.pi*310*tt)*np.exp(-tt/0.12)))
    for t, b, e in grid:
        ramp = min(1.0, (t - t_first)/(ramp_bars*bar) + 0.35)
        if kind in ("shoegaze", "industrial"):
            if b in (0, 2) and e % 2 == 0: out += place(mono2(K), t)*1.0*ramp
            if b in (1, 3) and e % 2 == 0: out += place(mono2(S), t)*0.9*ramp
            if kind == "shoegaze" and e % 2 == 1: out += place(mono2(H, 0.6), t)*0.18*ramp
            if kind == "industrial" and e in (3, 7): out += metal_hit(t, 380 if e == 3 else 520, 0.35*ramp, seed=int(e))
        elif kind == "half":   # half-time: kick 1, snare 3, toms on the and of 4
            if e == 0: out += place(mono2(K), t)*ramp
            if e == 4: out += place(mono2(S), t)*0.9*ramp
            if e == 7: out += place(mono2(TM, 0.35), t)*0.5*ramp
            if e % 2 == 1: out += place(mono2(H, 0.65), t)*0.12*ramp
        elif kind == "toms":   # tribal: floor toms on 1 and the and of 2, rack tom on 4
            if e == 0: out += place(mono2(_tom(70, 0.7), 0.4), t)*ramp
            if e == 3: out += place(mono2(_tom(70, 0.5), 0.6), t)*0.7*ramp
            if e == 6: out += place(mono2(_tom(120, 0.45), 0.5), t)*0.8*ramp
    return out*amp

# ---------------- processing ----------------
_irs = {}
def _ir(kind):
    if kind in _irs: return _irs[kind]
    rng = np.random.default_rng({"hall": 11, "cathedral": 12, "plate": 13, "metal": 14, "room": 15}[kind])
    sec, dec, lp, pre = {"hall": (3.5, 0.9, 5000, 0.02), "cathedral": (7.0, 1.9, 2800, 0.035), "plate": (1.6, 0.4, 9000, 0.005),
                         "metal": (2.6, 0.6, 6000, 0.01), "room": (0.7, 0.18, 7000, 0.004)}[kind]
    m = int(sec*SR); tt = np.arange(m)/SR; ir = np.zeros((m, 2))
    for ch in range(2):
        n = rng.standard_normal(m)*np.exp(-tt/dec); n = lowpass(n[:, None], lp)[:, 0]
        if kind == "metal":
            for d in (0.0037, 0.0051, 0.0089):
                k = int(d*SR); fb = n.copy()
                for _ in range(6): fb = fb + 0.55*np.concatenate([np.zeros(k), fb[:-k]])
                n = 0.5*n + 0.5*fb/6
        ir[:, ch] = n
    ir = np.concatenate([np.zeros((int(pre*SR), 2)), ir]); ir /= np.sqrt((ir**2).sum())*2.2
    _irs[kind] = ir; return ir
def reverb(x, kind="hall", wet=0.4, dry=None):
    ir = _ir(kind); n = 1 << (len(x) + len(ir) - 1).bit_length(); out = np.zeros_like(x)
    for ch in range(2):
        out[:, ch] = np.fft.irfft(np.fft.rfft(x[:, ch], n)*np.fft.rfft(ir[:, ch], n), n)[:len(x)]
    out *= rms(x)/max(rms(out), 1e-9)
    return (1 - wet if dry is None else dry)*x + wet*out
def ffx(x, chain):
    p = os.path.join(TMP, "fx_in.wav"); q = os.path.join(TMP, "fx_out.wav"); sf.write(p, x, SR, subtype="FLOAT")
    r = subprocess.run(["ffmpeg","-y","-v","error","-i",p,"-af",chain,"-c:a","pcm_f32le",q], capture_output=True, text=True)
    if r.returncode: raise RuntimeError(r.stderr)
    y, _ = sf.read(q); y = y[:N]; return np.pad(y, ((0, N - len(y)), (0, 0)))
def distort(x, drive=6.0, tone=3200):
    y = highpass(x, 90); y = np.tanh(drive*y/max(rms(y)*8, 1e-9)); y = lowpass(y, tone); return level(y, rms(x))
def chorus(x): return ffx(x, "chorus=0.6:0.9:50|60|40:0.4|0.32|0.3:0.25|0.4|0.3:2|2.3|1.3")
def flanger(x): return ffx(x, "flanger=delay=4:depth=3:speed=0.15:width=71")
def phaser(x): return ffx(x, "aphaser=in_gain=0.6:out_gain=0.9:delay=3:decay=0.4:speed=0.3")
def tremolo(x, f=5.5, d=0.7): return ffx(x, f"tremolo=f={f}:d={d}")
def wobble(x, f=0.6, d=0.25): return ffx(x, f"vibrato=f={f}:d={d}")
def crush(x, bits=7): return ffx(x, f"acrusher=bits={bits}:mode=log:aa=1:mix=0.8")
def echo(x, ms=375, fb=0.45, mixv=0.45): return ffx(x, f"aecho=1:{mixv}:{ms}|{ms*2}:{fb}|{fb*0.5}")
