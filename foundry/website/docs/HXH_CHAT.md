# hxh chat — spec notes (Andrew, 2026-09-18)

> **Status: built and deployed 2026-09-18** as **Beetle** (after the
> Beetle 07 phone). Transport: option A, the WebSocket hub — Andrew's
> pick when asked. Backend: hobby-server `internal/hxh/chat.go` +
> `hub.go` (+ `hub_test.go`), changesets admin 006 / hxh 005. Frontend:
> feathers `html/hxh/apps/chat/` (app, client, contacts, window,
> profile, runs) + `os/sound.js`, tests in `tests/chat-*.test.js` and
> `tests/sound.test.js`. What differs from the notes below: sounds are
> synthesised with WebAudio (no samples); profiles are stored as a JSON
> "runs" format rather than sanitised HTML (safe by construction);
> the server-side rate limit is a token bucket (10/s) — trivial, so
> it is in; "typing" is throttled to one frame per 2 s per room on
> the client. Presence: a live socket or activity < 1 min = online,
> < 1 h = away, else offline, no password = red. History and fan-out
> apply the activation rule server-side. `html/hxh/CLAUDE.md` ("Beetle")
> is the living reference.

An instant-messenger app for the Hunter × Halloween desktop, in the
spirit of late-90s messengers (AIM / MSN / ICQ — find the commonalities,
don't be over-AOL). Themed to the show: the in-universe tech is the
Hunter Association's network / the **Hunter Website**, and the Beetle 07
phone Gon and Killua carry — "Beetle" is a good name for the app, or
"Hunter Messenger". Built on the component/app architecture from
`HXH_REFACTOR.md`; it is the first real test of that architecture
(tray icons, notifications, many windows, the bus).

## Windows
1. Launching opens a **contacts list** window — tall and narrow by
   default — listing everyone with a role on `hxh`.
2. Every chromed window has minimize / maximize / close like Windows
   (shared `TitleBar` + `ChromeButton`; nothing custom).
3. Single click on a contact opens a **chat window** with them (its own
   chromed window). Any number may be open at once (one per person).
10. No group chats except one **global chat**. The contacts list AND
    the global chat open by default on launch (both closable).
12. Windows show up to **100 messages** of history (global too).
14. Unread attention: flash the window's taskbar button (that is what
    Windows did — the taskbar button flashed orange; the title bar of an
    inactive window did not). Plus a **systray icon for the app** with a
    click menu, and a separate **"new message" systray icon** (comment
    bubble) that appears when a message arrives in a non-active window;
    clicking it focuses that chat; it stays until the last unread chat
    has been focused.
15. Classic sounds: message received, door-open when someone comes
    online, door-close when they go offline. Nice-to-have.
16. Presence from server-side activity (any request, including just
    loading the site): last minute → **online (green)**; last hour →
    **away (yellow)**; else **offline (grey)**; no password set yet →
    **red**. Everyone sees everyone.
17. No font changing in chat. 18. No away messages.
19. **Profiles**, AIM style: a window to edit your own profile with a
    real WYSIWYG treatment — font, size, colour/highlight, bold, italic,
    underline (lyrics, whatever). Character limit comparable to AIM's
    (~1024). Others can open someone's profile from the contacts list.

## Messages
4. `hxh_`-namespaced tables (schema my call — proposal below). Real
   time: a message shows for the other party immediately if they have
   the site open. Keep the connection alive (heartbeat / reconnect).
5. A username in chat renders in the sender's **avatar colour** (from
   the shared profile `color`).
6. Messages are stored forever.
7. **Unsend** the last message you sent: disappears for both parties;
   removed (or soft-deleted) on the server; an undo-like control.
8. Rate limit is only against bots: allow up to 10 messages/second.
   Client-side debounce is fine; server-side only if trivial.
11. **"<user> is typing…"** at the bottom of a chat window. Ephemeral:
    does not touch the database if the transport allows.
13. Server-enforced: a user only sees messages created **after their
    account was activated** (password set) — nothing from before they
    appeared in the contacts list.

## Transport — options (Andrew asked for options when unclear)
The site is static files + hobby-server (Go) behind Apache. Presence,
typing and fan-out all need a live channel; the question is which.

- **A. WebSocket in hobby-server (recommended).** One hub goroutine per
  process; each client connection subscribes; messages are persisted
  to Postgres then fanned out; typing/presence are ephemeral bus events
  that never hit the DB. Bidirectional, single connection, natural
  fit for "is typing". Needs `nhooyr.io/websocket` (or gorilla) and an
  Apache `ProxyPass … ws://` via `mod_proxy_wstunnel` for
  `/hxh/api/chat/ws`. Heartbeat: ping every 25 s, reconnect with
  backoff on the client.
- **B. Server-Sent Events + POST.** Down: SSE stream for messages,
  typing, presence; up: plain POSTs. No new Apache module (just disable
  proxy buffering), no extra Go dependency, simpler to debug in
  devtools; but two channels and no true push from client → server
  (typing = a POST every 2 s while typing, which is fine at this scale).
- **C. Polling.** Rejected — not "immediately".

Either A or B is a single hub in the Go process (one server, one
process — no Redis needed). Presence derives from the hub's connected
set plus `hobby_server_user.last_seen_at` (bump on any authed request)
for the away/offline tiers.

## Proposed schema (hxh DB)
```
hxh_chat_message  id BIGSERIAL PK, room TEXT ('global' | 'dm:<a>:<b>' sorted),
                  sender TEXT (username), body TEXT (≤ 2000), created_at TIMESTAMPTZ,
                  deleted_at TIMESTAMPTZ NULL (soft delete for unsend)
                  index (room, created_at DESC)
hxh_chat_profile  username TEXT PK, html TEXT (sanitised WYSIWYG, ≤ 1024 chars of text),
                  updated_at
-- presence: hobby_server_user gains last_seen_at (shared DB, admin changeset);
--           "activated" = the time password_hash was first set → add
--           activated_at to hobby_server_user (item 13).
```
Visibility rule for history: `created_at > viewer.activated_at`, applied
server-side in the history query and in fan-out.

## Dependencies on the refactor (do these first)
- App registry with tray icons + tray menus (14).
- Bus events for `notify` → taskbar flash + tray comment icon (14).
- Window titles/icons updatable; many windows of one app (3, 9).
- Sound helper in the OS (15).
