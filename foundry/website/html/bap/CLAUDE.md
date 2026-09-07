# bap — bongo cat baps a table

Single-page toy at andrewcheong.com/bap/. Bongo cat (real art from
bongo.cat, black-on-white) baps a table; a blue cup rattles and drifts
right until it falls off the edge and shatters. An event will hook onto
the shatter later.

- Auth: the SHARED auth system (see `~/src/hobby-server/docs/SHARED_AUTH.md`).
  Login form POSTs to `/admin/api/login`; any logged-in user can play.
  `invite.html` is the bap-skinned set-password page.
- Backend pair: hobby-server's `bap` project (`internal/bap/`,
  `liquibase/bap/`). `GET/PUT /bap/api/state` (Apache maps to
  `/api/bap/state`) persists per-user `{cup_x, baps, broken, shatters}`;
  `cup_x` is a fraction of the table span (0 home, 1 edge).
- Art: `img/*.png` are the original bongo.cat sprites (@StrayRogue /
  @DitzyFlama, credited in the footer). Each is an 800×900 frame; the
  1600-wide files hold the down/open frame at x offset −800
  (`.layer.down`). Table, cup, shards are inline SVG in the same marker
  style. The table edge sits right under the cat's chin (baby cat barely
  reaching over it); a `clip-path` on `#cat` hides the sprites'
  low-slung slam paws/beans, which were drawn for bongo.cat's tall
  instruments. Scene space is 1800×1000, scaled to the viewport.
- Visual test hooks: `?test=down`, `?test=mid`, `?test=broken`.
  Sounds are WebAudio-synthesized; no audio assets.
