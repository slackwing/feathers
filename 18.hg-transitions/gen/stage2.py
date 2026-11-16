#!/usr/bin/env python
"""AI layers on top of the deterministic bases. Overwrites slot files in place (project items stay put).
    .venv/bin/python gen/stage2.py A B EF        # jobs; each slot is skipped once media/transitions/.done/<slot> exists
A  = MusicGen-small text textures (two per slot: low + airy) blended under the drone
B  = MusicGen-small continuation of the previous song's last 8 s, chained to 40 s, over a quiet drone
EF = MusicGen-stereo-melody conditioned on the drone (time-compressed to 30 s), guitar prompts, over the drone
"""
import os, sys, json, time, subprocess, numpy as np, soundfile as sf, torch
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from plans import PLANS, PRE, DUR
import project, build, synth
from keydetect import chroma, NAMES
HERE = project.HERE; OUT = os.path.join(HERE, "media", "transitions"); DONE = os.path.join(OUT, ".done"); os.makedirs(DONE, exist_ok=True)
TMP = os.path.join(OUT, ".tmp"); os.makedirs(TMP, exist_ok=True)
torch.set_num_threads(int(os.environ.get("THREADS", 10)))
SR = synth.SR; MSR = 32000
def log(*a): print(time.strftime("%H:%M:%S"), *a, flush=True)
def run(*a): return subprocess.run(a, capture_output=True, text=True)

PROMPTS_A = {
 1: ("dark ambient drone, slowly evolving analog synth pad, gothic, eerie, cinematic, sustained, no drums, no vocals",
     "ethereal shimmering synth pad, airy glassy high texture, long reverb tail, slow swell, no drums, no vocals"),
 4: ("haunted church organ, sustained dark chords, cathedral reverb, slow, ominous, no drums, no vocals",
     "distant whispering choir pad, airy, breathy, long reverb, slow, no drums"),
 8: ("cold glassy digital synth pad, icy shimmer, slow swell, eerie, minimal, no drums, no vocals",
     "high crystalline bell-like tones, sparse, glassy, reverb, slow, no drums, no vocals"),
}
PROMPT_B = "ambient outro, the band dissolves into reverb and a sustained drone, slow, atmospheric, no drums, no vocals"
PROMPT_E = "reverb-drenched electric guitar volume swells, post-punk, goth, slow, atmospheric, ebow, no drums, no vocals"
PROMPT_F = "distorted electric guitar feedback wall, tremolo picking, shoegaze, dense, dark, slow, no drums, no vocals"

# ---------- models ----------
_models = {}
def small(stereo=True):
    k = "stereo-small" if stereo else "small"
    if k not in _models:
        from transformers import AutoProcessor, MusicgenForConditionalGeneration
        mid = f"facebook/musicgen-{k}"; t0 = time.time()
        _models[k] = (AutoProcessor.from_pretrained(mid), MusicgenForConditionalGeneration.from_pretrained(mid).eval())
        log(f"loaded {mid} in {time.time()-t0:.0f}s")
    return _models[k]
def melody():
    if "melody" not in _models:
        from transformers import AutoProcessor, MusicgenMelodyForConditionalGeneration
        mid = "facebook/musicgen-stereo-melody"; t0 = time.time()
        _models["melody"] = (AutoProcessor.from_pretrained(mid), MusicgenMelodyForConditionalGeneration.from_pretrained(mid).eval())
        log(f"loaded {mid} in {time.time()-t0:.0f}s")
    return _models["melody"]
def to_np(audio):  # model output (b, ch, n) -> (n, ch) float32
    a = audio[0].float().cpu().numpy(); return a.T if a.ndim == 2 else a[:, None]
def gen_text(prompt, secs=30, seed=0):
    proc, model = small(True); torch.manual_seed(seed)
    inp = proc(text=[prompt], padding=True, return_tensors="pt")
    with torch.no_grad(): out = model.generate(**inp, do_sample=True, guidance_scale=3.0, max_new_tokens=int(secs*50))
    return to_np(out)
