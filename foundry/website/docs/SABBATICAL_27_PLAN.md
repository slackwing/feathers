# PLAN: "Sabbatical '27" squares grid on the status dashboard

Status: drafted 2026-10-26, **not started**. §1 lists the open questions —
answer them before Phase 3. Delete this file when Phase 4 has shipped.

## 0. What we're building

A GitHub-contribution-style grid of small squares at the top of
andrewcheong.com/status/, one column per day, showing where each day's effort
went (writing, study, Abi, health…). It's a temporary "plugin" that exists
for the sabbatical, so it must be easy to remove.

It's modelled on manuscript-studio's home-page points grid
(`web/js/home.js` → `renderPointsGrid`, read it on **origin/main** — the
local checkout may be stale), but built as a reusable component in **tuft**
and much more configurable. Four repos are involved:

| Phase | Repo | What |
|---|---|---|
| 1 | `~/src/tuft` | Scope change (`lib/ui/`) + the `grid-of-squares` component, fully tested |
| 2 | `~/src/manuscript-studio` | Personal API tokens (standard PAT pattern) + a token-readable points endpoint |
| 3 | `~/src/hobby-server` (`sxiva`) | A "study" category group + `GET /sabbatical` (per-day square counts, writing pulled from manuscript-studio with the token) |
| 4 | `~/src/feathers` (`html/status/`) | Study chart/card/lists + the Sabbatical '27 card using the component |

Porting manuscript-studio's own grid to the component is **later** (§7).

House rules that apply throughout: one git worktree per job off a freshly
fetched main/master; take `~/.config/my/deploy-lock.sh wait <name>` around
any push-to-main + deploy (hobby-server and the website share it);
always commit and push in all four repos; manuscript-studio follows its
AGENTS.md §0 job loop (local server on :5002, push, `./remote-deploy.sh`,
Telegram ping, full suite). Never print tokens or passwords (read config
secrets on the VM with a python3 `yaml` one-liner into env vars).

## 1. Open questions (proposed answer in brackets)

1. *(answered)* Health uses the `[exe]` attribute (half steps, stored as
   `exe` NUMERIC(2,1)), not the `[fit]` time category: squares =
   floor(exe / 0.5).
2. **Unlogged `[alc]`:** a day whose `[alc]` is blank — 0 drinks (2 blue
   squares) or no alcohol squares until it's filled in? [No squares until
   logged; `[alc] 0` gives 2. Otherwise today shows 2 squares all day and
   loses them in the evening.]
