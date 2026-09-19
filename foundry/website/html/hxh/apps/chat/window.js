/* ChatWindow — one conversation: a sunken log with a real scrollbar
   (names bold in the sender's avatar colour, time stamps), a compose
   box, a button row (Profile for a buddy's chat, Send), and a status
   bar at the bottom that reads "<name> is typing…". Enter sends,
   Shift+Enter breaks a line. */
import { Window } from "../../os/window.js";
import { h } from "../../os/dom.js";
import { ScrollPane } from "../../os/scrollpane.js";

export const roomSlug = room => room.replace(/[^a-z0-9]+/gi, "-");
export const MAX_LOG = 500;

export class ChatWindow extends Window {
  /** props: room, title, icon, me, nameOf(user), colorOf(user), menus (win => spec), profile (bool: show the Profile button), large (the global room: 1.5× both ways) */
  constructor(props) {
    super({
      id: "win-chat-" + roomSlug(props.room), title: props.title, icon: props.icon || "comment", width: props.large ? 705 : 470, cls: "chat room" + (props.large ? " large" : ""),
      content: `
        <div class="compose">
          <textarea class="field" rows="3" aria-label="Message"></textarea>
          <div class="cbtns">
            ${props.profile ? `<button class="btn" type="button" data-act="profile">Profile</button>` : ""}
            <button class="btn primary" type="button" data-act="send">Send</button>
          </div>
        </div>
        <div class="status"><span class="typing"></span><span class="note"></span></div>`,
      ...props,
    });
    this.room = props.room;
    this.ids = new Set();
    this.messages = [];
  }

  render() {
    const el = super.render();
    this.log = h("div", { className: "log", role: "log" });
    this.pane = this.adopt(new ScrollPane({ content: this.log }), el.querySelector(".body"), { before: el.querySelector(".compose") });
    this.pane.el.classList.add("sunken", "logbox");
    this.typingEl = el.querySelector(".typing");
    this.noteEl = el.querySelector(".note");
    this.input = el.querySelector("textarea");
    el.querySelector('[data-act="send"]').addEventListener("click", () => this.submit());
    el.querySelector('[data-act="profile"]')?.addEventListener("click", () => this.emit("profile"));
    this.input.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this.submit(); }
      else if (e.key.length === 1 || e.key === "Backspace") this.emit("typing");
    });
    return el;
  }

  submit() {
    const body = this.input.value.trim();
    if (!body || this.canSend === false) return false;
    this.emit("send", { body });
    this.input.value = "";
    return true;
  }

  focusInput() { this.input?.focus(); }

  /** The newest message shown (what a read marker points at). */
  get lastId() { return this.messages.length ? this.messages[this.messages.length - 1].id : 0; }

  /** Compose on or off — off with a note in the status line (a buddy who is offline cannot be messaged). */
  setCanSend(on, note = "") {
    this.canSend = !!on;
    if (this.input) this.input.disabled = !on;
    const send = this.el?.querySelector('[data-act="send"]');
    if (send) send.disabled = !on;
    if (this.noteEl) this.noteEl.textContent = on ? "" : note;
  }

  setMessages(list) {
    this.log.replaceChildren();
    this.ids.clear(); this.messages = [];
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
    const row = h("div", { className: "m" + (m.sender === p.me ? " mine" : ""), dataset: { id: String(m.id), sender: m.sender } });
    row.append(
      h("b", { className: "who", text: (p.nameOf?.(m.sender) || m.sender), style: { color: p.colorOf?.(m.sender) || "" } }),
      h("span", { className: "ts", text: ` (${this.time(m.created_at)}):` }),
      " ",
      h("span", { className: "txt", text: m.body }),
    );
    this.log.append(row);
    this.messages.push(m);
    while (this.log.childElementCount > MAX_LOG) { this.log.firstElementChild.remove(); this.messages.shift(); }
    if (scroll) this.scrollDown();
    else this.pane.update();
    return row;
  }

  /** Re-apply names and colours (contacts may arrive after history did). */
  refreshNames() {
    const p = this.props;
    for (const row of this.log.querySelectorAll(".m")) {
      const who = row.querySelector(".who"), u = row.dataset.sender;
      who.textContent = p.nameOf?.(u) || u;
      who.style.color = p.colorOf?.(u) || "";
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

  scrollDown() { this.log.scrollTop = this.log.scrollHeight; this.pane.update(); }

  get messageCount() { return this.ids.size; }
}
