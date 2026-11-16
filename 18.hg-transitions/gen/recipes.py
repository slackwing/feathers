#!/usr/bin/env python
"""Transitions v2: three distinct pieces per gap (1-8), each with its own bed, texture and rhythm.
Shape of every piece (gap-relative s; the file starts 10 s before the previous song ends):
  -10..13 HOLD   the previous song's ending (its last chord, often literally smeared) / a shared chord
   13..17 TURN   a short pivot (usually the next key's dominant)
   17..30 PREVIEW the chord the next song actually opens on, swelling into its downbeat at 30
Rhythms are in 4/4 at the next song's tempo, bar-aligned to the downbeat, and never speed up.
    .venv/bin/python gen/recipes.py [gap ...]      # renders media/transitions/v2/gapNN-T{1,2,3}.wav + project items
"""
import os, sys, json, numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sources as S, project, build
from sources import g, gfade, zeros, DUR, SR
def genv(points): return S.genv(points)[:, None]      # column vector: broadcasts over stereo
OUT = os.path.join(S.HERE, "media", "transitions", "v2"); os.makedirs(OUT, exist_ok=True)
BPM = {**json.load(open(os.path.join(S.HERE, "gen", "bpm.json"))), "Helena": 125, "The Ghost of You": 145,
       "Enantiodromia": 95.3, "Horrors of your love": 82.7, "Falling": 119.7, "Can't You See": 119.7}
# hold / turn / preview chords (measured: how the previous song actually ends, what the next one opens on)
CH = {
 1: dict(hold=["E2","B2","E3","G3"], turn=["G#2","D#3","G#3"], prev=["C#2","G#2","C#3","F3","G#3"], chimes=["C#5","E5","F#5","G#5","B5","C#6"]),
 2: dict(hold=["D2","A2","D3","F#3"], turn=["B2","F#3","B3"], prev=["E2","B2","E3","B3"], chimes=["E5","F#5","A5","B5","D6","E6"]),
 3: dict(hold=["B2","F#3","B3"], turn=["E2","B2","E3"], prev=["A2","E3","A3","D4"], chimes=["A5","B5","D6","E6","F#6"]),
 4: dict(hold=["A2","E3","A3","D4"], turn=["F#2","C#3","F#3"], prev=["B2","F#3","B3","D4"], chimes=["B5","D6","E6","F#6","A6"]),
 5: dict(hold=["B2","F#3","B3"], turn=["G#2","D#3","G#3"], prev=["C#2","G#2","C#3","E3","B3"], chimes=["C#5","E5","F#5","G#5","B5"]),
 6: dict(hold=["C#2","G#2","C#3","E3"], turn=["D2","A2","D3"], prev=["G2","D3","G3","B3","E4"], chimes=["E5","G5","A5","B5","D6"]),
 7: dict(hold=["B2","F#3","B3","D#4"], turn=["C2","G2","C3","E3"], prev=["F2","C3","F3","G#3"], chimes=["C5","F5","G5","C6"]),
 8: dict(hold=["F2","C3","F3","A3"], turn=["A2","E3","A3"], turn2=["G#2","D#3","G#3"], prev=["C#2","G#2","C#3","E3"], chimes=["C#5","E5","F#5","G#5","B5"]),
}
H0, H1, T1, P0 = -10, 13, 17, 17     # gap-relative section times
def segs(c, lo=1, hi=None):
    """pad segments [(t0,t1,notes)] absolute; `lo` drops that many low notes, keeps voicing lighter."""
    cut = lambda ns: ns[lo:] if hi is None else ns[lo:hi]
    out = [(g(H0), g(H1), cut(c["hold"]))]
    if "turn2" in c: out += [(g(H1), g(15.3), cut(c["turn"])), (g(15.3), g(T1), cut(c["turn2"]))]
    else: out += [(g(H1), g(T1), cut(c["turn"]))]
    return out + [(g(P0), DUR, cut(c["prev"]))]
def bass_segs(c): return [(t0, t1, ns[:1]) for t0, t1, ns in segs(c, 0)]
def swell(): return genv([(-10, 0), (8, 1), (P0, .55), (28.5, 1), (30, 1)])   # dip into the turn, swell through the preview
def crescendo(sec=18): return S.cos_in(0, sec)[:, None]
def tail(): return genv([(29.2, 1), (30, 0)])
def chime_density(peak=1.6, start=-6): return genv([(start, 0), (6, peak*.5), (P0, peak), (27, peak*.6), (30, 0)])

