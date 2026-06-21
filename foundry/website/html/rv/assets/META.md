# `trip.json` Provenance Schema

This document defines how every piece of data in `trip.json` gets annotated with
provenance metadata. The annotations are invisible at runtime — scripts and the
JS renderer ignore them and read primitive values directly. They exist solely to
let Andrew vet things over time and to keep future Claude sessions from
overwriting verified work.

## The annotations

Every annotated thing has three required properties:

- **`author`** — `"andrew"` or `"claude"`. Who created/last-modified this value.
- **`confidence`** — discrete level (see below). Only meaningful when `author: "claude"`.
- **`pinned`** — boolean. `true` = "do not modify without explicit permission".

Optional:

- **`source`** — URL or short citation, when relevant
- **`note`** — context (e.g., "user confirmed 2026-06-18")
- **`dropped_at`** — ISO 8601 timestamp marking when this item was removed from active use. Items with this set are "soft-deleted" — preserved for archaeology but ignored at runtime. See below.
- **`dropped_reason`** — short explanation of why it was dropped (e.g., "user added Gila Bend hotel night, removed long single-day push")

## Soft-delete via `dropped_at`

**Never delete a fact or field outright. Mark it as dropped instead.**

When the user shifts the plan and existing facts/fields no longer apply, set
`dropped_at` (ISO 8601 with timezone) and `dropped_reason`. The item stays in
`trip.json` but is filtered out by:

- The renderer (`itinerary.js`) — dropped facts don't render
- The data script (`compute_everything.py`) — dropped stops are skipped when computing trip total days
- The audit script (`audit_provenance.py`) — dropped items are hidden by default; surfaced with `--include-dropped`

**To revive a dropped item:** delete the `dropped_at` and `dropped_reason` keys.
This is intentionally manual — reviving requires explicit thought.

**Example:**

```jsonc
{
  "text": "<strong>Long push:</strong> San Diego → Tucson — start early!",
  "kind": "transit",
  "author": "claude", "confidence": "researched", "pinned": false,
  "dropped_at": "2026-06-18T15:23:00-07:00",
  "dropped_reason": "user split SD→Tucson across 2 days with Gila Bend overnight"
}
```

**For dropping a structural field** (in a `meta` block), the `dropped_at` and
`dropped_reason` keys sit alongside `author`/`confidence`/`pinned`. The value
itself stays in the parent object (don't null it out — that breaks readers).
Readers should treat a field as gone if its meta entry is dropped.

**Why soft-delete instead of git revert?** Git remembers but you'd need a hash
to find it. Inline soft-deletes are revivable without git surgery and carry
context (the reason) inline. They're also auditable: "what did we drop in the
last week?" is a one-line query.

### Confidence levels

| Level | Meaning |
|---|---|
| `vetted` | Andrew confirmed in conversation. Rare when author is claude (usually the author flips to andrew when this happens). |
| `researched` | Claude cited or checked a source (web, conversation context, prior reasoning that referenced a source). |
| `recalled` | Claude general knowledge, no source consulted. Often correct but unverified. |
| `guessed` | Claude estimate. Often plausible but explicitly unverified. |
| `placeholder` | Explicit filler that needs replacement. |

## Two annotation patterns

### Pattern 1: structural fields → `meta` sidecar

For primitive fields on a stop/drive/activity/passthrough object (`lat`, `lon`,
`nights`, `hours`, etc.), the value stays primitive and a sibling `meta` block
mirrors the field names:

```jsonc
{
  "day": 1,
  "lat": 32.7595,
  "lon": -117.2528,
  "nights": 2,
  "sleep_type": "paid_campground",
  "meta": {
    "lat":        { "author": "claude", "confidence": "researched", "pinned": false },
    "lon":        { "author": "claude", "confidence": "researched", "pinned": false },
    "nights":     { "author": "andrew", "confidence": "vetted",     "pinned": true },
    "sleep_type": { "author": "claude", "confidence": "recalled",   "pinned": false }
  }
}
```

**Why sidecar instead of inline wrapping?** Wrapping (`"lat": {"value": 32.7595, "author": ...}`)
would force every reader (scripts, JS, future Claude) to unwrap. Sidecar metadata
keeps values as primitives so the runtime data path is unchanged.

**`day` is special** — it's a derived identifier, not really a "value Claude or Andrew chose."
It doesn't need a meta entry; if `meta.day` is absent that's correct.

**Missing meta entries default to** `{author: "claude", confidence: "guessed", pinned: false}`
— the safe interpretation (assume it's unverified Claude work).

### Pattern 2: prose / lists of points → `facts[]` entries

Prose, activity descriptions, reminders, hours-open notes — anything that used
to live in an `activities_md` array — becomes a `facts[]` entry with inline
annotations:

```jsonc
{
  "facts": [
    {
      "text": "<strong>Arizona-Sonora Desert Museum</strong> — 7:30am open, beat the heat",
      "kind": "activity",
      "author": "claude", "confidence": "researched", "pinned": false
    },
    {
      "text": "<strong>Section header</strong>",
      "kind": "section_header",
      "author": "claude", "confidence": "guessed", "pinned": false
    }
  ]
}
```

**`text` is HTML** (preserved from the previous `activities_md` format).

**`kind` is free-form** — current values include:
- `"activity"` — a thing to do
- `"reminder"` — something to remember (stock RV, dump tanks)
- `"hours_open"` — opening hours / time constraint
- `"warning"` — heads-up (vehicle restriction, weather hazard)
- `"detail"` — supporting info
- `"transit"` — driving / logistics note
- `"section_header"` — visual separator (renders as `<p class="lead">` instead of `<li>`)
- `"food"` — restaurant / dining note
- `"sleep"` — note about where they sleep

If you find yourself adding the same `kind` 5+ times across the file and it
has a clear visual or semantic distinction, propose structuring it (e.g.,
splitting `facts` into `activities[]` and `reminders[]`). Until then, keep it
loose.

## Authoring defaults

When Claude adds new data:

- **Default**: `{author: "claude", confidence: "researched", pinned: false}`
- **If guessing**: explicitly set `confidence: "guessed"`
- **Never** write `author: "andrew"` unless Andrew explicitly dictated the value
- **Never** write `pinned: true` unless Andrew said "pin this" or equivalent

When Andrew dictates a value in conversation:

- Flip `author: "andrew"`, `confidence: "vetted"`
- Leave `pinned` as-is unless Andrew says to pin it

When Andrew says "pin X" / "lock X" / "don't touch X":

- Set `pinned: true`. Author stays whoever it was.

When Andrew says "I verified X" / "X is correct" / "yes that's right":

- Flip `author: "andrew"`, `confidence: "vetted"`

When Andrew says "re-research X" / "look up X again":

- Permission granted to overwrite even if pinned or author=andrew.

## See also

- `rv/CLAUDE.md` and `rv/AGENTS.md` — the loud rules for future Claude sessions
- The `rv-itinerary-rebuild` skill — pipeline that respects pinned/author boundaries
- `rv/scripts/audit_provenance.py` — CLI to list unvetted/unpinned items for batch review
