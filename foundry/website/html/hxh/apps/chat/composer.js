/* Composer — the compose box BeetleChat's windows and the bug report share
   (Andrew, 2026-09-27: "use the same dialog as beetlechat"): a tool row
   (Paste from the clipboard, an Image dialog, an Emoji palette), the text
   field, one attached picture under it with a × to remove it, and a
   button row (optional extra buttons, then Send). Enter sends, Shift+Enter
   breaks a line, Ctrl+V with a picture attaches it.

   It does no I/O. It emits what happened and its owner does the rest:
     send {body, image}   the text and the attached picture's ref (or null)
     image-file {file}    a picture to upload (pasted, or from the clipboard button)
     image-dialog         the Image button: the owner opens its Insert Image dialog
     clip-fail            the clipboard held nothing usable
     typing               a key that changes the text
     <data-act>           an extra button (e.g. "profile")
   The owner uploads a picture and hands back its ref with attachImage(). */
import { Component } from "../../os/component.js";
import { h, esc } from "../../os/dom.js";
import { icon } from "../../os/icons.js";
import { EmojiMenu } from "./emoji.js";
import "./composer.css";

/** A Blob's text (Blob.text() where it exists, FileReader elsewhere — jsdom). */
const blobText = blob => (typeof blob.text === "function" ? blob.text() : new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsText(blob); }));

export class Composer extends Component {
  /** props: clipboard (for tests), buttons [{act, label}] before Send, send ("Send"), rows (3), label (the field's aria-label), placeholder */
  render() {
    const p = this.props;
    const el = h("div", { className: "compose", html: `
      <div class="ctools">
        <button class="ctool" type="button" data-act="clip" title="Paste">${icon("clipboard", 16)}</button>
        <button class="ctool" type="button" data-act="pic" title="Image">${icon("picture", 16)}</button>
        <div class="menu"><button class="ctool" type="button" data-act="emoji" title="Emoji">${icon("smile", 16)}</button></div>
      </div>
      <textarea class="field" rows="${p.rows || 3}" aria-label="${esc(p.label || "Message")}" placeholder="${esc(p.placeholder || "")}"></textarea>
      <div class="attach" hidden><img alt=""><button class="tbtn x" type="button" data-act="detach" title="Remove">×</button></div>
      <div class="cbtns">
        ${(p.buttons || []).map(b => `<button class="btn" type="button" data-act="${esc(b.act)}">${esc(b.label)}</button>`).join("")}
        <button class="btn primary" type="button" data-act="send">${esc(p.send || "Send")}</button>
      </div>` });
    this.input = el.querySelector("textarea");
    this.attachEl = el.querySelector(".attach");
    this.placeholder = p.placeholder || "";
    el.querySelector('[data-act="send"]').addEventListener("click", () => this.submit());
    for (const b of p.buttons || []) el.querySelector(`[data-act="${b.act}"]`).addEventListener("click", () => this.emit(b.act));
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

  /** One picture: it shows below the text you typed; you keep typing above it. */
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

  /** Compose on or off — off, the field greys out and says why in italics. */
  setCanSend(on, note = "") {
    this.canSend = !!on;
    this.input.disabled = !on;
    this.input.placeholder = on ? this.placeholder : note;
    this.el.querySelector('[data-act="send"]').disabled = !on;
  }
}
