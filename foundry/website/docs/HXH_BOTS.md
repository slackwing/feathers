# hxh bots — spec (Andrew, 2026-09-19) and what was built

> **Status: built and deployed 2026-09-19.** Backend in hobby-server
> (`internal/bots`, admin changeset 007, `cmd/seed-sentences`); the
> console shows bots after real users and a "Bots" programs table; the
> BeetleChat buddy list groups them under "Bots".

## Andrew's spec

- A development mode where fake users — **bots** — "chat and do other
  things on the website", as end-to-end testers. **Do not invent a
  special thing for the bot**: whatever a real player does to look
  online, a bot does too (a real request through the public API).
- Schema: `is_bot` boolean and a generic `metadata` JSON blob on the
  shared user table. Bots: alyosha, dmitri, ivan, fyodor, zosima,
  katerina, lizaveta, nikolai, ilyusha, nastasya, aglaya, alexandra,
  adelaida — all with the `player` role on hxh (a new hxh role);
  listed after real users in the console, under a divider.
- `metadata.talkativity` (0..1) per character after The Brothers
  Karamazov / The Idiot: 0 and 1 are a min and a max, not never/always
  — the least talkative still talks sometimes, the most talkative
  sometimes shuts up. Values (Andrew: "yep works for me"): fyodor .95,
  dmitri .9, lizaveta .9 (Lizaveta Prokofyevna), nikolai .85,
  nastasya .8, katerina .7, aglaya .7, ivan .6, alyosha .5, zosima .4,
  adelaida .4, alexandra .35, ilyusha .3.
- A generic **bot service** on the server, in Go, with **bot programs**
  that can be activated and deactivated. The first is `hxh_chatbots`.
- `shared_random_sentences`: 10,000 unique sentences, `shared_` being
  the prefix for tables shared across projects. Andrew asked for Dr.
  Seuss and other famous children's books; Seuss is under copyright,
  so the corpus is public-domain children's literature from Project
  Gutenberg (Carroll, Lear, Potter, Grahame, Milne, Baum, Barrie,
  Kipling, Collodi, Grimm, Andersen, Aesop, Montgomery, Burnett, Spyri,
  Sewell, Stevenson, Twain, Nesbit, Lofting, Williams, Gruelle).
- `hxh_chatbots`: every 5 minutes EVERY bot rolls independently,
  scaled so that on average about one bot starts a conversation per
  tick (fat tail fine, zero fine). Every "speak" is subject to a 5 s –
  1 min delay with a monotonically decreasing distribution (5 s most
  likely). Target: global chat or any other player, real or bot,
  uniformly. The message is a random sentence from the corpus.
- A message reaching a bot wakes it (a hook from the chat hub into the
  program): reply chance 50 % at talkativity 0, 90 % at 1 (clamped —
  never 100 %, so loops end), after the same delay.
- Global chat: wake all bots, but with the **silence modulo**: md5 of
  the last message mod 10 — if 0 or 1 (20 %), no bot replies; every
  bot re-checks the room's latest message once more right before
  saying its thing, "like if someone said something no one wants to
  reply to so everyone suddenly shuts up".
- For the 5 seconds leading up to a message the bot signals typing
  (1 s resolution), so a real player sees "<bot> is typing…".
- The daily "mood" hash idea was dropped.

## What was added beyond the spec

- **Cooldown** (the safety valve I flagged): thirteen bots at 50–90 %
  waking each other on every global message is super-critical — the
  room would never go quiet even with the 20 % silence gate. So a bot
  ignores wake-ups from a room for 10 minutes after speaking there
  (global only; DMs have no cooldown), and holds at most one pending
  speech at a time. A global burst is bounded to one line per bot,
  then the room settles until the next initiation.
- Weight 0.3 + 0.7·talkativity, chance = weight / Σweights (so a
  talkativity-0 bot initiates 30 % as often as a talkativity-1 bot).
- The global room weighs as much as three people when a bot picks a
  target (Andrew, after seeing nobody type in global).
- BeetleChat's buddy list does NOT mark bots (Andrew: "they should be
  indistinguishable"); `is_bot` is in the contacts payload but unused
  there.
- Presence bug found by Andrew ("Katerina replied but never went
  green"): the hub had recorded a bot's own contacts fetch as "everyone
  saw her online", so her connect was never announced. Snapshots no
  longer write the last-broadcast state.
- Delay 5 s + 55 s·u², u uniform.
- After sending, a bot keeps its socket open 30–120 s, then hangs up:
  online for a minute, away for an hour, then offline — presence you
  can watch change.
- Bot passwords: one `bots.password` in config.yaml, provisioned onto
  every `is_bot` account without one (the single bot-specific act);
  everything else goes through the public API at `bots.base_url`
  (the public site in production, the Go server with `direct: true`
  in development, tick `20s` there).
- The console: `GET/PUT /admin/api/bots` (program on/off, last tick,
  counts); the Users table shows a "Bots" divider and a bot badge.

## Answers to Andrew's questions

- *Will this let me see chatters and online/away/offline differences?*
  Yes. Verified on the local stack with Playwright: bots DM each other
  and reply 7–10 s after a wake-up; the buddy list showed "Bots (4/13)"
  present while the rest were offline; a DM from Andrew to Fyodor got
  "Fyodor is typing…" and a reply. Bots that spoke recently are
  online, then away, then offline, so all three tiers appear within an
  hour of activity.
- *Anything missing?* Only the decisions above (corpus source, cooldown,
  password provisioning, the player role) — all taken as recommended.
