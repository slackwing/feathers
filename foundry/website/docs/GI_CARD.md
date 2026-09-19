# The Greed Island card — spec (2026-09-19)

Measured from the Fandom scans linked from
[Greed Island Card Lists](https://hunterxhunter.fandom.com/wiki/Greed_Island_Card_Lists)
(the 1530×2130 spell-card scans, e.g. Accompany, and the ~745×1040
specified-slot scans, e.g. Ruler's Blessing #000), by row/column
brightness profiles and zoomed crops. Implemented once in
`html/hxh/apps/card.js` + `card.css` (`GICard`); every length below is a
percentage of the card's WIDTH (CSS `cqw`), so a single width sizes a
whole card and no card is custom code. Andrew's changes to the real
thing: English names, no copyright footer and no NOT FOR SALE line
(that space goes to the description band), and the illustration made
exactly 16:9 (the print is 1.76:1).

## Card

- Body 1475 × 2072 in the scan → aspect **1475 : 2072** (0.712, a 63 × 88 mm
  trading card). Corner radius **4.5**. Base colour a dark warm grey
  `#433e3f` (scan reads 67,62,63); the print has a fine halftone.
- Side margins **2.85**; top margin **5.83**; bottom margin **2.85** (the
  print keeps 4.6 for its footer text, dropped here).

## Plaque (number · name · rank-limit)

- One cream strip (`#e4dfc6`; scan 205,201,179) at y **5.83 → 19.32**,
  height **13.5**, spanning the content width **94.6**.
- Three outlined panels inside it, widths **26.1 : 39.6 : 26.1** with
  **0.4** cream gaps; outline centrelines inset **0.75** left, **0.58**
  right, **1.2** top and bottom; outline stroke **0.47**.
- Corner motif: each panel corner is a **ring of radius 0.75** centred on
  the corner point; the outline bends around the inside of the ring
  (a concave quarter) and the ring is drawn in full (a rivet head, cream
  inside). Rings that reach the strip's edge are clipped by it.
- Text: bold Didone serif (Bodoni Moda 700). Number **9.3** (three digits,
  `000`), rank-limit **8** (`SS-1`, `S-1`, `A-2`, `B-3`, `C-4` — rank then
  conversion limit), name **7.4** shrinking as far as **3.2** to fit one
  line. The print's name panel is Japanese with furigana; ours is
  English.

## Illustration

- Cream frame at y **22.9 → 77.7**, content width **94.6**, frame **1.5**
  thick, then a dark inner line **0.3**, then the picture: **91.0 ×
  51.19** = exactly **16:9** (the print: 1347 × 766, 1.76:1).
- Gap above (plaque → frame) **3.6**; below (frame → band) **3.35**.

## Description band

- y **80.95 → 137.6** (height **56.65**; the print's band ends at 135.9
  and the footer takes the rest). Foil mottle by kind — specified slot
  cards red (scan 159,73,95), spells blue (95,114,174), free slots
  yellow, game-master black — drawn as tinted fractal noise
  (`foilURI`).
- White inset (`#efeff0`) inset **4.1** on every side, dark outline
  **0.65**, corner radius **1.3**, text padding **4.7** left, **3.2** top.
- Text: the rules-text face of a real trading card, an old-style serif
  (Crimson Pro 500), size **4.5**, line height 1.28, left aligned, near
  black (Andrew: the print's gothic read too small). Ours holds the
  `card_description` from the Roster DB (target 25–40 words).
- Foil colour (Andrew, 2026-09-19): not the kind's fixed colour but the
  picture's own — pixels that are saturated and mid-light and not
  skin-toned are binned by hue (24 × 15°); the strongest hue is the
  base and highlight, a second distant hue darkens the veins
  (`interestingPalette`, `foilFromPalette`, `paletteOfImage`). A
  picture with nothing interesting keeps the kind's colour.

## In the Binder

The card is the anchor: `CARD_W` = 150 book pixels; a page is exactly
3 × 3 cards (+ 12 gaps, 20 padding, a 30 page-number strip), the book is
two pages and a 50 spine. The whole book is then shown at ONE CSS zoom
(never a transform, never per-value maths) that makes it fill 85 % of
the desktop above the taskbar — height or width, whichever binds
(`binderLayout`). Small desktops shrink it the same way.

## What a character card prints

`no` = the character's number, `name`, `rank` → rank-limit, `image` =
the Roster DB card picture (16:9), `description` = `card_description`.
Kind `restricted` (red): a character is one of the specified slot cards
you collect.
