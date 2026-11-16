# Song keys and transitions

Keys estimated from the YouTube audio (chroma vs Krumhansl key profiles,
checked against two songs of known key). Strong = clear, Weak = could be the
relative major/minor instead. "Ends on" is the last 30 s, "Starts" the first.

## Set list (2026-11-15)

| # | Song | Key | Confidence | Starts | Ends on |
|---|---|---|---|---|---|
| 1 | Phantom | E minor | moderate | E (major-leaning) | E minor |
| 2 | Talking to Trees | F# minor | moderate | C# | F# minor (weak) |
| 3 | Enantiodromia | E minor | strong | E minor | E minor |
| 4 | Looking Glass | D minor | weak | A minor-ish | A major |
| 5 | Horrors of your love | B minor | moderate | B minor | B minor |
| 6 | The Beacon of Emerald | C# minor | strong | C# minor | C# minor |
| 7 | Falling | G major | strong | G | G |
| 8 | Can't You See | F minor | moderate | F minor | C |
| 9 | Helena (cover) | C# minor | published, original recording | | |
| 10 | The Ghost of You (cover) | B minor | published, original recording | | |
| 11 | Disordered Hearts | F# minor | strong | F# minor | F# minor |

## Transitions

Hold = a note both keys share, sustain it across the seam. Lead-in = the note
that pulls into the next song (its 5th). Land = the next song's root.

| From → To | Relationship | Hold | Lead-in | Land | Watch out |
|---|---|---|---|---|---|
| Phantom → Talking to Trees | up a whole step, 5 shared notes | B | C# | F# | C# is new (E minor has C) |
| Talking to Trees → Enantiodromia | down a whole step | B | B | E | G# (old) vs G (new) |
| Enantiodromia → Looking Glass | down a whole step | A | A | D | F#→F, B→Bb |
| Looking Glass → Horrors of your love | D is the relative major of B minor | D | F# | B | add F# to turn D minor into D major first |
| Horrors of your love → The Beacon of Emerald | up a whole step | F# or E | G# | C# | G# is new |
| The Beacon of Emerald → Falling | distant (tritone roots) | E | D | G | let G# fade, bring in G natural, then D |
| Falling → Can't You See | very distant | C | C | F | darken C with Ab/Eb before landing on F |
| Can't You See → Helena | half-step lift, 3 shared notes | Ab (= G#) | G# | C# | bass C → C# at the seam |
| Helena → The Ghost of You | down a whole step | F# | F# | B | G# (old) vs G (new) |
| The Ghost of You → Disordered Hearts | closest pair, 6 shared notes | F# | C# | F# | G → G# |

## Rest of the catalog

| Song | Key | Confidence | Notes |
|---|---|---|---|
| Sanitarium | E major | moderate | |
| Blue Iris | E minor | strong | G major close |
| Tamsa | G major | moderate | ends in B minor |
| Madhouse Blues | E minor | moderate | |
| The Cave | G# minor | weak | starts B, ends on D# |
| Synchronicity | C# minor | strong | starts G# minor |
| Free | C minor | strong | |
| Final Stretch | G minor | strong | |
| The End | A minor | weak | odd ending |
| Malleus Maleficarum | A minor | strong | ends on F |
| Rumination | B minor | weak | G major possible |
| Quincunx | E minor | moderate | starts G, ends B minor |
| Nee Heavy | D minor | moderate | |

## Transition options v2 (2026-11-16)

Three options per gap (1-8) on "Transitions 1/2/3"; gaps 9-10 dropped.
Files: `media/transitions/v2/gapNN-T<slot>.wav`, 40 s each: starts 10 s under the
previous song's tail, lands on the next downbeat. Shape (gap-relative seconds):
**-10..13 hold** = how the previous song actually ends (often its last chord
smeared with paulstretch); **13..17 turn** = a short pivot; **17..30 preview** =
the chord the next song really opens on, swelling into the downbeat. Beats are
4/4 at the next song's tempo, bar-aligned to the downbeat, never accelerating.
Rebuild: `.venv/bin/python gen/recipes.py [gap ...]` (needs `media/sf2/MuseScore_General.sf2`,
the melody-model guitar takes in `media/transitions/.tmp/`, see `gen/melody_for.py`).

