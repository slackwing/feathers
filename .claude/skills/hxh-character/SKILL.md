---
name: hxh-character
description: Add or redo ONE Hunter × Hunter character in the hxh Roster DB — verified profile fields, notes that say where every fact came from and which calls were judgment, plus at least six high-resolution pictures found by looking — as a pending entry for Andrew and Abi to review in the Roster DB app on the Hunter Website desktop. Use for "add <character> to the roster", "we're missing <character>", "redo <character>", or "fix <character>" after a rejection.
---

# hxh-character — one character, start to finish

The Roster DB is built one character at a time, by hand-review. This
skill is the process; the process is the product. Every time a review
finds something wrong, fix the character AND fix the step here that
let it through, in the same commit.

Review model: every change to a character or its pictures bumps its
`version`; the reviewer's verdict (`pending`, `accepted`, `rejected`
with a reason) is passed on a version and logged. A rejected character
comes back here: fix what the reason says, then `roster.py review <id>
pending` to resubmit.

Tools (feathers `foundry/website/hxh-roster/`):
- `roster.py` — the Roster DB API, logged in as **claude**, the
  shared-auth bot user (role admin on the `admin` website — a site-wide
  admin, no hxh role; it owns what the skill creates). If the login in
  `~/.claude/hxh-roster.env` is missing or stale, run
  `./claude_access.sh` (production) or `./claude_access.sh --local`
  once: it ensures the user, sets a fresh password and writes the file.
- `wiki.py` — the Fandom wiki through its MediaWiki API (page fetches
  are blocked with 402; the API works).
- The previous attempt, `html/hxh/roster.json` (198 entries, 2026-09-17,
  automated, quality unknown): a cross-check only, never a source.

Scope: the 2011 anime (Madhouse) through the Chairman Election arc.
No manga-only facts, no Dark Continent. "Kurapika's Memories" is NOT an
animated arc — it is a manga one-shot (chapters 0A/0B), and the only
animation of that story is the film Phantom Rouge, which the wiki marks
as non-canon; an earlier version of this line listed it as in scope by
mistake (found 2026-09-24 while adding Pairo). The films are out of
scope by default. The one exception Andrew has granted is PAIRO (id
124), who appears in the TV series only as a silent memory flash: his
other pictures come from Phantom Rouge, every caption prefixed
"Phantom Rouge film:", and his notes say so. Any further film exception
needs Andrew's word.

## 0. Start

Input: a character name. Run
`python3 roster.py find "<name>"` first (case-insensitive exact name;
try the short and the full name); if the character exists, say so and
ask whether to redo (delete + recreate), fix (patch the fields the
reason names, resubmit), or add pictures only. If it exists as a
SKIPPED stub (see § 0b), stop: it stays skipped unless Andrew asks to
resurrect it — then `python3 roster.py resurrect <id>` and do the
whole process on that id with `patch` instead of `create`. Characters have no slug:
the id is the number, the name is the handle.
Then `python3 wiki.py search "<name>"` to get the exact page title, and
`python3 wiki.py infobox "<Page>"`.

## 0b. Skipping a character on purpose

When a character is considered and deliberately left out (minor, a
plain look, an animal), file a stub so nobody re-analyses the name:

    python3 roster.py skip "<Name>" --arc <arc-slug> --why "<one line>"

It is created skipped — name, arc, the reason, NO pictures — hidden
from the Roster DB's default view (the "Skipped" view lists them) and
frozen: no verdict, edit, picture or request works on it. Only the
bot resurrects one, on Andrew's word. Never skip a character Andrew
named; skip only the ones you chose to leave out, and say so in the
batch report.

## 1. Identify

- `name` — the English name as Viz / the 2011 anime uses it: `Gon
  Freecss`, `Melody` (not Senritsu), `Biscuit Krueger`, `Isaac Netero`.
- `name_ja` — the infobox `kana` exactly (`ゴン＝フリークス`), with the
  `＝` between given and family names. Never transliterate from memory.
- `first` — the short name printed on a card, unique in the roster:
  the given name, or the name everyone in the show actually says
  (`Youpi` for Menthuthuyoupi, `Pitou` for Neferpitou, `Netero`,
  `Bisky`). No length cap — the plaque shrinks a long name to fit
  (Andrew, 2026-09-22: never substitute a number or a truncation like
  `#301` or `Gittarack`; if a name is genuinely too long to print,
  say so in the report and let him decide).

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

### Prose that reads like a person wrote it

Andrew, 2026-09-22, on "a blue-crested grin studded with pins": no
metonymy, no stacked modifiers, no noun piles. Say who the character
is in plain words a party guest would understand on a card: "the
Hunter Exam applicant with the pins in his face" beats "a
blue-crested grin studded with round-headed pins that never breaks
stride". Read each sentence back; if it needs the wiki to parse, cut
it.

