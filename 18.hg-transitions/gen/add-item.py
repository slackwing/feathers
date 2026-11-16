#!/usr/bin/env python3
"""Insert an audio item into setlist.RPP on a named track, in place.
    gen/add-item.py "Transitions 1" media/transitions/x.wav POSITION_SECONDS "Item name"
"""
import sys, os, re, uuid, wave
track, path, pos, name = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4]
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rpp = os.path.join(here, "setlist.RPP")
with wave.open(os.path.join(here, path)) as w: length = w.getnframes()/w.getframerate()
g = lambda: "{" + str(uuid.uuid4()).upper() + "}"
item = f'''    <ITEM
      POSITION {pos:.6f}
      SNAPOFFS 0
      LENGTH {length:.6f}
      LOOP 0
      ALLTAKES 0
      FADEIN 1 0.01 0 1 0 0 0
      FADEOUT 1 0.01 0 1 0 0 0
      MUTE 0 0
      SEL 0
      IGUID {g()}
      IID 1
      NAME "{name}"
      VOLPAN 1 0 1 -1
      SOFFS 0
      PLAYRATE 1 1 0 -1 0 0.0025
      CHANMODE 0
      GUID {g()}
      <SOURCE WAVE
        FILE "{path}"
      >
    >
'''
lines = open(rpp).read().split("\n")
# find the track block whose NAME matches, then its closing "  >" (2-space indent)
start = next(i for i, l in enumerate(lines) if l.strip() == f'NAME "{track}"')
end = next(i for i in range(start, len(lines)) if lines[i] == "  >")
lines[end:end] = item.rstrip("\n").split("\n")
open(rpp, "w").write("\n".join(lines))
print(f"added {name!r} ({length:.1f}s) at {pos:.2f}s on {track!r}")
