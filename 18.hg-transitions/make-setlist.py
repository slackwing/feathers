#!/usr/bin/env python3
"""Build a Reaper project from a set list.

    ./make-setlist.py setlist.txt            # one song per line (# comments ok)
    ./make-setlist.py Falling Phantom ...    # or names as arguments
    ./make-setlist.py -g 45 -o shows/nov.RPP setlist.txt

Track 1 "Songs": every song back to back with GAP seconds of silence between
them. Then EXTRA empty tracks for the transitions. A marker at each song start.
Names match case-insensitively against media/<release>/NN - <title>.wav
(alternates/ only when the name contains a '/').
"""
import argparse, os, re, sys, time, uuid, wave

HERE = os.path.dirname(os.path.abspath(__file__))
MEDIA = os.path.join(HERE, "media")

def norm(s): return re.sub(r"[^a-z0-9]", "", s.lower())
def guid(): return "{" + str(uuid.uuid4()).upper() + "}"

def catalog():
    out = []
    for root, _, files in os.walk(MEDIA):
        for f in sorted(files):
            if not f.lower().endswith(".wav"): continue
            path = os.path.join(root, f)
            rel = os.path.relpath(path, MEDIA)
            title = re.sub(r"^\d+ - ", "", f[:-4])
            out.append((title, rel, path))
    return out

def duration(path):
    with wave.open(path) as w: return w.getnframes() / w.getframerate()

