"""In-place edits of setlist.RPP: read song positions, ensure/rename tracks, add or replace items by name."""
import os, re, uuid, wave
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RPP = os.path.join(HERE, "setlist.RPP")
def _g(): return "{" + str(uuid.uuid4()).upper() + "}"
def _lines(): return open(RPP).read().split("\n")
def _save(L): open(RPP, "w").write("\n".join(L))
def _tracks(L):
    """-> list of (name, start, end) for each top-level <TRACK block."""
    out = []; i = 0
    while i < len(L):
        if L[i].startswith("  <TRACK"):
            j = next(k for k in range(i, len(L)) if L[k] == "  >")
            name = next((l.strip()[6:-1] for l in L[i:j] if l.strip().startswith('NAME "')), "")
            out.append((name, i, j)); i = j
        i += 1
    return out
def songs():
    """Items on the Songs track -> [(name, pos, length, file-or-None)] in order."""
    L = _lines(); name, s, e = next(t for t in _tracks(L) if t[0] == "Songs"); out = []
    for i in range(s, e):
        if L[i].strip() == "<ITEM":
            j = next(k for k in range(i, e) if L[k] == "    >")
            blk = [l.strip() for l in L[i:j]]
            get = lambda key: next((l[len(key)+1:] for l in blk if l.startswith(key+" ")), None)
            f = get("FILE"); out.append((get("NAME").strip('"'), float(get("POSITION")), float(get("LENGTH")), f.strip('"') if f else None))
    return sorted(out, key=lambda x: x[1])
def rename_track(old, new):
    L = _lines()
    for name, s, e in _tracks(L):
        if name == old:
            for i in range(s, e):
                if L[i].strip() == f'NAME "{old}"': L[i] = f'    NAME "{new}"'
    _save(L)
def ensure_track(name, muted=False):
    L = _lines()
    if any(t[0] == name for t in _tracks(L)):
        for n, s, e in _tracks(L):
            if n == name:
                for i in range(s, e):
                    if L[i].strip().startswith("MUTESOLO "): L[i] = f"    MUTESOLO {1 if muted else 0} 0 0"
        _save(L); return
    blk = f'''  <TRACK {_g()}
    NAME "{name}"
    PEAKCOL 16576
    BEAT -1
    AUTOMODE 0
    VOLPAN 1 0 -1 -1 1
    MUTESOLO {1 if muted else 0} 0 0
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
    TRACKID {_g()}
    PERF 0
    MIDIOUT -1
    MAINSEND 1 0
  >'''.split("\n")
    end = max(i for i, l in enumerate(L) if l == ">")  # project close
    L[end:end] = blk; _save(L)
def put_item(track, name, path, pos):
    """Add an item named `name` on `track`, or update its file/position/length if it exists."""
    with wave.open(os.path.join(HERE, path)) as w: length = w.getnframes()/w.getframerate()
    L = _lines(); tname, s, e = next(t for t in _tracks(L) if t[0] == track)
    for i in range(s, e):
        if L[i].strip() == f'NAME "{name}"':
            a = max(k for k in range(s, i) if L[k].strip() == "<ITEM"); b = next(k for k in range(i, e) if L[k] == "    >")
            for k in range(a, b):
                st = L[k].strip()
                if st.startswith("POSITION "): L[k] = f"      POSITION {pos:.6f}"
                elif st.startswith("LENGTH "): L[k] = f"      LENGTH {length:.6f}"
                elif st.startswith("FILE "): L[k] = f'        FILE "{path}"'
            _save(L); return "updated"
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
      IGUID {_g()}
      IID 1
      NAME "{name}"
      VOLPAN 1 0 1 -1
      SOFFS 0
      PLAYRATE 1 1 0 -1 0 0.0025
      CHANMODE 0
      GUID {_g()}
      <SOURCE WAVE
        FILE "{path}"
      >
    >'''.split("\n")
    L[e:e] = item; _save(L); return "added"
def remove_items(track, name_prefix, keep=()):
    """Delete items on `track` whose NAME starts with name_prefix (except names in keep)."""
    L = _lines(); tname, s, e = next(t for t in _tracks(L) if t[0] == track); i = s; removed = 0
    while i < e:
        if L[i].strip() == "<ITEM":
            j = next(k for k in range(i, e) if L[k] == "    >")
            name = next((l.strip()[6:-1] for l in L[i:j] if l.strip().startswith('NAME "')), "")
            if name.startswith(name_prefix) and name not in keep:
                del L[i:j+1]; e -= (j + 1 - i); removed += 1; continue
        i += 1
    _save(L); return removed