## 3b. Card description

`card_description` — what the Greed Island card's white box prints
(the Binder reads it): 25 to 40 words, original prose, present tense,
one or two sentences that fit the card — who they are and the one
thing they do. It is reviewed like every other field. Leave the
profile `description` as the longer text.

## 4. Notes

`notes` — for the reviewer, terse, and always present: where each
fact came from (which wiki page and sections), every judgment call
(name variant chosen, rank reasoning, a Nen type that comes from the
databook rather than the anime, an ambiguous affiliation), how the
pictures were chosen, and anything you could not verify. Andrew
reads these first ("i like how the notes explain how the information
was obtained").

## 5. Create

Write the JSON (all fields above; it is created pending at version 1)
and run `python3 roster.py create entry.json`. Note the returned `id`.

## 6. Pictures — at least six (they show under "Random" in the app: found by me, not uploaded by a person)

Never choose by file name or caption alone — LOOK. Run
`python3 wiki.py sheet "<Page>/Image Gallery" sheet.png` — the wiki
keeps most of a character's stills on that subpage, the main page has
only a handful — and `python3 wiki.py sheet "<Page>" sheet2.png` for
the rest (a numbered contact sheet, largest first, junk filtered; add
`--only <name>` on a busy page), then read the sheets. Fandom's plain
file URLs answer with a lossy WebP; `roster.py fetch` asks for
`?format=original` itself, so what lands is the true PNG or JPEG. Also check
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
answers "already there", the picture is in the set already: pick
another. Prefer proportions between 16:9 and 9:16 (they show whole in
the gallery); a 1:1 close-up becomes the avatar and a 16:9 scene or
upper-body still becomes the card's picture (the Greed Island card's
window is 16:9). For a lead with a rich gallery
eight to ten raws are welcome; for a minor character six is the aim
and if the wiki cannot give six clean pictures, say so in `notes`
rather than padding with weak ones.

## 7. Report

Print: the character number, the fields in a short table, the six-plus
pictures with captions, and your doubts. Then stop — Andrew and Abi
open Roster DB on the Hunter Website desktop (admins only), check the
profile, crop the avatar and card, and pass a verdict.

## 8. Derived pictures (on request only)

- transparent — background removal with an anime-trained model (rembg
  `isnet-anime`; Andrew: "must be done using AI tools"). Not installed
  yet — install into `hxh-roster/.venv` when first needed, say so.
  Store with `--type transparent --source-image <id>`.
- `python3 roster.py pixelate <image-id> [--size 96] [--colors 32]` —
  pixel art of a CROPPED image at its true pixel size. Deprioritised
  (Abi: use the quality pictures); only on request.
- upscaled — Real-ESRGAN / waifu2x (not installed yet — ask). Store
  with `--type upscaled --source-image <id>`.
Every derived picture carries `source_image_id` so lineage is visible.

## 8a. Card numbers

`card_number` is the character's place in the binder (Andrew,
2026-09-21/22) — separate from the id, which is the handle roster.py
uses and never changes. Every character has one from creation (the
next after the highest, whatever its status); the Roster DB lists
cards in number order only, and the reviewers renumber by dragging
rows there; `roster.py move <id> --after <id>` does the same from
here.
Numbers are deliberately not unique: a duplicate is a thing to fix,
not an error. `roster.py list` shows both.

## 8a½. Your changes are the ones that need review

The server keeps a change log per version (what field or picture
changed, by whom, bot or person). Andrew's rules (2026-09-21):

- What is ACCEPTED is a version: `accepted_version`, and the Binder
  prints that version's content (a snapshot), never the live row. So
  your edits never change what the party sees until a reviewer
  accepts again.
- A person's change is self-approved: it moves the accepted pointer
  along. So is YOUR change to the text fields name, first,
  description and card_description (Andrew, 2026-09-22: text fixes
  must not send a card back to pending). Anything else you change —
  a picture, a slot, rank, Nen, arcs, arms — makes the character
  pending and wears a red "New" wedge until the reviewers look.
  Batch such edits; a trickle is many reviews.
- A request never changes the verdict; fulfilling one is just your
  change, judged like any other.
- You cannot pass a verdict (`roster.py review` is refused for the
  bot), and you cannot delete a picture the accepted card uses.
- A patch that changes nothing does not bump the version.

## 8b. Requests from the reviewers

