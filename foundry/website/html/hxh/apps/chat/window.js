/* ChatWindow — one conversation: a sunken log with a real scrollbar, a
   compose box, a button row (Profile for a buddy's chat, Send), and a
   status bar at the bottom that reads "<name> is typing…". Enter sends,
   Shift+Enter breaks a line.
   The log (Andrew/Abi, 2026-09-22: the AIM-style lines were too
   text-heavy): each run of messages from one sender within GROUP_MS
   gets ONE avatar and ONE name line (name bold in the sender's colour,
   then the time); the rest of the run are bare lines under it. A new
   calendar day gets a centred date line, "Tuesday, Sep 22", since a
   time alone is ambiguous. */
import { Window } from "../../os/window.js";
import { h } from "../../os/dom.js";
import { ScrollPane } from "../../os/scrollpane.js";
import { Composer } from "./composer.js";

export const roomSlug = room => room.replace(/[^a-z0-9]+/gi, "-");
export const MAX_LOG = 500;
/** Within this many px of the bottom counts as reading the newest line. */
export const STICK_PX = 30;
export const GROUP_MS = 5 * 60 * 1000;   // messages from one sender this close together share an avatar and name line

/** The day a message belongs to, in the reader's zone, and its date line. */
export const dayKey = iso => { const d = iso ? new Date(iso) : new Date(); return isNaN(d) ? "" : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
export const dayLabel = iso => { const d = iso ? new Date(iso) : new Date(); return isNaN(d) ? "" : d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" }); };

export class ChatWindow extends Window {
  /** props: room, title, icon, me, nameOf(user), colorOf(user), menus (win => spec), profile (bool: show the Profile button), large (the global room: 705 wide, a 1.5× log and compose; a buddy chat is 565 — Andrew, 2026-09-22: "wider by about 20%", from 470) */
  constructor(props) {
    super({
      id: "win-chat-" + roomSlug(props.room), title: props.title, icon: props.icon || "comment", width: props.large ? 705 : 565, cls: "chat room" + (props.large ? " large" : ""),
      content: `<div class="status"><span class="typing"></span></div>`,
      ...props,
    });
    this.room = props.room;
    this.ids = new Set();
    this.messages = [];
  }

  render() {
    const el = super.render();
    this.log = h("div", { className: "log", role: "log" });
    this.pane = this.adopt(new ScrollPane({ content: this.log }), el.querySelector(".body"), { before: el.querySelector(".status") });   // the log, then the compose box, then the status line
    this.pane.el.classList.add("sunken", "logbox");
    this.stickToBottom();
    this.typingEl = el.querySelector(".typing");
    // the compose box is the shared Composer (composer.js): its events are this window's events, as before
    this.composer = this.adopt(new Composer({ clipboard: this.props.clipboard, buttons: this.props.profile ? [{ act: "profile", label: "Profile" }] : [] }), el.querySelector(".body"), { before: el.querySelector(".status") });
    for (const ev of ["send", "image-file", "image-dialog", "clip-fail", "typing", "profile"]) this.composer.on(ev, payload => this.emit(ev, payload));
    return el;
  }

  // the compose box's members, as the window always had them
  get input() { return this.composer?.input; }
  get attachEl() { return this.composer?.attachEl; }
  get emoji() { return this.composer?.emoji; }
  get image() { return this.composer?.image; }
  get canSend() { return this.composer?.canSend; }
  pasteFromClipboard() { return this.composer.pasteFromClipboard(); }
  insertText(text) { return this.composer.insertText(text); }
  attachImage(ref) { return this.composer.attachImage(ref); }
  clearAttachment() { return this.composer.clearAttachment(); }
  submit() { return this.composer.submit(); }
  focusInput() { this.composer?.focusInput(); }

  /** The newest message shown (what a read marker points at). */
  get lastId() { return this.messages.length ? this.messages[this.messages.length - 1].id : 0; }

  /** Compose on or off — off, the field greys out and says why in italics (a buddy who is offline cannot be messaged). */
  setCanSend(on, note = "") { this.composer.setCanSend(on, note); }

  setMessages(list) {
    this.log.replaceChildren();
    this.ids.clear(); this.messages = []; this.lastDay = null;
    for (const m of list || []) this.addMessage(m, { scroll: false });
    this.scrollDown();
  }

  /** Fold a fresh history into the log (after a sleep or a reconnect the
      socket missed whatever was said): new messages slot in by id, the rest
      stay. Returns how many were new. */
  mergeMessages(list) {
    const fresh = (list || []).filter(m => !this.ids.has(m.id));
    if (!fresh.length) return 0;
    const all = [...this.messages, ...fresh].sort((a, b) => a.id - b.id);
    this.setMessages(all.slice(-MAX_LOG));
    return fresh.length;
  }

  addMessage(m, { scroll = true } = {}) {
    if (this.ids.has(m.id)) return null;
    this.ids.add(m.id);
    const p = this.props;
    const day = dayKey(m.created_at);
    if (day !== this.lastDay) { this.log.append(h("div", { className: "day", text: dayLabel(m.created_at) })); this.lastDay = day; }
    const last = this.messages[this.messages.length - 1];
    const cont = !!last && last.sender === m.sender && dayKey(last.created_at) === day && Math.abs(new Date(m.created_at || 0) - new Date(last.created_at || 0)) < GROUP_MS
      && this.log.lastElementChild?.classList.contains("m");
    const row = h("div", { className: "m" + (m.sender === p.me ? " mine" : "") + (cont ? " cont" : ""), dataset: { id: String(m.id), sender: m.sender } });
    if (!cont) {
      row.append(
        h("span", { className: "av", html: p.avatarOf?.(m.sender) || "" }),
        h("div", { className: "hd" },
          h("b", { className: "who", text: (p.nameOf?.(m.sender) || m.sender), style: { color: p.colorOf?.(m.sender) || "" } }),
          h("span", { className: "ts", text: this.time(m.created_at) })));
    }
    const body = h("div", { className: "bd", title: cont ? this.time(m.created_at) : "" });
    if (m.body) body.append(h("span", { className: "txt", text: m.body }));   // never hand null to DOM append(): it prints the word null
    if (m.image) {   // a picture is a block of its own under the text, scaled to fit the log
      body.append(h("div", { className: "pic" }, h("img", { src: p.imageURL?.(m.image.id) || "", width: m.image.width, height: m.image.height, loading: "lazy", alt: "", onload: () => (this.stuck ? this.scrollDown() : this.pane.update()) })));
    }
    row.append(body);
    this.log.append(row);
    this.messages.push(m);
    while (this.messages.length > MAX_LOG) {   // the oldest line goes, with any date line left stranded above it
      const first = this.log.querySelector(".m");
      first?.remove(); this.messages.shift();
      while (this.log.firstElementChild && !this.log.firstElementChild.classList.contains("m")) this.log.firstElementChild.remove();
    }
    if (scroll) this.scrollDown();
    else this.pane.update();
    return row;
  }

  /** Re-apply names, colours and avatars (contacts may arrive after history did, and a claim changes them). */
  refreshNames() {
    const p = this.props;
    for (const row of this.log.querySelectorAll(".m")) {
      const who = row.querySelector(".who"), u = row.dataset.sender;
      if (who) { who.textContent = p.nameOf?.(u) || u; who.style.color = p.colorOf?.(u) || ""; }
      const av = row.querySelector(".av");
      if (av) av.innerHTML = p.avatarOf?.(u) || "";
    }
  }

  showTyping(name, ms = 3000) {
    this.typingEl.textContent = `${name} is typing…`;
    clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => this.clearTyping(), ms);
    this.typingTimer.unref?.();
  }
  clearTyping() { this.typingEl.textContent = ""; }

  time(iso) {
    const d = iso ? new Date(iso) : new Date();
    return isNaN(d) ? "" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  scrollDown() { this.log.scrollTop = this.log.scrollHeight; this.stuck = true; this.pane.update(); }

  /** Keep the newest line in view (Andrew, 2026-09-28: a chat opened "at the top of the conversation"): while the
      reader has not scrolled up, any change in the log's size — the window shown again, a picture loading, the
      composer changing height — scrolls back to the bottom. */
  stickToBottom() {
    this.stuck = true;
    this.log.addEventListener("scroll", () => { this.stuck = this.log.scrollHeight - this.log.clientHeight - this.log.scrollTop < STICK_PX; });
    const RO = this.log.ownerDocument.defaultView?.ResizeObserver;
    if (!RO) return;
    this.resizes = new RO(() => { if (this.stuck) this.scrollDown(); });
    this.resizes.observe(this.log);
  }

  get messageCount() { return this.ids.size; }
}