# ---------------- recipes ----------------
def r1_t1(c, ctx):  # smeared Phantom ending + wind + sparse piano, steady every 2 s, cathedral
    bed = gfade(S.stretch_bed(ctx["prev_file"], 3.0, seed=1), [(-10, 0), (0, 1), (H1, 1), (T1 + 2, 0)])
    pads = S.pad(92, segs(c))                                                     # bowed glass takes over at the turn
    pads = gfade(pads, [(H1 - 1, 0), (H1, 1), (30, 1)])
    piano = S.sf_render(S.arp_events(segs(c, 1), rate=0.5, vel=62, gate=1.8, order="up"), 0)
    piano = gfade(piano, [(-4, 0), (0, 1), (27, 1), (30, 0.2)])
    y = S.reverb(bed*1.0 + pads*0.9 + piano*0.8, "cathedral", 0.5) + S.wind(seed=1, lo=150, hi=900, strength=0.5)*genv([(-10, 0), (0, 1), (26, 1), (30, 0)])
    return y*swell()
def r1_t2(c, ctx):  # shoegaze: half-time beat at 91, feedback guitar wall, sub bass, snare in a cathedral
    gtr = ctx.get("guitar")
    wall = S.distort(S.chorus(gtr), 7, 2800) if gtr is not None else S.distort(S.pad(30, segs(c, 1), 100), 5)
    wall = S.reverb(gfade(wall, [(-10, 0), (2, 1), (30, 1)]), "cathedral", 0.55)
    bass = S.sf_render(S.chord_events(bass_segs(c), 100), 30); bass = S.lowpass(S.distort(bass, 3, 900), 400)*genv([(-2, 0), (4, 1), (30, 1)])
    kit = S.drums(BPM[ctx["to"]], g(4), "half", amp=0.9); kit = S.reverb(kit, "cathedral", 0.45)
    prev = S.reverb(S.pad(49, [segs(c)[-1]], 80), "hall", 0.4)*genv([(P0, 0), (P0 + 3, 1), (30, 1)])
    return (wall*0.8 + bass*0.9 + kit*1.0 + prev*0.6)*crescendo(14)
def r1_t3(c, ctx):  # industrial: machine hum on E, metal hits on an 8th grid, clanks, church organ turn/preview
    hum = S.machine_hum(S.hz("E1"), 5.0)*genv([(-10, 0), (-3, 1), (H1, 1), (T1, 0.3), (30, 0.3)])
    kit = S.drums(BPM[ctx["to"]], g(1), "industrial", amp=0.75); kit = S.reverb(kit, "metal", 0.5)
    clank = sum(S.metal_hit(g(t), f, 0.5, seed=i, decay=1.2) for i, (t, f) in enumerate([(-6, 300), (-1, 420), (3, 260), (9, 500)]))
    org = S.pad(19, segs(c)[1:], 84); org = S.reverb(gfade(org, [(H1 - .5, 0), (H1, 1), (30, 1)]), "cathedral", 0.5)
    noise = S.highpass(S.wind(seed=3, lo=800, hi=4000, strength=0.35), 600)*genv([(0, 0), (10, 1), (26, 1), (30, 0)])
    return (hum*0.8 + kit + S.reverb(clank, "metal", 0.6)*0.8 + org*0.9 + noise)*crescendo(12)
def r2_t1(c, ctx):  # wind chimes + wind + slow strings; the chimes thin out as the strings take the preview
    strings = S.reverb(S.pad(49, segs(c), 78), "hall", 0.45)*genv([(-10, 0), (2, 1), (30, 1)])
    ch = S.reverb(S.wind_chimes(c["chimes"], chime_density(1.8, -8), seed=21, amp=0.6), "plate", 0.4)
    return (strings*0.9 + ch*0.8 + S.wind(seed=22, lo=250, hi=2000, strength=0.6))*swell()
