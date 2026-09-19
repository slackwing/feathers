---
name: hxh-character
description: Add or redo ONE Hunter × Hunter character in the hxh Roster DB — verified profile fields plus at least six high-resolution raw pictures — as a pending entry for Andrew to review at /hxh/roster/. Use for "add <character> to the roster", "we're missing <character>", or "redo <character>".
---

# hxh-character — one character, start to finish

The Roster DB is built one character at a time, by hand-review. This
skill is the process; the process is the product. Every time Andrew's
review finds something wrong, fix the character AND fix the step here
that let it through, in the same commit.

Tools (feathers `foundry/website/hxh-roster/`):
- `roster.py` — the Roster DB API (needs `~/.claude/hxh-roster.env`:
  `HXH_ROSTER_BASE`, `HXH_ROSTER_USER`, `HXH_ROSTER_PASS`; an hxh admin).
- `wiki.py` — the Fandom wiki through its MediaWiki API (page fetches
  are blocked with 402; the API works).
- The previous attempt, `html/hxh/roster.json` (198 entries, 2026-09-17,
  automated, quality unknown): a cross-check only, never a source.

Scope: the 2011 anime (Madhouse) through the Chairman Election arc,
plus "Kurapika's Memories". No manga-only facts, no Dark Continent.

## 0. Start

Input: a character name. Run
`python3 roster.py find <slug>` first; if the character exists, say so
and ask whether to redo (delete + recreate) or add pictures only.
Then `python3 wiki.py search "<name>"` to get the exact page title, and
`python3 wiki.py infobox "<Page>"`.

## 1. Identify

- `slug` — lowercase kebab-case, the most-used single name: `gon`,
  `neferpitou`, `zetsk-bellam`. Never renamed after shipping.
- `name` — the English name as Viz / the 2011 anime uses it: `Gon
  Freecss`, `Melody` (not Senritsu), `Biscuit Krueger`, `Isaac Netero`.
- `name_ja` — the infobox `kana` exactly (`ゴン＝フリークス`), with the
  `＝` between given and family names. Never transliterate from memory.
- `first` — the short name printed on a card, ≤ 10 characters, unique
  in the roster: the given name or the nickname everyone says (`Youpi`
  for Menthuthuyoupi; `Neferpitou` stays, `Pitou` is not used).

## 2. Classify

- `rank` — `S` the five leads (Gon, Killua, Kurapika, Leorio, Hisoka);
  `A` arc-driving majors (Troupe, Royal Guards, Meruem, Netero, Ging,
  Chrollo, Biscuit, Kite, Zodiacs, Zoldycks); `B` recurring named
  supporting cast with lines across several episodes; `C` minor.
- `nen_types` — 0, 1 or 2 of enhancement, transmutation, conjuration,
  emission, manipulation, specialization; primary first; only what the
  anime or the wiki infobox states (`[]` for non-users and unrevealed).
- `affiliation` — ONE short group name the character is best known by:
  `Hunter Association`, `Phantom Troupe`, `Zoldyck Family`, `Chimera
  Ants`, `Nostrade Family`, `Greed Island players`, `Heavens Arena`,
  `Zodiacs`, `Kurta Clan`, `Whale Island`, `East Gorteau`, `NGL`.
- `arcs` — every arc they appear in, in order, from hunter-exam,
  zoldyck-family, heavens-arena, yorknew-city, greed-island,
  chimera-ant, chairman-election. On-screen and named counts.
- `arms` — kebab slugs of signature weapons or tools, the object not
  the ability: `fishing-rod`, `yo-yos`, `playing-cards`, `needles`,
  `umbrella-sword`, `gungi-board`. `[]` if none.

## 3. Describe

`description` — 45 to 75 words, original prose (never wiki text),
present tense, third person, three beats: who they are and their role;
what they can do, naming the Nen type in words if any; one hook (a
habit, a line, a relationship). Anime spellings, no episode numbers,
no manga-only facts, no fan theories, no series-ending spoilers in the
first sentence.

## 4. Notes

`notes` — for the reviewer, terse: which wiki page and sections you
used, every judgment call (name variant chosen, rank reasoning, a Nen
type that comes from the databook rather than the anime, an
ambiguous affiliation), and anything you could not verify.

## 5. Create

Write the JSON (all fields above, `status` omitted → pending) and run
`python3 roster.py create entry.json`. Note the returned `id`.

## 6. Pictures — at least six raws

Never choose by file name or caption alone — LOOK. Run
`python3 wiki.py sheet "<Page>" sheet.png --only <name>` (a numbered
contact sheet of the page's pictures, largest first, junk filtered;
drop `--only` if that leaves too few) and read `sheet.png`. Also check
the infobox portrait (`|image =` in the wikitext) and `wiki.py images
--all` for files the filter dropped that are still worth it (a
character design sheet at 700 px is fine; a 1999 still is not).
Choose at least six, using ALL of these tests:

1. The character is the clear subject — not a group shot where they are
   one of five, not a shot of their opponent.
2. Face visible and in focus, eyes open unless the scene is the point.
3. Iconic first: the shot people remember — first appearance, signature
   move, the famous line, the transformation, the wiki's own portrait.
4. Variety across the set: at least one close-up (for the 1:1 avatar),
   one upper-body or full-body (for the 2:3 card), one action, one
   expression. Do not pick six near-identical frames.
5. Resolution: prefer ≥ 1920 wide; never below 600 on the long side.
   Never an upscaled or blurry file.
6. Clean frame: no subtitles, watermarks, letterboxing, on-screen text,
   manga panels, 1999-series stills, OP/ED cards, or GIFs.

Then for each pick:
`python3 roster.py fetch <id> "<url>" --caption "<scene, ≤ 12 words, episode if known>"`.
The caption is what the reviewer reads under the thumbnail. If `fetch`
answers "already there (rejected)", Andrew rejected that picture
before: drop it, pick another. For a lead with a rich gallery
eight to ten raws are welcome; for a minor character six is the aim
and if the wiki cannot give six clean pictures, say so in `notes`
rather than padding with weak ones.

## 7. Report

Print: the Roster DB link `<base>/hxh/roster/#/c/<id>`, the fields in a
short table, the six-plus pictures with captions, and your doubts.
Then stop — Andrew reviews, crops, and asks for derived versions.

## 8. Derived pictures (on request only)

- `python3 roster.py pixelate <image-id> [--size 96] [--colors 32]` —
  pixel art of a CROPPED image, stored at its true pixel size (the
  site scales it with `image-rendering: pixelated`). Only from crops
  Andrew made, never from raws.
- transparent — background removal (rembg; not installed yet — ask
  before installing, it downloads a model). Store with
  `--type transparent --source-image <id>`.
- upscaled — Real-ESRGAN / waifu2x (not installed yet — ask). Store
  with `--type upscaled --source-image <id>`.
Every derived picture carries `source_image_id` so lineage is visible.

## 9. Feedback loop

When Andrew's review changes something: apply it with `roster.py
patch`, then edit THIS file so the same mistake cannot recur, then
commit both. Keep a dated line in the log below.

### Log

- 2026-09-19 — first version, written before any character was reviewed.