def gen_continue(prompt, prompt_audio_mono, new_secs, seed=0):
    """prompt_audio_mono: 1-D float at 32 kHz. Returns only the NEW audio (mono, 32 kHz)."""
    proc, model = small(False); torch.manual_seed(seed)
    inp = proc(audio=prompt_audio_mono, sampling_rate=MSR, text=[prompt], padding=True, return_tensors="pt")
    with torch.no_grad(): out = model.generate(**inp, do_sample=True, guidance_scale=3.0, max_new_tokens=int(new_secs*50))
    a = to_np(out)[:, 0]
    if len(a) > len(prompt_audio_mono) + MSR: a = a[len(prompt_audio_mono):]   # output includes the prompt
    return a
def gen_melody(prompt, cond_mono_32k, seed=0):
    proc, model = melody(); torch.manual_seed(seed)
    inp = proc(audio=cond_mono_32k, sampling_rate=MSR, text=[prompt], padding=True, return_tensors="pt")
    with torch.no_grad(): out = model.generate(**inp, do_sample=True, guidance_scale=3.0, max_new_tokens=1500)
    return to_np(out)

# ---------- audio utils ----------
def resample(x, sr_from, sr_to):
    p = os.path.join(TMP, "rs_in.wav"); q = os.path.join(TMP, "rs_out.wav")
    sf.write(p, x, sr_from); run("ffmpeg","-y","-v","error","-i",p,"-ar",str(sr_to),q); y, _ = sf.read(q); return y
def fit_and_filter(tex, tex_sr, drone, lo, hi, fit=True, length=DUR):
    """Pitch-fit tex to drone by chroma correlation, stretch to `length` s, band-limit. -> (n,2) at 48k."""
    t2 = tex if tex.ndim > 1 else np.stack([tex, tex], 1)
    shift = 0
    if fit:
        c = chroma(t2.mean(1).astype(np.float32), tex_sr); dc = chroma(drone.mean(1).astype(np.float32), SR)
        cons = lambda sh: float(np.corrcoef(np.roll(c, sh) - c.mean(), dc - dc.mean())[0, 1])
        shift = max(range(-6, 6), key=lambda sh: (cons(sh), -abs(sh)))
        log(f"   fit: top pcs {[NAMES[i] for i in np.argsort(-c)[:3]]} -> shift {shift:+d} (r={cons(shift):.2f})")
    tempo = (len(t2)/tex_sr)/length
    p = os.path.join(TMP, "fit_in.wav"); q = os.path.join(TMP, "fit_out.wav"); sf.write(p, t2, tex_sr)
    run("ffmpeg","-y","-v","error","-i",p,"-af",f"rubberband=pitch={2**(shift/12):.6f}:tempo={tempo:.6f}:pitchq=quality,highpass=f={lo}:poles=2,lowpass=f={hi}:poles=2,aresample={SR}",q)
    y, _ = sf.read(q); return y
def blend(drone, drone_level, layers, out_path):
    """layers: [(audio48k (n,2), rel_rms, fade_in_end)] -> 24-bit loudnormed file."""
    n = len(drone); tt = np.arange(n)/SR; m = drone*drone_level
    drms = np.sqrt((drone**2).mean())
    for a, rel, fin in layers:
        a = a[:n]; a = np.pad(a, ((0, n-len(a)), (0, 0)))
        a = a*rel*drms/max(np.sqrt((a**2).mean()), 1e-9)
        f = np.sin(0.5*np.pi*np.interp(tt, [0, fin, DUR-2.5, DUR], [0, 1, 1, 0]))**2
        m = m + a*f[:, None]
    m *= min(1.0, 0.95/np.abs(m).max())
    tmp = out_path + ".pre.wav"; sf.write(tmp, m, SR, subtype="PCM_24"); build.loudnorm(tmp, out_path); os.remove(tmp)
def slot(g, s, style): return os.path.join(HERE, build.slot_path(g, s, style))
def mark(name): open(os.path.join(DONE, name), "w").write(time.ctime())
def done(name): return os.path.exists(os.path.join(DONE, name))
def drone_for(plan): return synth.drone(plan).T  # (n,2)

