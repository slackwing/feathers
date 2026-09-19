/* ChatWindow — one conversation (a DM or the global room): the log,
   the "is typing…" line, and the compose box. Enter sends, Shift+Enter
   breaks a line; Unsend takes back your last message. Names print in
   the sender's avatar colour (props.colorOf / nameOf). */
import { Window } from "../../os/window.js";
import { h } from "../../os/dom.js";

export const roomSlug = room => room.replace(/[^a-z0-9]+/gi, "-");
export const MAX_LOG = 500;

export class ChatWindow extends Window {
  /** props: room, title, icon, me, nameOf(user), colorOf(user), now() */
  constructor(props) {
    super({
      id: "win-chat-" + roomSlug(props.room), title: props.title, icon: props.icon || "comment", width: 470, cls: "chat room",
      content: `
        <div class="log" role="log"></div>
        <div class="typing"></div>
        <div class="compose">
          <textarea class="field" rows="2" aria-label="Message"></textarea>
          <div class="cbtns">
            <button class="btn sm" type="button" data-act="unsend" title="Take back your last message" hidden>Unsend</button>
            <button class="btn sm primary" type="button" data-act="send">Send</button>
          </div>
        </div>`,
      ...props,
    });
    this.room = props.room;
    this.ids = new Set();
    this.lastMine = null;
  }

  render() {
    const el = super.render();
    this.log = el.querySelector(".log");
    this.typingEl = el.querySelector(".typing");
    this.input = el.querySelector("textarea");
    this.unsendBtn = el.querySelector('[data-act="unsend"]');
    el.querySelector('[data-act="send"]').addEventListener("click", () => this.submit());
    this.unsendBtn.addEventListener("click", () => this.emit("unsend"));
    this.input.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this.submit(); }
      else if (e.key.length === 1 || e.key === "Backspace") this.emit("typing");
    });
    return el;
  }

  submit() {
    const body = this.input.value.trim();
    if (!body) return false;
    this.emit("send", { body });
    this.input.value = "";
    return true;
  }

  focusInput() { this.input?.focus(); }

  setMessages(list) {
    this.log.replaceChildren();
    this.ids.clear(); this.lastMine = null;
    for (const m of list || []) this.addMessage(m, { scroll: false });
    this.scrollDown();
  }

  addMessage(m, { scroll = true } = {}) {
    if (this.ids.has(m.id)) return null;
    this.ids.add(m.id);
    const p = this.props;
    const row = h("div", { className: "m" + (m.sender === p.me ? " mine" : ""), dataset: { id: String(m.id), sender: m.sender } });
    row.append(
      h("span", { className: "ts", text: this.time(m.created_at) }),
      h("b", { className: "who", text: (p.nameOf?.(m.sender) || m.sender) + ":", style: { color: p.colorOf?.(m.sender) || "" } }),
      " ",
      h("span", { className: "txt", text: m.body }),
    );
    this.log.append(row);
    while (this.log.childElementCount > MAX_LOG) this.log.firstElementChild.remove();
    if (m.sender === p.me) this.lastMine = m.id;
    this.refreshUnsend();
    if (scroll) this.scrollDown();
    return row;
  }

  removeMessage(id) {
    const row = this.log.querySelector(`[data-id="${id}"]`);
    row?.remove();
    this.ids.delete(id);
    if (this.lastMine === id) {
      const mine = [...this.log.querySelectorAll(".m.mine")];
      this.lastMine = mine.length ? +mine[mine.length - 1].dataset.id : null;
    }
    this.refreshUnsend();
    return !!row;
  }

  /** Re-apply names and colours (contacts may arrive after history did). */
  refreshNames() {
    const p = this.props;
    for (const row of this.log.querySelectorAll(".m")) {
      const who = row.querySelector(".who"), u = row.dataset.sender;
      who.textContent = (p.nameOf?.(u) || u) + ":";
      who.style.color = p.colorOf?.(u) || "";
    }
  }

  /** Unsend only offers your own most recent message, and only while it is the last thing you said. */
  refreshUnsend() { this.unsendBtn.hidden = this.lastMine == null; }

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

  scrollDown() { this.log.scrollTop = this.log.scrollHeight; }

  get messageCount() { return this.ids.size; }
}