def r2_t2(c, ctx):  # music box, steady, fading; vinyl crackle; choir on the preview
    box = S.sf_render(S.arp_events(segs(c, 0), rate=2.0, vel=70, gate=0.8, order="updown"), 10)
    box = S.reverb(gfade(box, [(-10, 0), (-4, 1), (P0, 1), (26, 0.5), (30, 0)]), "hall", 0.45)
    choir = S.reverb(S.pad(52, segs(c)[-1:], 80), "cathedral", 0.5)*genv([(P0, 0), (P0 + 4, 1), (30, 1)])
    return (box*0.9 + S.vinyl(seed=23, amp=0.3) + choir*0.9)*crescendo(16)
def r2_t3(c, ctx):  # smeared ending + rain + distant thunder + heartbeat; bass lands on E for the preview
    bed = gfade(S.stretch_bed(ctx["prev_file"], 3.0, seed=3), [(-10, 0), (-2, 1), (T1, 1), (24, 0)])
    th = S.thunder(g(-7), seed=31, length=7) + S.thunder(g(14), seed=32, length=6)*0.8
    hb = S.heartbeat(60, g(-4), g(29), 0.8)
    prev = S.reverb(S.pad(89, segs(c)[-1:], 84), "hall", 0.5)*genv([(P0, 0), (P0 + 5, 1), (30, 1)])
    return (S.reverb(bed, "cathedral", 0.4) + S.rain(seed=33, density=500)*0.9 + th + hb + prev*0.9 + S.sub("E1", g(P0), DUR, 0.5))*crescendo(14)
def r3_t1(c, ctx):  # guitar swells (melody model) rebuilt: chorus + cathedral, tubular bells toll B then A, no synth drone
    gtr = ctx.get("guitar"); sw = S.reverb(S.chorus(gtr), "cathedral", 0.55) if gtr is not None else S.reverb(S.pad(92, segs(c)), "cathedral", 0.5)
    sw = gfade(sw, [(-10, 0), (0, 1), (P0 + 4, 1), (30, 0.6)])
    bells = S.hits(14, [(g(-8), "B3", 70), (g(2), "B3", 70), (g(10), "B3", 60), (g(P0), "A3", 90), (g(23), "A3", 80), (g(27), "A4", 70)], 6.0)
    prev = S.reverb(S.pad(48, segs(c)[-1:], 72), "hall", 0.4)*genv([(P0 + 1, 0), (P0 + 6, 1), (30, 1)])
    return (sw*0.9 + S.reverb(bells, "cathedral", 0.5)*0.9 + prev*0.7)*swell()
def r3_t2(c, ctx):  # industrial 4/4 at 92: distorted kick, metal snare, flanged noise, square sub B -> E -> A
    kit = S.reverb(S.drums(BPM[ctx["to"]], g(0), "industrial", amp=0.9), "metal", 0.4)
    nz = S.flanger(S.wind(seed=41, lo=400, hi=5000, strength=0.6))*genv([(-10, 0), (-2, 1), (28, 1), (30, 0)])
    sq = sum(S.sub(ns[0].replace("2", "1"), t0, t1 + 0.2, 0.6, 0.6) for t0, t1, ns in segs(c, 0))
    sq = S.distort(sq, 4, 600)
    org = S.reverb(S.pad(19, segs(c)[-1:], 90), "cathedral", 0.5)*genv([(P0, 0), (P0 + 3, 1), (30, 1)])
    return (kit + nz*0.7 + sq*0.8 + org*0.9)*crescendo(12)
def r3_t3(c, ctx):  # church organ chords, wind, reversed cymbals rising into the preview and into the downbeat
    org = S.reverb(S.pad(19, segs(c), 76), "cathedral", 0.55)
    rc = S.reverse_cymbal(g(P0), 4.0, 0.5, seed=51) + S.reverse_cymbal(DUR, 5.0, 0.7, seed=52)
    return (org*0.9 + S.wind(seed=53, lo=120, hi=700, strength=0.7) + S.reverb(rc, "hall", 0.4))*swell()
