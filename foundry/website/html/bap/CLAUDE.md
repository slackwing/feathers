# bap — bongo cat baps a table

Single-page toy at andrewcheong.com/bap/. Bongo cat (real art from
bongo.cat, black-on-white) baps a table; a blue cup rattles and drifts
right until it falls off the edge and shatters. An event will hook onto
the shatter later.

- Auth: the SHARED auth system (see `~/src/hobby-server/docs/SHARED_AUTH.md`).
  Login form POSTs to `/admin/api/login`; any logged-in user can play.
  `_invite/index.html` is the bap-skinned invite page (a skin over
  `/admin/assets/setpw.js`); password resets use the default
  `/admin/_reset/` page.
- Backend pair: hobby-server's `bap` project (`internal/bap/`,
  `liquibase/bap/`). `GET/PUT /bap/api/state` (Apache maps to
  `/api/bap/state`) persists per-user `{cup_x, baps, broken, shatters}`;
  `cup_x` is a fraction of the table span (0 home, 1 edge).
- Art: `img/*.png` are the original bongo.cat sprites (@StrayRogue /
  @DitzyFlama, credited in the footer). Each is an 800×900 frame; the
  1600-wide files hold the down/open frame at x offset −800
  (`.layer.down`). Table, cup, shards are inline SVG in the same marker
  style. The cat sits at the head of a very long table: the far edge
  (which it baps) runs right under its chin, and the front rim sweeps
  from the right corner down-left off screen. A `clip-path` on `#cat`
  hides the sprites' low-slung slam paws/beans, which were drawn for
  bongo.cat's tall instruments. The table is a side view in light birch:
  near-level front rim, thick slab with a visible right end face, two
  square 3D legs (front + side face). The cup starts in the cat's line
  of sight, rides a track parallel to the far edge, and tips off the rim
  at x~545 (under the cat's right paw). Left of the cup's home, in the
  foreground, stands an apology: a glass vase of red roses with a
  "sorry" card, duct-taped to the table (an X of torn strips over the
  foot). It buzzes in place on a bap and the stems whip on a spring,
  but it never drifts or falls. Right of the cup's track, toward the
  corner, a Dolfin "Poivre rose" chocolate bar lies flat on a birthday
  card — both drawn in the table plane (`PLANE` matrix: x along the far
  edge, y toward the viewer, foreshortened like the floor), the bar's
  top face being the underside raised 7px; one strip of duct tape
  (`chocTape`, sampled in the bar's frame and lifted over the top) holds
  it down. Clicking the bar opens `#card`, a greeting-card modal
  (click/Esc closes; Space doesn't bap while it's open): the card
  carries the same flat bar with a candle (`drawCardArt`), and behind
  its lower-right corner lies `.pack`, a large readable replica of the
  real sleeve (static SVG 300×550 + `drawPackSprig`; Great Vibes /
  Playfair Display / Cormorant Garamond / Montserrat from Google Fonts,
  large text real, fine text small but real, seal ring = dashes). `TABLE_OPTS` in index.html picks what stands on the
  table (`vase`, `sorry`, `choc`); the sorry card has been off since
  2026-09-22, `choc` is off until published. `?test=flowers` forces the
  vase + sorry card, `?test=choc` the chocolate, without touching the
  flags; those two hooks still load cup state (the cup-owning hooks
  don't).
  Physics: near-real gravity
  (1px ~ 1mm), baps only move a grounded cup, but a bap can resonantly
  catch a cup that's just about to land. Scene space is 1800×1000,
  scaled to the viewport.
- NO UI chrome (per Andrew: private site) — no title, counter, credit,
  or logout; just cat/table/cup plus the login overlay when logged out.
  A broken cup resets to home on refresh (shatters still counts).
- Visual test hooks: `?test=down`, `?test=mid`, `?test=broken`,
  `?test=hearts`, `?test=picks`, `?test=flowers`, `?test=choc`; `?cup=blue|green|pink`
  picks the cup.
  Sounds are WebAudio-synthesized; no audio assets.
