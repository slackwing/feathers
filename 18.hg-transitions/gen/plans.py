"""Harmonic plans for every gap in the set list (times are seconds relative to
the gap start; the piece begins PRE seconds earlier, under the previous song's tail).
Each voice: (note, [(time, amplitude), ...]). From keys.md: Hold -> Lead-in -> Land."""
PRE, GAP, DUR, FADE_IN = 10.0, 30.0, 40.0, 18.0
S = -PRE  # piece start
PLANS = {
 1: dict(frm="Phantom", to="Talking to Trees", key_to="F# minor", hold=["E2","B3"], lead=["C#2","G#3"],
    voices=[("E2",[(S,.9),(18,.9),(23,0)]),("E3",[(S,.5),(18,.5),(22,0)]),("B3",[(S,.3),(27,.3),(29.5,0)]),
            ("B2",[(17,0),(21,.6),(25,.6),(28,0)]),("C#2",[(24,0),(27.5,.9),(29.6,.9),(30,0)]),("G#3",[(25,0),(28,.3),(29.6,.3),(30,0)])]),
 2: dict(frm="Talking to Trees", to="Enantiodromia", key_to="E minor", hold=["F#2","B3"], lead=["B2","F#3"],
    voices=[("F#2",[(S,.9),(18,.9),(23,0)]),("F#3",[(S,.5),(18,.5),(22,0)]),("B3",[(S,.3),(29.5,.3),(30,0)]),
            ("E3",[(17,0),(21,.5),(29.5,.5),(30,0)]),("B2",[(24,0),(27.5,.9),(29.6,.9),(30,0)])]),
 3: dict(frm="Enantiodromia", to="Looking Glass", key_to="D minor", hold=["E2","A3"], lead=["A2","E3"],
    voices=[("E2",[(S,.9),(18,.9),(23,0)]),("E3",[(S,.5),(18,.5),(22,0)]),("A3",[(S,.3),(29.5,.3),(30,0)]),
            ("D3",[(17,0),(21,.5),(29.5,.5),(30,0)]),("A2",[(24,0),(27.5,.9),(29.6,.9),(30,0)]),("E3",[(25,0),(28,.3),(29.6,.3),(30,0)])]),
 4: dict(frm="Looking Glass", to="Horrors of your love", key_to="B minor", hold=["D2","A3"], lead=["F#2","C#3"],
    voices=[("D2",[(S,.9),(24,.9),(28,0)]),("D3",[(S,.5),(18,.5),(23,0)]),("A3",[(S,.3),(27,.3),(29.5,0)]),
            ("F#3",[(17,0),(21,.5),(29.5,.5),(30,0)]),("F#2",[(24,0),(27.5,.9),(29.6,.9),(30,0)]),("C#3",[(25,0),(28,.3),(29.6,.3),(30,0)])]),
 5: dict(frm="Horrors of your love", to="The Beacon of Emerald", key_to="C# minor", hold=["B2","F#3"], lead=["G#2","D#3"],
    voices=[("B2",[(S,.9),(24,.9),(28,0)]),("B3",[(S,.5),(18,.5),(23,0)]),("F#3",[(S,.3),(27,.3),(29.5,0)]),
            ("C#3",[(17,0),(21,.5),(29.5,.5),(30,0)]),("G#2",[(24,0),(27.5,.9),(29.6,.9),(30,0)]),("D#3",[(25,0),(28,.3),(29.6,.3),(30,0)])]),
 6: dict(frm="The Beacon of Emerald", to="Falling", key_to="G major", hold=["E2","B3"], lead=["D2","A3"],
    voices=[("E2",[(S,.9),(24,.9),(28,0)]),("E3",[(S,.5),(18,.5),(23,0)]),("B3",[(S,.3),(27,.3),(29.5,0)]),
            ("D3",[(17,0),(21,.55),(29.5,.55),(30,0)]),("D2",[(24,0),(27.5,.9),(29.6,.9),(30,0)]),("A3",[(25,0),(28,.3),(29.6,.3),(30,0)])]),
 7: dict(frm="Falling", to="Can't You See", key_to="F minor", hold=["C2","G3"], lead=["C2","G3","E3"],
    voices=[("C2",[(S,.9),(26,.9),(29.6,.9),(30,0)]),("C3",[(S,.5),(18,.5),(23,0)]),("G3",[(S,.3),(29.5,.3),(30,0)]),
            ("G#3",[(17,0),(21,.4),(26,.4),(29,0)]),("D#3",[(19,0),(23,.35),(26,.35),(29,0)]),("E3",[(26,0),(28,.4),(29.6,.4),(30,0)])]),
 8: dict(frm="Can't You See", to="Helena", key_to="C# minor", hold=["C2","G#3"], lead=["G#2","D#3"],
    voices=[("C2",[(S,.9),(18,.9),(23,0)]),("C3",[(S,.4),(17,.4),(21,0)]),("G#3",[(S,.3),(29.5,.3),(30,0)]),
            ("G#2",[(17,0),(21,.9),(29.6,.9),(30,0)]),("D#3",[(25,0),(28,.3),(29.6,.3),(30,0)])]),
 9: dict(frm="Helena", to="The Ghost of You", key_to="B minor", hold=["C#2","F#3"], lead=["F#2","C#3"],
    voices=[("C#2",[(S,.9),(24,.9),(28,0)]),("C#3",[(S,.5),(18,.5),(23,0)]),("F#3",[(S,.3),(29.5,.3),(30,0)]),
            ("B3",[(17,0),(21,.5),(29.5,.5),(30,0)]),("F#2",[(24,0),(27.5,.9),(29.6,.9),(30,0)]),("C#3",[(25,0),(28,.3),(29.6,.3),(30,0)])]),
 10: dict(frm="The Ghost of You", to="Disordered Hearts", key_to="F# minor", hold=["B2","F#3"], lead=["C#2","C#3"],
    voices=[("B2",[(S,.9),(18,.9),(23,0)]),("B3",[(S,.5),(18,.5),(22,0)]),("F#3",[(S,.3),(29.5,.3),(30,0)]),
            ("F#2",[(17,0),(21,.8),(26,.8),(29,0)]),("C#3",[(22,0),(26,.5),(29.6,.5),(30,0)]),("C#2",[(25,0),(28,.9),(29.6,.9),(30,0)])]),
}
# BPM for the pulse style: published for the covers, estimated (gen/tempo.py) for ours.
BPM_PUBLISHED = {"Helena": 125, "The Ghost of You": 145}
STYLES = {  # track name -> (description, muted by default)
 "A": ("A · pad",          False),
 "B": ("B · continuation", True),
 "C": ("C · pulse",        True),
 "D": ("D · riser",        True),
 "E": ("E · guitar swells",True),
 "F": ("F · feedback",     True),
}