# ---------- jobs ----------
def job_A():
    for g, s in [(g, s) for g, pair in build.ASSIGN.items() for s, st in zip((1, 2), pair) if st == "A"]:
        name = f"gap{g:02d}-T{s}-A"
        if done(name): continue
        plan = PLANS[g]; d = drone_for(plan); lo_p, hi_p = PROMPTS_A[g]
        log(f"A gap {g}: low texture"); low = gen_text(lo_p, 30, seed=g)
        log(f"A gap {g}: high texture"); high = gen_text(hi_p, 30, seed=100+g)
        sf.write(os.path.join(TMP, f"{name}-low.wav"), low, MSR); sf.write(os.path.join(TMP, f"{name}-high.wav"), high, MSR)
        L = [(fit_and_filter(low, MSR, d, 110, 4000), 0.8, 18), (fit_and_filter(high, MSR, d, 600, 12000), 0.6, 20)]
        blend(d, 1.0, L, slot(g, s, "A")); mark(name); log(f"DONE {name}")
def job_B():
    S = project.songs()
    for g, s in [(g, s) for g, pair in build.ASSIGN.items() for s, st in zip((1, 2), pair) if st == "B"]:
        name = f"gap{g:02d}-T{s}-B"
        if done(name): continue
        plan = PLANS[g]; d = drone_for(plan); prev = S[g-1][3]
        raw = os.path.join(TMP, f"{name}-cont.wav")
        if os.path.exists(raw):
            cont, _ = sf.read(raw); log(f"B gap {g}: reusing raw continuation")
        else:
            x, sr = sf.read(os.path.join(HERE, prev)); tail = x[-int(8*sr):].mean(1)
            tail = resample(tail, sr, MSR).astype(np.float32); tail = tail/max(np.abs(tail).max(), 1e-9)*0.8
            log(f"B gap {g}: continuation 1/2 from the tail of {plan['frm']}"); p1 = gen_continue(PROMPT_B, tail, 22, seed=g)
            log(f"B gap {g}: continuation 2/2"); p2 = gen_continue(PROMPT_B, p1[-8*MSR:], 22, seed=50+g)
            cont = np.concatenate([p1, p2])[:int(42*MSR)]; sf.write(raw, cont, MSR)
        # no pitch shift: the continuation is faithful to the song's actual ending by construction;
        # the drone sits low underneath and only supplies the lead-in motion at the end
        c48 = fit_and_filter(cont, MSR, d, 80, 12000, fit=False)
        dly = int(0.012*SR); c48[:, 1] = np.roll(c48[:, 1], dly)   # slight stereo widening of the mono output
        blend(d, 0.4, [(c48, 1.5, 14)], slot(g, s, "B")); mark(name); log(f"DONE {name}")
def job_EF():
    for g, s, st in [(g, s, st) for g, pair in build.ASSIGN.items() for s, st in zip((1, 2), pair) if st in ("E", "F")]:
        name = f"gap{g:02d}-T{s}-{st}"
        if done(name): continue
        plan = PLANS[g]; d = drone_for(plan)
        # condition on the drone time-compressed to 30 s so the harmonic motion survives the stretch back to 40 s
        p = os.path.join(TMP, "cond_in.wav"); q = os.path.join(TMP, "cond_out.wav"); sf.write(p, d, SR)
        run("ffmpeg","-y","-v","error","-i",p,"-af",f"rubberband=tempo={DUR/30:.6f},aresample={MSR}","-ac","1",q)
        cond, _ = sf.read(q); cond = cond.astype(np.float32)
        log(f"{st} gap {g}: melody-conditioned generation"); out = gen_melody(PROMPT_E if st == "E" else PROMPT_F, cond, seed=g)
        sf.write(os.path.join(TMP, f"{name}-raw.wav"), out, MSR)
        a = fit_and_filter(out, MSR, d, 100, 12000, fit=True)
        blend(d, 0.7, [(a, 1.1, 16)], slot(g, s, st)); mark(name); log(f"DONE {name}")
if __name__ == "__main__":
    for j in (sys.argv[1:] or ["A", "B", "EF"]):
        {"A": job_A, "B": job_B, "EF": job_EF}[j]()
    log("ALL JOBS DONE")
