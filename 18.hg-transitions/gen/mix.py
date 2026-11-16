"""mix.py DRONE.wav OUT.wav TARGET_LUFS LOW_TEXTURE.wav [HIGH_TEXTURE.wav]
Pitch-fit each texture to the drone, band-limit (low: 110-4k, high: 600-12k), blend under the drone."""
import sys, subprocess, json, os, numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from keydetect import chroma, NAMES
drone, out, target = sys.argv[1], sys.argv[2], float(sys.argv[3]); textures = sys.argv[4:]
SR = 48000
def run(*a): return subprocess.run(a, capture_output=True, text=True)
d, dsr = sf.read(drone); dc = chroma(d.mean(1).astype(np.float32), dsr)
def fitted(tex, lo, hi, tag):
    x, sr = sf.read(tex); x = x if x.ndim > 1 else np.stack([x, x], 1)
    c = chroma(x.mean(1).astype(np.float32), sr)
    cons = lambda sh: float(np.corrcoef(np.roll(c, sh) - c.mean(), dc - dc.mean())[0, 1])
    shift = max(range(-6, 6), key=lambda sh: (cons(sh), -abs(sh)))
    print(f"{tag}: top pcs {[NAMES[i] for i in np.argsort(-c)[:3]]}, shift {shift:+d} st (r={cons(shift):.2f}, unshifted {cons(0):.2f})")
    tempo = (len(x)/sr) / (len(d)/dsr)   # <1 stretches the texture to the drone's length
    run("ffmpeg","-y","-v","error","-i",tex,"-af",f"rubberband=pitch={2**(shift/12):.6f}:tempo={tempo:.6f}:pitchq=quality,highpass=f={lo}:poles=2,lowpass=f={hi}:poles=2,aresample={SR}",f"{tag}.wav")
    t, _ = sf.read(f"{tag}.wav"); return t
D = len(d)/dsr; FADE_IN = float(os.environ.get("FADE_IN", 18))
layers = [(fitted(textures[0], 110, 4000, "low"), 0.8, [0, FADE_IN, D-2.5, D])]
if len(textures) > 1: layers.append((fitted(textures[1], 600, 12000, "high"), 0.6, [2, FADE_IN+2, D-2, D]))
n = min([len(d)] + [len(t) for t, _, _ in layers]); d = d[:n]; tt = np.arange(n)/SR
drms = np.sqrt((d**2).mean()); m = d.copy()
for t, rel, fade in layers:
    t = t[:n] * rel*drms/np.sqrt((t**2).mean())
    m += t * (np.sin(0.5*np.pi*np.interp(tt, fade, [0, 1, 1, 0]))**2)[:, None]  # raised-cosine edges
m *= min(1.0, 0.95/np.abs(m).max()); sf.write("premix.wav", m, SR, subtype="PCM_24")
meas = run("ffmpeg","-v","info","-i","premix.wav","-af","loudnorm=I=%g:TP=-1:LRA=11:print_format=json"%target,"-f","null","-").stderr
j = json.loads(meas[meas.rfind("{"):meas.rfind("}")+1])
run("ffmpeg","-y","-v","error","-i","premix.wav","-af",
    "loudnorm=I=%g:TP=-1:LRA=11:measured_I=%s:measured_TP=%s:measured_LRA=%s:measured_thresh=%s:offset=%s:linear=true" %
    (target, j["input_i"], j["input_tp"], j["input_lra"], j["input_thresh"], j["target_offset"]), "-ar",str(SR),"-c:a","pcm_s24le", out)
print("wrote", out, f"({n/SR:.2f}s) | premix {j['input_i']} LUFS -> target {target}")
