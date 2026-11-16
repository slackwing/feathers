#!/usr/bin/env python
"""Build the two transition options per gap and put them in setlist.RPP.
    .venv/bin/python gen/build.py bases      # deterministic layers for every slot + project items
Slots: gapNN-T1-<style>.wav / gapNN-T2-<style>.wav in media/transitions/ (stage2.py overwrites the AI ones)."""
import os, sys, json, subprocess, numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from plans import PLANS, PRE, STYLES, BPM_PUBLISHED
import synth, project, tempo
HERE = project.HERE; OUT = os.path.join(HERE, "media", "transitions"); os.makedirs(OUT, exist_ok=True)
TARGET = -12.0
ASSIGN = {1:("A","C"), 2:("B","D"), 3:("E","C"), 4:("A","F"), 5:("B","C"), 6:(None,"D"),
          7:("D","B"), 8:("A","C"), 9:("E","D"), 10:("C","F")}
LABEL = {"A":"pad + texture", "B":"continuation", "C":"pulse", "D":"riser", "E":"guitar swells", "F":"feedback"}

def loudnorm(src, dst, target=TARGET):
    def run(*a): return subprocess.run(a, capture_output=True, text=True)
    meas = run("ffmpeg","-v","info","-i",src,"-af",f"loudnorm=I={target}:TP=-1:LRA=11:print_format=json","-f","null","-").stderr
    j = json.loads(meas[meas.rfind("{"):meas.rfind("}")+1])
    run("ffmpeg","-y","-v","error","-i",src,"-af",
        f"loudnorm=I={target}:TP=-1:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true",
        "-ar","48000","-c:a","pcm_s24le",dst)
def write(path, stereo):  # stereo: (2, n) float
    tmp = path + ".tmp.wav"; sf.write(tmp, stereo.T, synth.SR, subtype="PCM_24"); loudnorm(tmp, path); os.remove(tmp)

def gaps():
    S = project.songs(); out = []
    for i in range(len(S)-1):
        n, pos, length, f = S[i]; n2, pos2, _, f2 = S[i+1]
        out.append(dict(idx=i+1, frm=n, to=n2, start=pos+length, next_start=pos2, prev_file=f, next_file=f2))
    return out
def bpm_for(song, f):
    if song in BPM_PUBLISHED: return float(BPM_PUBLISHED[song])
    cache = os.path.join(HERE, "gen", "bpm.json"); d = json.load(open(cache)) if os.path.exists(cache) else {}
    if song not in d:
        b, c = tempo.bpm(os.path.join(HERE, f)); d[song] = round(b, 1); json.dump(d, open(cache, "w"), indent=1)
    return d[song]

def slot_path(g, slot, style): return f"media/transitions/gap{g:02d}-T{slot}-{style}.wav"
def item_name(g, style, plan): return f"{g:02d} {plan['frm']} → {plan['to']} · {LABEL[style]}"

def bases():
    for track in ("Transitions 1", "Transitions 2"): project.ensure_track(track, muted=False)
    for gp in gaps():
        g = gp["idx"]; plan = PLANS[g]; pos = gp["start"] - PRE
        for slot, style in zip((1, 2), ASSIGN[g]):
            if style is None: continue
            rel = slot_path(g, slot, style); path = os.path.join(HERE, rel)
            if style in ("A", "B", "E", "F"): audio = synth.drone(plan)
            elif style == "C":
                b = bpm_for(gp["to"], gp["next_file"]); b = b/2 if b > 130 else b
                audio = synth.pulse(plan, b); print(f"  gap {g} pulse at {b:.0f} bpm (from {gp['to']})")
            elif style == "D": audio = synth.riser(plan)
            write(path, audio)
            r = project.put_item(f"Transitions {slot}", item_name(g, style, plan), rel, pos)
            print(f"gap {g:2d} T{slot} {style}: {r} {rel}")
if __name__ == "__main__":
    {"bases": bases}[sys.argv[1]]()