3. **Schema wording** "abi, health, blue, yellow": read as abi = yellow,
   health = blue (matches "6 minutes counts as 1 yellow square" and "every
   0.5 [exe] is a blue square"), ranked abi above health. [Yes.]
4. **Dates:** is **2027-01-24** the real height-change date (25 → 43)? When
   should the card appear and disappear (`SHOW_FROM` / `SHOW_UNTIL`)? Should
   squares count all history or only from a start date? [Show from now,
   until a date you give; count all history.]
5. **Study goals:** the Study chart and "Current Rate of Study" card need a
   ring maximum and colored zones like Hobbies (zones at 7/14/21 h/week,
   ring max 21 h). [Ring max 10 h; red < 3, yellow 3–7, green ≥ 7.]
6. **Summary chart:** add a Study "feels like" line there too? [Yes, blue.]
7. **`[abi]` minutes vs the `[abi]` attribute:** files also have an `[abi]`
   *attribute* (e.g. `[abi] 1.0`). The plan uses the `[abi]` category
   *minutes* (+ `[hxh]` + `[rv]`) per your 10-minute rule. [Minutes.]
8. **White squares** (staff-engineer) need a hairline outline to show up
   next to the light-gray empty cells. [Yes, a 1px inset outline.]
9. **Size:** 43 rows of 10 px cells + 2 px gaps is ~516 px tall. [Keep
   10/2; the component takes `cellSize`/`gap` if it feels too big.]

Decisions already made (no need to answer):
- Rounding is half-up everywhere (5 minutes → 1 square; 0.5 drink → 1).
- Writing = min(10, that day's manuscript-studio points), green + gold
  together, computed **before** any bulldozing (server-side counts).
- "Today" is the viewer's local date; today's column is included and fills
  in as `sxiva` syncs through the day.
- The server computes the per-type square counts and exposes only those —
  the page is public, so per-category raw minutes stay private.

## 2. Phase 1 — tuft: scope change + `grid-of-squares`

### 2.1 New scope and organization (update README.md + CONTRIBUTING.md)

tuft keeps its pure functions and gains a second, clearly fenced section
for small UI components:

```
tuft/
├── lib/
│   ├── js/                       PURE FUNCTIONS — rules unchanged
│   │   └── rainbow-slice.js
│   └── ui/                       SMALL UI COMPONENTS — one folder each
│       └── grid-of-squares/
│           ├── grid-of-squares.js
│           ├── grid-of-squares.css
│           └── README.md         settings reference + example
├── tests/
│   ├── js/test-rainbow-slice.js
│   └── ui/test-grid-of-squares.js
└── tools/run-tests.sh            runs tests/js/ and tests/ui/
```

Rules for `lib/ui/` (write these into CONTRIBUTING.md):
1. **One folder per component, self-contained.** Consumers vendor by
   copying the folder's `.js` + `.css`.
2. **No dependencies, no build step, no network, no storage, no
   framework.** Plain JS that works from a `<script>` tag (global
   `window.Tuft.<Name>`) and from Node (`module.exports`) for tests.
3. **Three layers in the file, DOM in only one:** a pure *core* (data →
   view model), a pure *renderer* (view model → HTML string), and a thin
   *mount* layer — the only code that touches `document`/`window` (measure
   width, set `innerHTML`, `ResizeObserver`). Keep mount under ~50 lines;
   the two pure layers carry all the logic and all the tests (plain Node,
   no jsdom).
4. **CSS is namespaced** (`.gos-…` for grid-of-squares) and themable via
   CSS custom properties; no global selectors.
5. **No project vocabulary.** "daily/other" (manuscript-studio) and
   "writing/netflix" (status) live in the consumer's settings, never in tuft.
6. The "extract on the second use" rule still holds — this qualifies
   (manuscript-studio + status).

Bump `package.json` to **0.2.0**. README "Utilities" gets a "UI components"
list with one line for `grid-of-squares`.

### 2.2 API and settings

```js
const grid = Tuft.GridOfSquares.mount(containerEl, settings); // renders, refits on resize
grid.add('2026-10-26', 'writing', 3);   // accumulate squares (count ≥ 0, integer)
grid.clear();                           // drop all squares
grid.render();                          // re-render (add/clear don't auto-render)
grid.destroy();                         // remove listeners + markup

// Pure exports (tests, other consumers):
Tuft.GridOfSquares.layout(settings, entries, columns) // → view model
Tuft.GridOfSquares.renderHTML(viewModel, settings)    // → HTML string
Tuft.GridOfSquares.PALETTE                             // named colors
Tuft.GridOfSquares.resolveColor('green' | '#74b355' | 'rgb(…)')
```

| Setting | Default | Meaning |
|---|---|---|
| `schema` | required | `[{type, color, rank = 0, bulldoze = false, label = type}]` |
| `height` | `10` | Column height (squares) — the global default |
| `heightChanges` | `[]` | `[{from: 'YYYY-MM-DD', height: N}]`; a day's height is the last change with `from ≤ day`, else `height` |
| `bulldozeMode` | `'skim'` | `'skim'` or `'proportional'` (§2.3) |
| `lookahead` | `0.2` | Fraction of columns to the right of today (future) |
| `cellSize`, `gap` | `10`, `2` | Pixels |
| `minColumns` | `10` | Floor on the fitted column count |
| `today` | viewer's local date | `'YYYY-MM-DD'`; tests always pass it |
| `emptyColor` | `'empty'` | Background squares (palette word or hex/rgb) |
| `todayMarker` | `true` | Small triangle + "TODAY" under today's column |
| `legend` | `false` | Swatch + label per type, in rank order |

`color` accepts a palette word (§2.4), `#rgb` / `#rrggbb`, or `rgb()` /
`rgba()`. Construction throws on: missing/duplicate `type`, unknown color
word, malformed hex, bad `heightChanges` date or non-positive height,
unknown `bulldozeMode`. `add()` throws on an unknown type or a negative /
non-integer count.

Width: as many columns as fit — `max(minColumns, floor((width + gap) /
(cellSize + gap)))` (same as manuscript-studio), refit on resize (debounce
150 ms).

### 2.3 The layout algorithm (pure core)

Literal simulation, like manuscript-studio's — simple beats clever.

1. **Window.** `future = max(1, round(columns × lookahead))` (0 when
   `lookahead` is 0); `windowStart = today − (columns − future − 1)`,
   `windowEnd = today + future`. All date math on UTC midnights of
   `YYYY-MM-DD` strings (no DST drift).
2. **Days simulated:** from the earlier of (first day with squares,
   `windowStart`) through `windowEnd`, extended further right while squares
   are still being carried. History left of the window can spill into
   view; squares carried past `windowEnd` exist but aren't drawn.
3. **A day's stack, bottom → top:** higher `rank` lower down; within one
   rank, squares carried in from the previous day sit **above** that day's
   own squares (so overflow keeps rolling first, as in manuscript-studio);
   otherwise in `add()` order. That order is what makes equal ranks band or
   alternate.
4. **Overflow, day by day left → right,** with `H = height(day)` and the
   stack longer than `H`:
   - **skim:** the top `len − H` squares leave the column. Squares of
     `bulldoze: true` types are carried into the next day (they keep their
     type and are marked *carried*); the rest are hidden.
   - **proportional:** `E = len − H` squares leave, shared out in
     proportion to each type's count in the column (carried ones included):
     quota `E × nₜ / len`, take the floors, then hand out the remainder by
     largest fractional part; ties go to the larger `nₜ`, then to the lower
     rank. Example from the spec: H = 25 with 18 green, 9 red, 3 yellow
     → E = 5, quotas 3.0 / 1.5 / 0.5 → **3 green + 2 red** leave, yellow
     stays. Within a type the topmost squares leave first. Bulldozing types
     are carried, non-bulldozing types hidden.
   - Carried squares join the next day's stack *before* it is sorted, so a
     carried low-rank square still sits above the next day's high-rank ones.
5. **View model**, one entry per visible column: `{date, height, cells:
   [{type, color, carried}] (bottom → top, ≤ height), isToday, isFuture,
   counts}`. The container is as tall as the tallest **visible** column;
   columns are bottom-aligned, and a shorter column draws nothing above
   its own height (no gray cells). So when a height change enters the
   window, the grid grows taller from that day on.

### 2.4 Palette (named colors)

Common hues only, tuned to sit with manuscript-studio's grid colors
(green `#74b355`, gold `#f0c419`, empty `rgba(87, 80, 63, 0.14)`). These
are starting values — check them in a screenshot swatch before shipping.

| Word | Hex | Note |
|---|---|---|
| green | `#74b355` | manuscript-studio daily points |
| yellow | `#f0c419` | manuscript-studio other points (gold) |
| orange | `#f0913a` | |
| red | `#e05d5d` | |
| pink | `#ec8fb8` | |
| purple | `#a77bca` | |
| blue | `#5aa9e0` | |
| brown | `#a0754d` | |
| gray | `#9e9a90` | |
| black | `#3a3630` | |
| white | `#ffffff` | drawn with a 1px inset outline |
| empty | `rgba(87, 80, 63, 0.14)` | default background squares |

### 2.5 Rendering and CSS

`renderHTML` emits `<div class="gos" style="--gos-cell:…; --gos-gap:…;
--gos-empty:…">` → `.gos-grid` (flex row, bottom-aligned) of `.gos-col`
(flex `column-reverse`) holding `.gos-cell` divs with an inline background
color; classes `.is-carried`, `.is-today`, `.is-future`, `.is-white`;
`.gos-today` marker row; optional `.gos-legend`. Each column has a `title`
tooltip ("Oct 26 — writing 4 · abi 2"). Types and labels are HTML-escaped.
No visible explanatory text beyond the legend and "TODAY".

### 2.6 Tests — `tests/ui/test-grid-of-squares.js`

Plain Node, same `assert`/`✓ ✗` style as `test-rainbow-slice.js`; exits
non-zero on any failure. Cover at least:

- **Settings:** required schema; duplicate type; every color form
  (word, `#abc`, `#aabbcc`, `rgb()`, `rgba()`), unknown word; defaults
  (height 10, rank 0, bulldoze false, skim, lookahead 0.2); bad
  `heightChanges` (date, height ≤ 0), unsorted input gets sorted; unknown
  `bulldozeMode`; `add()` with unknown type / negative / fractional count.
- **Window:** column fitting from widths (incl. `minColumns`); future count
  for lookahead 0, 0.2, 0.5; today's index; continuity across month/year
  ends and a DST date.
- **Heights:** before / on / after a change; several changes; a change
  inside the window → container height = tallest visible column; columns
  keep their own heights, bottom-aligned; a cascade from a short day into
  a tall day is absorbed by the extra room.
- **Ranks:** higher rank at the bottom; equal ranks follow add order
  (banding and alternating adds); all-default ranks = pure add order.
- **Skim:** manuscript-studio's documented examples with one bulldozing
  type, H = 14: `17, 6, 13 → 14, 9, 13` and `17, 12, 14 → 14, 14, 14, 1`;
  cascade past the window's end; history before the window spilling into
  view; a carried low-rank square sits above the next day's high-rank
  squares; carried squares sit above same-rank native squares;
  non-bulldozing overflow hidden; mixed bulldozing + non-bulldozing excess.
- **Proportional:** the 18/9/3, H = 25 example (3 green + 2 red); exact
  proportions; remainder ties broken by count, then rank; small groups
  stay; a non-bulldozing type's share is hidden; carried squares are
  re-proportioned the next day; one type behaves like skim.
- **Render:** column count, per-cell colors, carried/today/future classes,
  today-marker position, legend in rank order, no gray above a short
  column, HTML escaping.
- **Parity:** manuscript-studio's setup (daily = green, rank 1; other =
  yellow, rank 0; both bulldoze; skim; height 14) gives the same per-day
  totals as manuscript-studio's renderer for a fixture. (Colors of carried
  greens differ by design — §7.)

