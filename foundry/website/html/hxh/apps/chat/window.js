/* ChatWindow — one conversation: a sunken log with a real scrollbar
   (names bold in the sender's avatar colour, time stamps), a compose
   box, a button row (Profile for a buddy's chat, Send), and a status
   bar at the bottom that reads "<name> is typing…". Enter sends,
   Shift+Enter breaks a line. */
import { Window } from "../../os/window.js";
import { h } from "../../os/dom.js";
import { ScrollPane } from "../../os/scrollpane.js";
import { icon } from "../../os/icons.js";
import { EmojiMenu } from "./emoji.js";

/** A Blob's text (Blob.text() where it exists, FileReader elsewhere — jsdom). */
const blobText = blob => (typeof blob.text === "function" ? blob.text() : new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsText(blob); }));

export const roomSlug = room => room.replace(/[^a-z0-9]+/gi, "-");
export const MAX_LOG = 500;

export class ChatWindow extends Window {
  /** props: room, title, icon, me, nameOf(user), colorOf(user), menus (win => spec), profile (bool: show the Profile button), large (the global room: 1.5× both ways) */
  constructor(props) {
    super({
      id: "win-chat-" + roomSlug(props.room), title: props.title, icon: props.icon || "comment", width: props.large ? 705 : 470, cls: "chat room" + (props.large ? " large" : ""),
      content: `
        <div class="compose">
          <div class="ctools">
            <button class="ctool" type="button" data-act="clip" title="Paste">${icon("clipboard", 16)}</button>
            <button class="ctool" type="button" data-act="pic" title="Image">${icon("picture", 16)}</button>
            <div class="menu"><button class="ctool" type="button" data-act="emoji" title="Emoji">${icon("smile", 16)}</button></div>
          </div>
          <textarea class="field" rows="3" aria-label="Message"></textarea>
          <div class="attach" hidden><img alt=""><button class="tbtn x" type="button" data-act="detach" title="Remove">×</button></div>
          <div class="cbtns">
            ${props.profile ? `<button class="btn" type="button" data-act="profile">Profile</button>` : ""}
            <button class="btn primary" type="button" data-act="send">Send</button>
          </div>
        </div>
        <div class="status"><span class="typing"></span></div>`,
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
    this.input = el.querySelector("textarea");
    this.attachEl = el.querySelector(".attach");
    el.querySelector('[data-act="send"]').addEventListener("click", () => this.submit());
    el.querySelector('[data-act="profile"]')?.addEventListener("click", () => this.emit("profile"));
    el.querySelector('[data-act="detach"]').addEventListener("click", () => { this.clearAttachment(); this.focusInput(); });
    el.querySelector('[data-act="clip"]').addEventListener("click", () => this.pasteFromClipboard());
    el.querySelector('[data-act="pic"]').addEventListener("click", () => this.emit("image-dialog"));
    const emojiBtn = el.querySelector('[data-act="emoji"]');
    this.emoji = this.adopt(new EmojiMenu({ onPick: e => { this.insertText(e); this.emoji.close(); } }), emojiBtn.parentElement);
    emojiBtn.addEventListener("click", e => { e.stopPropagation(); this.emoji.toggle(); });
    this.input.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this.submit(); }
      else if (e.key.length === 1 || e.key === "Backspace") this.emit("typing");
    });
    // Ctrl+V with a picture on the clipboard attaches it (text pastes as usual)
    this.input.addEventListener("paste", e => {
      const file = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith("image/"))
        || [...(e.clipboardData?.items || [])].filter(i => i.kind === "file" && i.type.startsWith("image/")).map(i => i.getAsFile())[0];
      if (file) { e.preventDefault(); this.emit("image-file", { file }); }
    });
    return el;
  }

  /** The clipboard button: a picture attaches, text goes in at the caret. Needs the async Clipboard API (a user gesture). */
  async pasteFromClipboard() {
    const cb = this.props.clipboard || globalThis.navigator?.clipboard;
    try {
      if (cb?.read) {
        for (const item of await cb.read()) {
          const type = item.types.find(t => t.startsWith("image/"));
          if (type) { this.emit("image-file", { file: await item.getType(type) }); return true; }
          if (item.types.includes("text/plain")) { this.insertText(await blobText(await item.getType("text/plain"))); return true; }
        }
      }
      if (cb?.readText) { this.insertText(await cb.readText()); return true; }
    } catch {}
    this.emit("clip-fail");
    return false;
  }

  /** Type `text` where the caret is. */
  insertText(text) {
    const el = this.input, s = el.selectionStart ?? el.value.length, e = el.selectionEnd ?? s;
    el.value = el.value.slice(0, s) + text + el.value.slice(e);
    el.selectionStart = el.selectionEnd = s + text.length;
    el.focus();
    this.emit("typing");
  }

  /** One picture per message: it shows below the text you typed; you keep typing above it. */
  attachImage(ref) {
    this.image = ref;
    const img = this.attachEl.querySelector("img");
    img.src = ref.url; img.width = ref.width; img.height = ref.height;
    this.attachEl.hidden = false;
    this.focusInput();
  }
  clearAttachment() {
    this.image = null;
    this.attachEl.hidden = true;
    this.attachEl.querySelector("img").removeAttribute("src");
  }

  submit() {
    const body = this.input.value.trim();
    if ((!body && !this.image) || this.canSend === false) return false;
    this.emit("send", { body, image: this.image || null });
    this.input.value = "";
    this.clearAttachment();
    return true;
  }

  focusInput() { this.input?.focus(); }

  /** The newest message shown (what a read marker points at). */
  get lastId() { return this.messages.length ? this.messages[this.messages.length - 1].id : 0; }

  /** Compose on or off — off, the field greys out and says why in italics (a buddy who is offline cannot be messaged). */
  setCanSend(on, note = "") {
    this.canSend = !!on;
    if (this.input) { this.input.disabled = !on; this.input.placeholder = on ? "" : note; }
    const send = this.el?.querySelector('[data-act="send"]');
    if (send) send.disabled = !on;
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
      m.body ? h("span", { className: "txt", text: m.body }) : null,
    );
    if (m.image) {   // a picture is a block of its own under the text, scaled to fit the log
      row.append(h("div", { className: "pic" }, h("img", { src: p.imageURL?.(m.image.id) || "", width: m.image.width, height: m.image.height, loading: "lazy", alt: "", onload: () => this.pane.update() })));
    }
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