A reviewer can file a request on a character (the review box's
"Request…") or on one picture (the pictures toolbar's "Request…"):
a kind plus details. The verdict does not change; the row shows a
count of open requests and the picture a yellow "Request made" tag.
When Andrew says to work the queue:

    python3 roster.py requests            # open ones, oldest first
    python3 roster.py kinds               # the categories (slugs live in hxh_request_kind)
    ...do the work with patch / fetch / upload / crop...
    python3 roster.py resolve <request-id> [--dropped] [--note "how it ended"]

A request ends done (you did it) or dropped (nobody will: you could
not, or it is moot) — always with a note the reviewer can read in the
requests window.

Report per request what was done. A request is on the character or
on ONE picture (`picture #n` in the listing; `--image` when filing
from here). The kinds:

- `outpaint-white` (a picture) — the reviewer expanded the canvas in
  the crop tool and the white margins need painting in (hair cut off
  at the top, background too tight for 16:9). This is generative
  outpainting, which I cannot do on my own: it needs an image API key
  (Andrew will add one to the roster env when ready). Until then say
  so in the resolve report; do not stretch or mirror pixels and call
  it done. When it is possible: find the pure-white regions at the
  edges, fill them in the picture's own style, upload the result with
  `--type cropped --source-image <id>` (it shows under Edited with its
  lineage), and NEVER set the avatar or card slot to it — the
  reviewer chooses (Andrew, 2026-09-21).
- `card-description` (the character) — the card text is wrong. If
  the request says what, fix that; if it says nothing (Andrew: "try
  to find out what is wrong"), re-read the notes, the description
  and the wiki, find the error or the weak beat, and rewrite within
  § 3b's rules. Say in the resolve report what you changed and why.
- `other` (either) — the details are the request. Read them, do
  exactly that, report.

## 9. Feedback loop

When a review rejects something: read the reason (`roster.py get <id>`
shows `review_reason` — it may be empty, then ask — and the log), apply the fix with `roster.py
patch` / `fetch`, resubmit with `roster.py review <id>
pending`, then edit THIS file so the same mistake cannot recur, and
commit both. Keep a dated line in the log below.

### Log

- 2026-09-19 — first version, written before any character was reviewed.
- 2026-09-19 — picking pictures by file name was wrong; the contact
  sheet step (look first) was added after Gon.
- 2026-09-19 — no slug; review verdicts with versions and reasons;
  the review happens in the OS app, not a separate admin page.
- 2026-09-19 — the skill acts as the bot user "claude" (owner of what
  it finds); pictures it finds are the "Random" category, people's
  uploads are "Uploaded"; picture-level rejection is gone.
- 2026-09-20 — first batch run as five parallel agents (Killua, Leorio,
  Kurapika, Hisoka, Chrollo): the process held; lessons — the
  `<Page>/Image Gallery` subpage is where the stills are, Fandom serves
  WebP, leads comfortably reach 10–11 clean pictures, and a rank-A
  villain like Chrollo gets only the arcs he is on screen in (mentions
  and manga-only cameos do not count).
- 2026-09-20 — batches two and three (Satotz, Tonpa, Menchi, Buhara,
  Lippo; Hanzo, Pokkle, Ponzu, Bodoro, Johness): Hunter-Exam
  supporting cast yields 5–9 clean stills, so "fewer than six, said
  so in notes" is normal there. The WebP problem was worse than
  quality: the server decoded WebP at the wrong luma range, so every
  thumb and crop made from one was washed out (fixed server-side the
  same day). `roster.py refetch <id>` swaps a character's WebP raws
  for Fandom's originals, keeping captions and any raw a crop or slot
  still points at; the first ten characters were refetched that way.
- 2026-09-24 — the 39-character sweep (all twelve Zodiacs, the Chimera
  Ant stragglers, the Hunter Exam supporting cast, the Greed Island
  makers, the Nostrade bodyguards, and the variant cards Nanika, Adult
  Gon and Reborn Kite), run six agents at a time. Three lessons: (1)
  the scope line was WRONG about "Kurapika's Memories" — it is a manga
  one-shot, not an animated arc (fixed above, with Pairo's film
  exception); (2) BEYOND NETERO never appears in the 2011 anime at all
  (manga debut ch. 340, after ep 148) — an agent checked four sources
  and correctly refused to create him, which is the behaviour this
  skill wants; (3) for minor characters the six-picture aim is often
  impossible — Botobai, Saccho, Saiyu, Gel, Cluck and Bourbon yielded
  three to four clean stills each, and every agent said so in the notes
  instead of padding. A brief from the orchestrator is NOT a source:
  agents corrected "Ginta the Boar" (he is the Sheep), "Imori the
  middle brother" (he is the youngest), Saccho's non-existent eye mask
  and Cheadle's election as Chairman (manga-only). Keep trusting the
  wiki over the brief.