**Done when:** `npm test` passes, README + CONTRIBUTING describe `lib/ui/`,
the component README documents every setting, version is 0.2.0, committed
and pushed.

## 3. Phase 2 — manuscript-studio: personal API tokens

manuscript-studio has a single `auth.system_token` (admin endpoints) and
cookie sessions, but nothing a *user* can hand to another service. Add the
standard personal-access-token pattern (GitHub-style), with the points
endpoint as its first consumer.

- **Table** `api_token` (next changeset, `053-…`): `id` UUID PK,
  `username` → user, `name` (what it's for, e.g. "hobby-server sxiva"),
  `token_hash` CHAR(64) UNIQUE (SHA-256 hex), `prefix` (first ~8 chars,
  for display), `scopes` TEXT[] NOT NULL, `created_at`, `last_used_at`,
  `expires_at` (nullable), `revoked_at` (nullable).
- **Token format:** `mst_` + 32 random bytes, base64url. Shown **once** at
  creation; only the hash is stored. (SHA-256 is right for high-entropy
  tokens; bcrypt is for passwords.)
- **Scopes:** start with `points:read`; each token-reachable route names
  the scope it needs.
- **Middleware** `auth.TokenMiddleware(store, scope)`: `Authorization:
  Bearer mst_…` → hash → row that isn't revoked or expired → identity
  (username, token id) in the request context; 401 if missing/invalid,
  403 if the scope is missing; `last_used_at` updated at most once a
  minute; rate-limited per Authorization header like `/api/admin`.
- **Identity helper:** `auth.Username(r)` returns the username from a
  cookie session *or* a token, so one handler can serve both.
- **Minting** (system-token-gated, next to the existing `/api/admin`
  routes): `POST /api/admin/api-tokens {username, name, scopes,
  expires_at?}` → `{id, prefix, token}`; `GET /api/admin/api-tokens
  ?username=` (no secrets); `DELETE /api/admin/api-tokens/{id}` (revoke).
  A Settings-page UI for minting your own is a natural follow-up, not
  needed now.
- **First consumer:** `GET /api/v1/points-daily` behind
  `TokenMiddleware(points:read)`, same JSON as `/api/points-daily`
  (`{today, days: [{date, points, daily}]}`), sharing its handler.
- **Tests:** Go unit tests (hashing, lookup, scope, expiry, revocation,
  last-used throttle); handler tests (401/403/200); a curl run against the
  local :5002 server. Docs: README/ARCHITECTURE "API tokens" section;
  AGENTS.md: never log tokens.
- **Deploy + mint for prod:** after `./remote-deploy.sh`, on the VM
  (`ws_ssh`): read manuscript-studio's `auth.system_token` from its config
  (locate the VM config path first) into an env var, POST to
  `http://127.0.0.1:5001/<base_path>/api/admin/api-tokens` for user
  **andrew** (confirm the username) with name "hobby-server sxiva" and
  scope `points:read`, and pipe the returned token straight into
  hobby-server's config (Phase 3) — never to the terminal.

## 4. Phase 3 — hobby-server `sxiva`

### 4a. Study group in `category-rolling-sum`

- New query param `study` (comma list). Each row gains `study_raw` (row
  window, like `hobby_raw`) and `study_weighted` (calendar window, like
  `hobby_weighted`); `other` now excludes study codes; the response gains
  `study_categories`. Without `study` the output is unchanged apart from
  the new zero fields — prove it with a before/after diff of the hobby and
  work fields against current prod (as in the port, see
  `internal/sxiva/rolling.go`'s header for the semantics).
- Extend `rolling_test.go`'s fixture with a study code.

### 4b. `GET /api/sxiva/sabbatical` (public)

Returns the per-day square counts, **before** any bulldozing:

```json
{"writing_available": true,
 "days": [{"date": "2026-10-26", "writing": 3, "netflix": 0,
           "crucial-conversations": 2, "staff-engineer": 0, "abi": 1,
           "health": 4, "editing": 0, "critical-reading": 0}, ...]}
```

Only dates with at least one square, oldest first. Mapping lives in
`internal/sxiva/sabbatical.go` as a pure, tested function with the codes
and the 10-minute rule as constants at the top:

| Type | Source | Squares |
|---|---|---|
| writing | manuscript-studio points (user andrew) | min(10, points) |
| netflix | `[nflx]` minutes | round(m / 10) |
| crucial-conversations | `[crco]` minutes | round(m / 10) |
| staff-engineer | `[staff]` minutes | round(m / 10) |
| critical-reading | `[crit]` minutes | round(m / 10) |
| editing | `[rk]` minutes | round(m / 10) |
| abi | `[abi]` + `[hxh]` + `[rv]` minutes, summed first | round(sum / 10) |
| health | `[exe]` and `[alc]` (Q2) | floor(exe / 0.5) + max(0, 2 − round(alc)) |

`round` is half-up. Writing and sxiva days are matched by date string
(both are local dates).

- **Writing source:** new block under the sxiva project's config:
  ```yaml
  manuscripts:
    base_url: "http://127.0.0.1:5001/manuscripts"   # verify base_path; both containers are on the VM
    token: "mst_…"                                    # points:read token for andrew (Phase 2)
  ```
  A small client (5 s timeout, 60 s in-memory cache). On any failure: log
  without the token, omit writing, set `writing_available: false` — the
  other types still render.
- Docs (README endpoints, CLAUDE.md sxiva entry), deploy under the lock,
  then add the `manuscripts:` block to the VM's config **by text insertion**
  (back it up first) and restart hobby-server (`docker restart
  hobby-server` is enough for a config-only change).

## 5. Phase 4 — the status page (feathers `foundry/website/html/status/`)

### 5a. Study group

- `js/config.js`: `STUDY_CATEGORIES = ['nflx', 'crco', 'staff', 'crit']`;
  `TAG_INFO` entries for `nflx` (netflix), `crco` (crucial conversations),
  `staff` (staff engineer), `crit` (critical reading). `rk` stays in
  `HOBBY_CATEGORIES` (it already is); `abi`, `hxh`, `rv` stay "other".
- `app.js`: send `study=`; a **Study** chart below Work (Actual + Feels
  like, zones per Q5) in **blue** — the blue mood used to have; mood moves
  to **pink**; a Study line on the Summary (Q6).
- Cards: **Current Rate of Study** (REAL / FEELS LIKE rings) replaces
  "Current Other".
- Category lists: four — Hobby, Work (no longer hidden), Study, Other.

### 5b. Vendor the component

`foundry/website/scripts/vendor-tuft.sh` (manuscript-studio's
`scripts/vendor-tuft.sh` pattern) copies `lib/ui/grid-of-squares/*.{js,css}`
into `html/status/vendor/` and writes a `TUFT_UPSTREAM` stamp.

### 5c. The plugin — `html/status/sabbatical-27.js`

Self-contained; removing it = deleting the file and its `<script>` /
`<link>` tags. Shows only between `SHOW_FROM` and `SHOW_UNTIL` (Q4).
Inserts a card at the very top of `main`, titled **Sabbatical '27**,
mounts the grid, fetches `/status/api/sabbatical` once at load (and on the
page's 5-minute refresh), `add()`s every count, renders.

Settings: `bulldozeMode: 'proportional'`, `height: 25`,
`heightChanges: [{from: '2027-01-24', height: 43}]` (Q4), `lookahead: 0.2`,
`legend: true`, `todayMarker: true`, every type `bulldoze: true`, ranks in
your order (higher = lower in the stack):

| Type | Color | Rank |
|---|---|---|
| writing | green | 7 |
| netflix | red | 6 |
| crucial-conversations | orange | 5 |
| staff-engineer | white | 4 |
| abi | yellow | 3 |
| health | blue | 2 |
| editing | brown | 1 |
| critical-reading | purple | 0 |

### 5d. Verify and ship

Extend `docs/screenshots/status-2026-10-09/check_new.mjs`: the Sabbatical
card is present, its column count matches the width, the today marker and
legend render; the Study chart exists and stays in sync with the others;
four category lists. Screenshot desktop + mobile and look (white squares
visible? height ok?), then `ws_prod` under the lock and rerun the check
against prod.

## 6. Rollout order

1. tuft (pure work, no deploy).
2. manuscript-studio tokens → deploy → mint andrew's token on the VM.
3. hobby-server: study group + `/sabbatical` → deploy → token into config
   → restart. Check `curl …/status/api/sabbatical` has writing counts.
4. Status page: study group (needs 3) + the plugin (needs 1 and 3).
5. Memory: sxiva category lists (study group), status-dashboard note
   (plugin + study), manuscript-studio note (API tokens), tuft (lib/ui).

## 7. Later — manuscript-studio adopts the component

Replace `renderPointsGrid` with the vendored component: schema `daily`
(green, rank 1, bulldoze) + `other` (yellow, rank 0, bulldoze), skim,
height 14. One deliberate behavior change: today a carried *green* block
sits on top of the next day's gold ones; with ranks it sorts below them.
Confirm with Andrew when that port happens.
