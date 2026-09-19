> Superseded 2026-09-19 by the `hxh-character` skill (`.claude/skills/hxh-character/SKILL.md`)
> and the Roster DB at `/hxh/roster/`. This checklist described the roster.json process.

# Adding a character to the hxh roster — the checklist

Every character card in the Binder (`html/hxh/`) is one entry in
`html/hxh/roster.json`, the master copy. Follow this checklist for EVERY
character, new or revised, so cards stay consistent. Andrew reviews this
file; keep it the single source of truth for what a card must contain.

Scope: the 2011 anime (Hunter × Hunter (2011), Madhouse) through the
Chairman Election arc, plus the "Kurapika's Memories" specials. Nothing
from the manga beyond that (no Dark Continent, no Succession War).

## 1. Identify

- **`slug`** — lowercase kebab-case, unique, the character's most-used
  single name: `gon`, `neferpitou`, `zetsk-bellam`. Never rename a slug
  once it has shipped (claims will hang off it).
- **`name`** — the English name as the Viz / 2011 anime uses it
  (`Kurapika`, `Menthuthuyoupi`, `Melody` not `Senritsu`, `Biscuit
  Krueger`, `Isaac Netero`). Full name when the character has one.
- **`name_ja`** — the Japanese name exactly as the Fandom wiki infobox
  gives it: katakana/kanji, with `＝` between given and family names
  (`ゴン＝フリークス`, `クロロ＝ルシルフル`, `コムギ`). Verify it; do not
  transliterate from memory.
- **`first`** — the short name printed on the card header, ≤ 10
  characters: usually the given name (`Gon`, `Killua`), a nickname when
  that is what everyone says (`Youpi` for Menthuthuyoupi, `Pitou` is NOT
  used — `Neferpitou` fits). Must be unambiguous inside the roster.

## 2. Classify

- **`rank`** — one letter:
  - `S` — the core cast: Gon, Killua, Kurapika, Leorio, Hisoka.
  - `A` — major players who drive an arc: Troupe members, Royal Guards,
    Meruem, Netero, Ging, Chrollo, Biscuit, Kite, Zodiacs, Zoldyck family.
  - `B` — recurring supporting characters with a name, a role and lines
    across several episodes (examiners, Nostrade staff, GI players,
    squadron leaders, Hunter Association staff).
  - `C` — minor: one arc, a few scenes (Trick Tower prisoners, most GI
    players, most Chimera Ant soldiers, butlers).
  The Binder turns rank into a card limit (S 1 · A 2 · B 3 · C 4) — a
  proposal for claim exclusivity, not yet enforced.
- **`nen_types`** — 0, 1 or 2 of: `enhancement`, `transmutation`,
  `conjuration`, `emission`, `manipulation`, `specialization`. Primary
  first. Only types the anime or the wiki states; `[]` for non-users
  and for users whose type is never revealed (Cheadle, Beans).
- **`affiliation`** — short free text, the group they are best known
  by: `Hunter Association`, `Phantom Troupe`, `Zoldyck Family`, `Chimera
  Ants`, `Nostrade Family`, `Greed Island players`, `Heavens Arena`,
  `Zodiacs`, `Kurta Clan`, `Whale Island`, `East Gorteau`, `NGL`. One
  value.
- **`weapons`** — kebab slugs of signature weapons or tools, `[]` if
  none. Use the object, not the ability name: `fishing-rod`, `yo-yos`,
  `playing-cards`, `needles`, `umbrella-sword`, `gungi-board`.
- **`arcs`** — every arc the character appears in, chronological, from:
  `hunter-exam`, `zoldyck-family`, `heavens-arena`, `yorknew-city`,
  `greed-island`, `chimera-ant`, `chairman-election`. Flashbacks and
  brief cameos count if the character is on screen and named.

## 3. Picture

- **`glyph`** — exactly one emoji that reads as the character when drawn
  at 40 px and pixelated: their signature object or trait (`🎣` Gon,
  `🃏` Hisoka, `🀄` Komugi, `🐈` Neferpitou). Rules: common emoji only
  (must exist in Noto Color Emoji); no flags, no skin-tone or gender
  variants, no ZWJ sequences; avoid reusing a glyph already in the
  roster when a better one exists; when nothing fits, use a trait
  (`👓` glasses, `🥷` ninja) before falling back to `❔`.
- **`images`** — optional list of Fandom image URLs for the admin
  Roster DB page only. Never shown to guests; the card art is the glyph.

## 4. Describe

- **`description`** — 45 to 75 words, original prose (never paste the
  wiki), present tense, third person, three beats:
  1. who they are and their role (`A cheerful, athletic boy from Whale
     Island who takes the Hunter Exam to find his father Ging…`),
  2. what they can do — name the Nen type in words if they have one
     (`An Enhancer, he channels his aura into raw physical power through
     his signature technique Jajanken.`),
  3. one distinctive hook: a habit, a line, a relationship.
- Spell names as in the anime; no episode numbers; no manga-only facts;
  no fan theories. Avoid ending-of-series spoilers in the first sentence
  (later sentences may mention what happens in their arc).

## 5. Verify

- Open the character's page on `https://hunterxhunter.fandom.com/wiki/`
  and check: Japanese name, Nen type, affiliation, arcs. If the page does
  not exist, the character is too minor — skip them.
- Run `python3 foundry/website/hxh-roster/validate.py` (schema, slug
  uniqueness, glyph sanity, word counts, arc/type vocab). Fix everything
  it reports.
- Run `python3 foundry/website/hxh-roster/build.py` to order the roster
  and assign `no` (card numbers): by first arc, then rank, then name. Do
  not hand-edit `no`.

## 6. Ship

- Commit `roster.json` with a message naming the characters added.
- Deploy (`ws_prod` from `html/`); the Binder reads `roster.json` live.
- Push to the Roster DB (`PUT /hxh/api/roster/characters?replace=1`
  with an hxh-admin session) so the admin view matches.

## Entry template

```json
{
  "slug": "gon",
  "name": "Gon Freecss",
  "name_ja": "ゴン＝フリークス",
  "first": "Gon",
  "glyph": "🎣",
  "rank": "S",
  "nen_types": ["enhancement"],
  "affiliation": "Hunter Association",
  "weapons": ["fishing-rod"],
  "arcs": ["hunter-exam", "zoldyck-family", "heavens-arena", "yorknew-city", "greed-island", "chimera-ant", "chairman-election"],
  "description": "…45–75 words…",
  "images": []
}
```
