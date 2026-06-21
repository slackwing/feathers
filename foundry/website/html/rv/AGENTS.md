# AGENTS.md — Provenance rules for agents working in `rv/`

This file mirrors the rules in `rv/CLAUDE.md` for agent runtimes that look for
`AGENTS.md` by convention. The rules are the same. Don't drift.

---

## 🔒 PROVENANCE RULES — READ BEFORE EDITING `rv/assets/trip.json`

Every fact and structural field in `trip.json` carries provenance metadata
(`author`, `confidence`, `pinned`). These exist so Andrew can vet things over
time and so future Claude sessions don't blow away verified work.

### THE TWO HARD RULES

**🚫 NEVER MODIFY ANY FIELD OR FACT WHERE `pinned: true` WITHOUT EXPLICIT PERMISSION FROM ANDREW.**

**🚫 NEVER MODIFY ANY FIELD OR FACT WHERE `author: "andrew"` WITHOUT EXPLICIT PERMISSION FROM ANDREW.**

These rules apply even during sweeping rebuilds. They apply even if the data
looks "obviously wrong." Ask first. Always.

**Exception (the only one):** Fixing literal typos or pure-cosmetic reformatting
(whitespace, quote style, json formatting) is allowed without permission. If
the change has *any* semantic content — even adjusting a number by 1 or rewording
a sentence — it requires explicit permission.

### Never delete — soft-delete instead

When data becomes obsolete (e.g., user shifts the plan and old facts no longer
apply), **mark with `dropped_at` (ISO 8601) and `dropped_reason`** instead of
deleting. The item stays in `trip.json` for archaeology; scripts and renderers
filter dropped items at runtime. See `rv/assets/META.md` for the schema.

When in doubt, ask. The cost of asking is low; the cost of overwriting Andrew's
vetted work is high.

### The annotations

- **`author`** — `"andrew"` (Andrew wrote/vetted this) or `"claude"` (Claude generated this)
- **`confidence`** — only meaningful when `author: "claude"`. One of:
  - `vetted` — Andrew confirmed in conversation (rare for author=claude; usually flipped to author=andrew when this happens)
  - `researched` — Claude cited/checked a source
  - `recalled` — Claude general knowledge, no source consulted
  - `guessed` — Claude estimate, often plausible but unverified
  - `placeholder` — explicit filler that needs replacement
- **`pinned`** — `true` means "do not change without explicit permission" regardless of author. Default `false`.

### What goes where

- **Structural fields** (`lat`, `lon`, `nights`, `hours`, `miles`, etc.) get a
  sibling `meta` block on the same object: `meta.lat = {author, confidence, pinned}`.
- **Prose / lists of points** live as `facts[]` entries, each with `text` and
  inline `author`/`confidence`/`pinned`/`kind` properties.

### When adding new data

- Default to `author: "claude"`, `confidence: "researched"` if you sourced it.
- Drop to `confidence: "guessed"` if you didn't.
- Never write `author: "andrew"` unless Andrew explicitly dictated the value.
- Never write `pinned: true` unless Andrew said "pin this" or equivalent.

### When asked to "re-research" / "rebuild" / "shift the plan"

- Skip every pinned field/fact.
- Skip every `author: "andrew"` field/fact.
- If the rebuild *requires* changing one of them to make sense, stop and ask.

### When the user says things like

- "Set X to Y" / "use Y for X" → `author: "andrew"`, `confidence: "vetted"`, leave `pinned` as-is unless they say to pin
- "Pin X" / "lock X" / "don't touch X" → `pinned: true` (author stays whoever it was)
- "I verified X" / "X is correct" → flip to `author: "andrew"`, `confidence: "vetted"`
- "Re-research X" / "look up X again" → permission granted to overwrite even if pinned/author=andrew

See `rv/assets/META.md` for the full schema and authoring rules.

---

## Sibling backend repo

This directory is the static frontend. The auth backend it talks to
(`/rv/api/*`) lives in a separate repo:
**[`slackwing/rv-server`](https://github.com/slackwing/rv-server)** at
`~/src/rv-server/`. When the wire format (cookie name, request/response
shape, endpoint paths) changes on either side, the other side likely
needs an update. Each repo's own `AGENTS.md` documents its rules; read
both before touching wire-format code.