def r4_t1(c, ctx):  # smeared Looking Glass ending (it ends on A) -> strings turn D major into F# -> feedback guitar on the Bm preview
    bed = gfade(S.stretch_bed(ctx["prev_file"], 3.5, seed=4), [(-10, 0), (-1, 1), (H1 + 2, 1), (P0 + 3, 0)])
    strings = S.reverb(S.pad(49, segs(c)[1:], 80), "hall", 0.45)*genv([(H1 - 1, 0), (H1, 1), (30, 1)])
    gtr = ctx.get("guitar"); fb = S.reverb(S.distort(gtr, 5, 2600), "cathedral", 0.5) if gtr is not None else zeros()
    fb = gfade(fb, [(P0 - 2, 0), (P0 + 3, 1), (30, 1)])
    return (S.reverb(bed, "hall", 0.35) + strings*0.9 + fb*0.7)*swell()
def r4_t2(c, ctx):  # shoegaze at 83 (half of Horrors' 165): tremolo guitar, huge snare, chimes glinting
    gtr = ctx.get("guitar"); wall = S.tremolo(S.chorus(gtr), 6.5, 0.6) if gtr is not None else S.tremolo(S.pad(30, segs(c)), 6.5, 0.6)
    wall = S.reverb(gfade(wall, [(-10, 0), (0, 1), (30, 1)]), "cathedral", 0.55)
    kit = S.reverb(S.drums(BPM[ctx["to"]], g(2), "shoegaze", amp=0.85), "cathedral", 0.5)
    ch = S.reverb(S.wind_chimes(c["chimes"], chime_density(1.0, 0), seed=61, amp=0.35), "plate", 0.5)
    prev = S.reverb(S.pad(89, segs(c)[-1:], 84), "hall", 0.4)*genv([(P0, 0), (P0 + 3, 1), (30, 1)])
    bass = S.lowpass(S.sf_render(S.chord_events(bass_segs(c), 100), 30), 350)*genv([(-2, 0), (3, 1), (30, 1)])
    return (wall*0.8 + kit + ch + prev*0.6 + bass*0.8)*crescendo(14)
def r4_t3(c, ctx):  # piano arpeggio, steady 2 notes/s, rain, distant thunder, no drums; piano fades as the strings preview rises
    pno = S.sf_render(S.arp_events(segs(c, 0), rate=2.0, vel=58, gate=1.5, order="updown"), 0)
    pno = S.reverb(gfade(pno, [(-10, 0), (-5, 1), (P0 + 2, 1), (27, 0.35), (30, 0)]), "hall", 0.5)
    prev = S.reverb(S.pad(49, segs(c)[-1:], 76), "cathedral", 0.5)*genv([(P0, 0), (P0 + 5, 1), (30, 1)])
    return (pno*0.9 + S.rain(seed=71, density=400)*0.45 + S.thunder(g(6), seed=72, length=8)*0.4 + prev*0.9)*crescendo(16)
def r5_t1(c, ctx):  # choir aahs B -> G# -> C#m with tubular bells on the turn, wind underneath
    choir = S.reverb(S.pad(52, segs(c), 82), "cathedral", 0.55)
    bells = S.reverb(S.hits(14, [(g(H1), "G#3", 90), (g(15), "D#4", 70), (g(P0), "C#4", 95), (g(24), "C#4", 70)], 7.0), "cathedral", 0.5)
    return (choir*0.9 + bells*0.8 + S.wind(seed=81, lo=200, hi=1200, strength=0.5))*swell()
def r5_t2(c, ctx):  # industrial drone: hum on B, gated noise at 91, clanks; sub drops to G# then C#; organ preview
    hum = S.machine_hum(S.hz("B1"), 3.5, seed=91)*genv([(-10, 0), (-4, 1), (H1, 1), (T1, 0)])
    kit = S.reverb(S.drums(BPM[ctx["to"]], g(5), "industrial", amp=0.8), "metal", 0.45)
    gate = S.ffx(S.wind(seed=92, lo=300, hi=3000, strength=0.8), f"tremolo=f={BPM[ctx['to']]/60*2:.4f}:d=0.95")*genv([(-6, 0), (0, 1), (28, 1), (30, 0)])
    sq = S.distort(sum(S.sub(ns[0].replace("2", "1"), t0, t1 + 0.2, 0.6, 0.8) for t0, t1, ns in segs(c, 0)), 3, 500)
    org = S.reverb(S.pad(19, segs(c)[-1:], 88), "cathedral", 0.5)*genv([(P0, 0), (P0 + 3, 1), (30, 1)])
    return (hum*0.7 + kit + gate*0.6 + sq*0.8 + org*0.9)*crescendo(12)
