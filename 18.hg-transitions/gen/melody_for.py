#!/usr/bin/env python
"""Raw musicgen-stereo-melody output conditioned on a gap's drone: melody_for.py GAP E|F
Writes media/transitions/.tmp/gapNN-raw-<style>.wav (30 s, 32 kHz) for the recipes to use."""
import os, sys, numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import stage2, synth
from plans import PLANS, DUR
g, st = int(sys.argv[1]), sys.argv[2]
out = os.path.join(stage2.TMP, f"gap{g:02d}-raw-{st}.wav")
if os.path.exists(out): print("exists", out); sys.exit()
d = synth.drone(PLANS[g]).T
p = os.path.join(stage2.TMP, f"cond{g}.wav"); q = os.path.join(stage2.TMP, f"cond{g}_32.wav"); sf.write(p, d, synth.SR)
stage2.run("ffmpeg","-y","-v","error","-i",p,"-af",f"rubberband=tempo={DUR/30:.6f},aresample=32000","-ac","1",q)
cond, _ = sf.read(q)
stage2.log(f"{st} gap {g}: melody-conditioned generation")
a = stage2.gen_melody(stage2.PROMPT_E if st == "E" else stage2.PROMPT_F, cond.astype(np.float32), seed=200+g)
sf.write(out, a, 32000); stage2.log(f"DONE raw {out}")
