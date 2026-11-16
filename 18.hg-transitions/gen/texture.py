#!/usr/bin/env python
"""Text-to-audio ambient texture via Meta MusicGen (CPU is fine, slow).
    .venv/bin/python gen/texture.py OUTDIR "prompt" [seconds] [n_candidates] [model]
"""
import sys, os, time, torch, soundfile as sf
from transformers import AutoProcessor, MusicgenForConditionalGeneration
outdir, prompt = sys.argv[1], sys.argv[2]
secs = float(sys.argv[3]) if len(sys.argv) > 3 else 30
n = int(sys.argv[4]) if len(sys.argv) > 4 else 1
model_id = sys.argv[5] if len(sys.argv) > 5 else "facebook/musicgen-stereo-small"
os.makedirs(outdir, exist_ok=True)
t0 = time.time()
proc = AutoProcessor.from_pretrained(model_id)
model = MusicgenForConditionalGeneration.from_pretrained(model_id).eval()
sr = model.config.audio_encoder.sampling_rate
print(f"loaded {model_id} in {time.time()-t0:.0f}s, sr={sr}", flush=True)
inputs = proc(text=[prompt], padding=True, return_tensors="pt")
for i in range(n):
    torch.manual_seed(1000 + i); t1 = time.time()
    with torch.no_grad():
        audio = model.generate(**inputs, do_sample=True, guidance_scale=3.0, max_new_tokens=int(secs*50))
    a = audio[0].float().cpu().numpy().T  # (samples, channels)
    path = os.path.join(outdir, f"texture_{i}.wav"); sf.write(path, a, sr)
    print(f"wrote {path} {a.shape[0]/sr:.1f}s in {time.time()-t1:.0f}s", flush=True)