def r5_t3(c, ctx):  # smeared Horrors ending + glockenspiel sparks + reversed swell into C#m halo pad
    bed = gfade(S.stretch_bed(ctx["prev_file"], 3.0, seed=5), [(-10, 0), (-2, 1), (H1, 1), (P0 + 2, 0)])
    glk = S.reverb(S.wind_chimes([n.replace("5", "6") for n in c["chimes"]], chime_density(0.9, -6), seed=101, amp=0.4), "hall", 0.5)
    halo = S.reverb(S.pad(94, segs(c)[1:], 84), "cathedral", 0.5)*genv([(H1 - .5, 0), (H1, 1), (30, 1)])
    rc = S.reverse_cymbal(g(P0), 5.0, 0.6, seed=102)
    return (S.reverb(bed, "cathedral", 0.45) + glk + halo*0.9 + S.reverb(rc, "hall", 0.4))*swell()
def r6_t2(c, ctx):  # shoegaze at 120 (Falling): straight 4/4, feedback wall, bass E -> D -> G, snare in a cathedral
    gtr = ctx.get("guitar"); wall = S.distort(S.chorus(gtr), 7, 3000) if gtr is not None else S.distort(S.pad(30, segs(c)), 6)
    wall = S.reverb(gfade(wall, [(-10, 0), (1, 1), (30, 1)]), "cathedral", 0.5)
    kit = S.reverb(S.drums(BPM[ctx["to"]], g(5), "shoegaze", amp=0.9), "cathedral", 0.5)
    bass = S.lowpass(S.distort(S.sf_render(S.chord_events(bass_segs(c), 100), 30), 3, 900), 400)*genv([(-1, 0), (5, 1), (30, 1)])
    prev = S.reverb(S.pad(49, segs(c)[-1:], 80), "hall", 0.4)*genv([(P0, 0), (P0 + 3, 1), (30, 1)])
    return (wall*0.8 + kit + bass*0.9 + prev*0.6)*crescendo(14)
def r6_t3(c, ctx):  # wind chimes in E/G, wind, bowed glass; thunder at 26; sub D under the turn, G under the preview
    glass = S.reverb(S.pad(92, segs(c), 80), "hall", 0.5)
    ch = S.reverb(S.wind_chimes(c["chimes"], chime_density(1.5, -8), seed=111, amp=0.55), "plate", 0.45)
    return (glass*0.9 + ch*0.8 + S.wind(seed=112, lo=300, hi=2500, strength=0.6) + S.thunder(g(22), seed=113, length=7)*0.7)*swell()
def r7_t1(c, ctx):  # smeared Falling ending -> dark strings on C with Ab/Eb -> F minor; rain; the "darkening" cue
    bed = gfade(S.stretch_bed(ctx["prev_file"], 3.0, seed=7), [(-10, 0), (-1, 1), (H1 + 1, 1), (P0 + 2, 0)])
    dark = [(g(H1), g(T1), ["C3","G3","D#4","G#4"]), (g(P0), DUR, c["prev"][1:])]
    strings = S.reverb(S.pad(49, dark, 80), "cathedral", 0.55)*genv([(H1 - .5, 0), (H1, 1), (30, 1)])
    return (S.reverb(bed, "hall", 0.4) + strings*0.9 + S.rain(seed=121, density=450)*0.9 + S.sub("C1", g(H1), g(P0 + 1), 0.5) + S.sub("F1", g(P0 + 1), DUR, 0.5))*swell()
def r7_t2(c, ctx):  # industrial 4/4 at 120: pounding kick, metal hits, noise sweeps, sub C; organ stab C major before the downbeat
    kit = S.reverb(S.drums(BPM[ctx["to"]], g(0), "industrial", amp=0.95), "metal", 0.4)
    sweep = S.reverb(S.reverse_cymbal(g(H1), 6, 0.6, seed=131) + S.reverse_cymbal(DUR, 7, 0.8, seed=132, bright=9000), "hall", 0.4)
    sq = S.distort(S.sub("C1", g(-2), g(P0), 0.7, 1.0) + S.sub("F1", g(P0), DUR, 0.7, 0.6), 4, 700)
    stab = S.reverb(S.pad(19, [(g(27.5), g(29.6), ["C3","E3","G3","C4"])], 110), "cathedral", 0.5)
    prev = S.reverb(S.pad(89, segs(c)[-1:], 84), "hall", 0.4)*genv([(P0, 0), (P0 + 3, 1), (30, 1)])
    gtr = ctx.get("guitar"); wall = S.reverb(S.distort(gtr, 6, 2600), "cathedral", 0.5)*genv([(-10, 0), (0, 1), (30, 1)]) if gtr is not None else zeros()
    return (kit + sweep + sq*0.8 + stab*0.8 + prev*0.6 + wall*0.6)*crescendo(12)