| Gap | Hold → Turn → Preview | T1 | T2 | T3 |
|---|---|---|---|---|
| 1 Phantom → Talking to Trees | Em → G# → C# | smeared ending + piano + wind | shoegaze half-time 91 + feedback | industrial hum + metal 8ths + organ |
| 2 Talking to Trees → Enantiodromia | D → B → E | wind chimes + strings + wind | music box + vinyl + choir | smeared ending + rain + thunder + heartbeat |
| 3 Enantiodromia → Looking Glass | B → E → A | guitar swells + tubular bells | industrial 4/4 92 + organ | church organ + wind + reverse cymbals |
| 4 Looking Glass → Horrors | A → F# → Bm | smeared ending + strings + feedback | shoegaze 83 + tremolo guitar + chimes | piano + rain + thunder |
| 5 Horrors → Beacon | B → G# → C#m | choir + tubular bells + wind | industrial drone 91 + organ | smeared ending + glockenspiel + halo pad |
| 6 Beacon → Falling | C#m → D → G | v3 (kept) | shoegaze 4/4 120 + feedback | wind chimes + bowed glass + thunder |
| 7 Falling → Can't You See | B → C(+Ab/Eb) → Fm | smeared ending + dark strings + rain | industrial 4/4 120 + organ stab | celesta + vinyl + choir |
| 8 Can't You See → Helena | F → A → G# → C#m | church bell + strings + wind | shoegaze 4/4 125 + feedback | smeared ending + chimes + heartbeat |

Measured (first 3 s / last 6 s of each song): Phantom opens E, ends Em; Talking to
Trees opens C#, ends on D; Enantiodromia opens E, ends on B; Looking Glass opens A,
ends on A; Horrors opens Bm, ends on B; Beacon opens and ends C#m; Falling opens G,
ends on B; Can't You See opens Fm, ends on F.

## Transition options v1 (2026-11-15, superseded)

Two options per gap, on tracks "Transitions 1" and "Transitions 2", each
40 s: it starts 10 s before the previous song ends (swelling under its tail)
and lands on the next song's downbeat. Files: `media/transitions/gapNN-T<slot>-<style>.wav`.
Rebuild bases with `.venv/bin/python gen/build.py bases`; AI layers with `gen/stage2.py`
(resumable; delete `media/transitions/.done/<slot>` to redo one).

| Gap | Transitions 1 | Transitions 2 |
|---|---|---|
| 1 Phantom → Talking to Trees | A pad + AI texture | C pulse @ 91 |
| 2 Talking to Trees → Enantiodromia | B AI continuation of the tail | D riser |
| 3 Enantiodromia → Looking Glass | E AI guitar swells (follows the drone) | C pulse @ 92 |
| 4 Looking Glass → Horrors | A pad + organ texture | F AI feedback wall |
| 5 Horrors → Beacon | B AI continuation | C pulse @ 91 |
| 6 Beacon → Falling | v3 (kept) | D riser |
| 7 Falling → Can't You See | D riser | B AI continuation |
| 8 Can't You See → Helena | A pad + cold shimmer | C pulse @ 125 |
| 9 Helena → Ghost of You | E AI guitar swells | D riser |
| 10 Ghost of You → Disordered Hearts | C pulse @ 65 (half of 131) | F AI feedback wall |

Styles: A = tuned drone + two MusicGen textures; B = quiet drone + MusicGen
continuing the previous song's last 8 s; C = plucked arpeggio locked to the
next song's tempo, hold chord then lead chord; D = band-passed noise sweep +
sub hit at 29 s over the lead-in chord; E/F = drone + MusicGen-melody output
conditioned on the drone (so it modulates with it), guitar-swell / feedback prompts.

Estimated BPM (gen/tempo.py, rough): Phantom 128, Talking to Trees 91,
Enantiodromia 95, Looking Glass 92, Horrors 165 (or 83), Beacon 91,
Falling 120, Can't You See 120, Disordered Hearts 131. Covers: Helena 125,
Ghost of You 145 (published).