def find(name, cat):
    q = norm(name)
    pool = cat if "/" in name else [c for c in cat if not c[1].startswith("alternates/")]
    key = (lambda c: norm(c[1])) if "/" in name else (lambda c: norm(c[0]))
    exact = [c for c in pool if key(c) == q]
    if len(exact) == 1: return exact[0]
    sub = [c for c in pool if q in key(c)]
    if len(sub) == 1: return sub[0]
    if not sub: sys.exit(f"no match for {name!r}")
    sys.exit(f"ambiguous {name!r}: " + ", ".join(c[1] for c in sub))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("songs", nargs="+", help="set list file, or song names")
    ap.add_argument("-g", "--gap", type=float, default=30.0, help="seconds between songs (30)")
    ap.add_argument("-o", "--out", default=os.path.join(HERE, "setlist.RPP"))
    ap.add_argument("-x", "--extra", type=int, default=2, help="empty transition tracks (2)")
    a = ap.parse_args()
    names = a.songs
    if len(names) == 1 and os.path.isfile(names[0]):
        names = [l.split("#")[0].strip() for l in open(names[0])]
        names = [n for n in names if n]
    cat = catalog()
    out = os.path.abspath(a.out)
    outdir = os.path.dirname(out)
    os.makedirs(outdir, exist_ok=True)

    items, markers, pos = [], [], 0.0
    for i, name in enumerate(names, 1):
        title, rel, path = find(name, cat)
        dur = duration(path)
        file = os.path.relpath(path, outdir)
        markers.append(f'  MARKER {i} {pos:.6f} "{title}" 0 0 1 R {guid()} 0')
        items.append(f'''    <ITEM
      POSITION {pos:.6f}
      SNAPOFFS 0
      LENGTH {dur:.6f}
      LOOP 0
      ALLTAKES 0
      FADEIN 1 0.01 0 1 0 0 0
      FADEOUT 1 0.01 0 1 0 0 0
      MUTE 0 0
      SEL 0
      IGUID {guid()}
      IID {i}
      NAME "{title}"
      VOLPAN 1 0 1 -1
      SOFFS 0
      PLAYRATE 1 1 0 -1 0 0.0025
      CHANMODE 0
      GUID {guid()}
      <SOURCE WAVE
        FILE "{file}"
      >
    >''')
        print(f"{i:2d}. {pos/60:6.2f} min  {title}  ({dur:.0f}s)  <- {rel}")
        pos += dur + a.gap
    print(f"    {pos/60:6.2f} min  end")

    def track(name, body=""):
        return f'''  <TRACK {guid()}
    NAME "{name}"
    PEAKCOL 16576
    BEAT -1
    AUTOMODE 0
    VOLPAN 1 0 -1 -1 1
    MUTESOLO 0 0 0
    IPHASE 0
    PLAYOFFS 0 1
    ISBUS 0 0
    BUSCOMP 0 0 0 0 0
    SHOWINMIX 1 0.6667 0.5 1 0.5 0 0 0
    SEL 0
    REC 0 0 1 0 0 0 0 0
    VU 2
    TRACKHEIGHT 0 0 0 0 0 0 0
    INQ 0 0 0 0.5 100 0 0 100
    NCHAN 2
    FX 1
    TRACKID {guid()}
    PERF 0
    MIDIOUT -1
    MAINSEND 1 0
{body}
  >'''
    tracks = [track("Songs", "\n".join(items))]
    tracks += [track(f"Transitions {k}" if a.extra > 1 else "Transitions") for k in range(1, a.extra + 1)]

    rpp = f'''<REAPER_PROJECT 0.1 "7.0/linux-x86_64" {int(time.time())}
  RIPPLE 0
  GROUPOVERRIDE 0 0 0
  AUTOXFADE 1
  ENVATTACH 3
  POOLEDENVATTACH 0
  MIXERUIFLAGS 11 48
  PEAKGAIN 1
  FEEDBACK 0
  PANLAW 1
  PROJOFFS 0 0 0
  MAXPROJLEN 0 600
  GRID 3199 8 1 8 1 0 0 0
  TIMEMODE 0 5 -1 30 0 0 -1
  VIDEO_CONFIG 0 0 256
  PANMODE 3
  CURSOR 0
  ZOOM 1 0 0
  VZOOMEX 6 0
  USE_REC_CFG 0
  RECMODE 1
  SMPTESYNC 0 30 100 40 1000 300 0 0 1 0 0
  LOOP 0
  LOOPGRAN 0 4
  RECORD_PATH "" ""
  <RECORD_CFG
  >
  <APPLYFX_CFG
  >
  RENDER_FILE ""
  RENDER_PATTERN ""
  RENDER_FMT 0 2 0
  RENDER_1X 0
  RENDER_RANGE 1 0 0 18 1000
  RENDER_RESAMPLE 3 0 1
  RENDER_ADDTOPROJ 0
  RENDER_STEMS 0
  RENDER_DITHER 0
  TIMELOCKMODE 1
  TEMPOENVLOCKMODE 1
  ITEMMIX 1
  DEFPITCHMODE 589824 0
  TAKELANE 1
  SAMPLERATE 48000 0 0
  <RENDER_CFG
  >
  LOCK 1
  <METRONOME 6 2
    VOL 0.25 0.125
    FREQ 800 1600 1
    BEATLEN 4
    SAMPLES "" ""
    PATTERN 2863311530 2863311529
    MULT 1
  >
  GLOBAL_AUTO -1
  TEMPO 120 4 4
  PLAYRATE 1 0 0.25 4
  SELECTION 0 0
  SELECTION2 0 0
  MASTERAUTOMODE 0
  MASTERTRACKHEIGHT 0 0
  MASTERPEAKCOL 16576
  MASTERMUTESOLO 0
  MASTERTRACKVIEW 0 0.6667 0.5 0.5 0 0 0 0 0 0 0 0 0 0
  MASTERHWOUT 0 0 1 0 0 0 0 -1
  MASTER_NCH 2 2
  MASTER_VOLUME 1 0 -1 -1 1
  MASTER_PANMODE 3
  MASTER_FX 1
  MASTER_SEL 0
{chr(10).join(markers)}
{chr(10).join(tracks)}
>
'''
    with open(out, "w") as f: f.write(rpp)
    print(f"wrote {out}")

if __name__ == "__main__":
    main()