def r7_t3(c, ctx):  # celesta descending steps, steady, fading; vinyl; choir takes F minor
    cel = S.sf_render(S.arp_events(segs(c, 0), rate=1.5, vel=64, gate=1.2, order="up"), 8)
    cel = S.reverb(gfade(cel, [(-10, 0), (-5, 1), (P0 + 2, 1), (26, 0.4), (30, 0)]), "hall", 0.5)
    choir = S.reverb(S.pad(52, segs(c)[-1:], 84), "cathedral", 0.55)*genv([(P0, 0), (P0 + 4, 1), (30, 1)])
    return (cel*0.9 + S.vinyl(seed=141, amp=0.3) + choir*0.9 + S.wind(seed=142, lo=150, hi=900, strength=0.35))*crescendo(16)
def r8_t1(c, ctx):  # church bell tolls C (how the song ends) then C#, low strings, wind
    bells = S.church_bell(S.hz("C3"), g(-6), 9, 0.6) + S.church_bell(S.hz("C3"), g(2), 9, 0.5) + S.church_bell(S.hz("C#3"), g(P0), 11, 0.7) + S.church_bell(S.hz("C#3"), g(25), 9, 0.5)
    strings = S.reverb(S.pad(49, segs(c), 74), "cathedral", 0.5)*genv([(-10, 0), (4, 1), (30, 1)])
    return (S.reverb(bells, "cathedral", 0.5)*0.9 + strings*0.8 + S.wind(seed=151, lo=120, hi=800, strength=0.6))*swell()
def r8_t2(c, ctx):  # punk lead-in at Helena's 125: straight 4/4 shoegaze kit, feedback wall, bass F -> A -> G# -> C#
    gtr = ctx.get("guitar"); wall = S.distort(S.chorus(gtr), 7, 3000) if gtr is not None else S.distort(S.pad(30, segs(c)), 6)
    wall = S.reverb(gfade(wall, [(-10, 0), (0, 1), (30, 1)]), "cathedral", 0.5)
    kit = S.reverb(S.drums(BPM[ctx["to"]], g(3), "shoegaze", amp=0.95), "hall", 0.45)
    bass = S.lowpass(S.distort(S.sf_render(S.chord_events(bass_segs(c), 100), 30), 3, 900), 420)*genv([(-1, 0), (4, 1), (30, 1)])
    prev = S.reverb(S.pad(49, segs(c)[-1:], 82), "hall", 0.4)*genv([(P0, 0), (P0 + 3, 1), (30, 1)])
    return (wall*0.8 + kit + bass*0.9 + prev*0.6)*crescendo(12)
def r8_t3(c, ctx):  # smeared Can't You See ending + chimes in C# minor + heartbeat + halo pad on the preview
    bed = gfade(S.stretch_bed(ctx["prev_file"], 3.0, seed=8), [(-10, 0), (-2, 1), (H1, 1), (P0 + 2, 0)])
    ch = S.reverb(S.wind_chimes(c["chimes"], chime_density(1.4, 2), seed=161, amp=0.5), "plate", 0.45)
    halo = S.reverb(S.pad(94, segs(c)[1:], 84), "cathedral", 0.5)*genv([(H1 - .5, 0), (H1, 1), (30, 1)])
    return (S.reverb(bed, "cathedral", 0.45) + ch*0.8 + halo*0.9 + S.heartbeat(60, g(-6), g(28), 0.6))*swell()

RECIPES = {
 (1,1): ("stretch + piano + wind", r1_t1), (1,2): ("shoegaze half-time 91", r1_t2), (1,3): ("industrial hum + organ", r1_t3),
 (2,1): ("chimes + strings + wind", r2_t1), (2,2): ("music box + vinyl + choir", r2_t2), (2,3): ("stretch + rain + thunder + heartbeat", r2_t3),
 (3,1): ("guitar swells + bells", r3_t1), (3,2): ("industrial 4/4 92 + organ", r3_t2), (3,3): ("church organ + wind + reverse cymbals", r3_t3),
 (4,1): ("stretch + strings + feedback", r4_t1), (4,2): ("shoegaze 83 + tremolo guitar + chimes", r4_t2), (4,3): ("piano + rain + thunder", r4_t3),
 (5,1): ("choir + tubular bells + wind", r5_t1), (5,2): ("industrial drone 91 + organ", r5_t2), (5,3): ("stretch + glockenspiel + halo", r5_t3),
 (6,2): ("shoegaze 4/4 120 + feedback", r6_t2), (6,3): ("chimes + bowed glass + thunder", r6_t3),
 (7,1): ("stretch + dark strings + rain", r7_t1), (7,2): ("industrial 4/4 120 + organ stab", r7_t2), (7,3): ("celesta + vinyl + choir", r7_t3),
 (8,1): ("church bell + strings + wind", r8_t1), (8,2): ("shoegaze 4/4 125 + feedback", r8_t2), (8,3): ("stretch + chimes + heartbeat", r8_t3),
}
GUITAR = {(1,2): "gap01-raw-F", (3,1): "gap03-T1-E-raw", (4,1): "gap04-T2-F-raw", (4,2): "gap04-T2-F-raw",
          (6,2): "gap06-raw-F", (7,2): "gap07-raw-E", (8,2): "gap08-raw-F"}
def guitar(name):
    p = os.path.join(S.TMP, name + ".wav")
    if not os.path.exists(p): return None
    x, sr = sf.read(p); x = x if x.ndim > 1 else np.stack([x, x], 1)
    q = os.path.join(S.TMP, "gtr40.wav"); sf.write(os.path.join(S.TMP, "gtr_in.wav"), x, sr)
    S.subprocess.run(["ffmpeg","-y","-v","error","-i",os.path.join(S.TMP, "gtr_in.wav"),"-af",f"rubberband=tempo={(len(x)/sr)/DUR:.6f},aresample={SR}",q])
    y, _ = sf.read(q); y = y[:S.N]; return np.pad(y, ((0, S.N - len(y)), (0, 0)))
def master(y, path):
    y = y - y.mean(0); y *= min(1.0, 0.95/np.abs(y).max())
    tmp = path + ".pre.wav"; lim = path + ".lim.wav"; sf.write(tmp, y, SR, subtype="PCM_24")
    S.subprocess.run(["ffmpeg","-y","-v","error","-i",tmp,"-af","alimiter=limit=0.5:attack=3:release=80:level=false","-c:a","pcm_s24le",lim])
    build.loudnorm(lim, path); os.remove(tmp); os.remove(lim)
def main(gaps):
    project.ensure_track("Transitions 3", muted=False)
    songs = project.songs(); gps = build.gaps()
    for gp in gps:
        gi = gp["idx"]
        if gi not in gaps: continue
        c = CH[gi]; pos = gp["start"] - S.PRE
        for slot in (1, 2, 3):
            if (gi, slot) not in RECIPES: continue
            label, fn = RECIPES[(gi, slot)]
            ctx = dict(prev_file=os.path.join(S.HERE, gp["prev_file"]) if gp["prev_file"] else None, to=gp["to"], frm=gp["frm"])
            if (gi, slot) in GUITAR: ctx["guitar"] = guitar(GUITAR[(gi, slot)])
            rel = f"media/transitions/v2/gap{gi:02d}-T{slot}.wav"; print(f"gap {gi} T{slot}: {label}", flush=True)
            y = fn(c, ctx); y = y*S.env([(0, 1), (DUR - 0.8, 1), (DUR, 0)])[:, None]
            master(y, os.path.join(S.HERE, rel))
            name = f"{gi:02d} {gp['frm']} → {gp['to']} · {label}"
            project.remove_items(f"Transitions {slot}", f"{gi:02d} ")
            print("  ", project.put_item(f"Transitions {slot}", name, rel, pos), name, flush=True)
if __name__ == "__main__":
    main([int(a) for a in sys.argv[1:]] or list(range(1, 9)))
