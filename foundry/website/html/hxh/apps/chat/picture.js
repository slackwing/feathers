/* PictureDialog — "Insert Image": a preview pane (the clipboard's picture,
   if it holds one; otherwise just the pane), Upload… on the left and
   Insert from Clipboard on the right (disabled when the clipboard has no
   picture). Emits "insert" {file} with the chosen Blob. One per chat app. */
import { Window } from "../../os/window.js";

export class PictureDialog extends Window {
  constructor(props = {}) {
    super({
      id: "win-chat-picture", title: "Insert Image", icon: "picture", width: 460, popup: true, minimizable: false,
      content: `
        <div class="pbox"><img alt="" hidden></div>
        <div class="actions">
          <label class="btn upload">Upload…<input type="file" accept="image/*" hidden></label>
          <button class="btn primary" type="button" data-act="insert" disabled>Insert from Clipboard</button>
        </div>`,
      ...props,
    });
    this.blob = null;
  }

  render() {
    const el = super.render();
    el.classList.add("picture");
    this.img = el.querySelector(".pbox img");
    this.insertBtn = el.querySelector('[data-act="insert"]');
    this.fileInput = el.querySelector('input[type="file"]');
    this.insertBtn.addEventListener("click", () => { if (this.blob) { this.emit("insert", { file: this.blob }); this.close(); } });
    this.fileInput.addEventListener("change", () => {
      const f = this.fileInput.files?.[0];
      this.fileInput.value = "";
      if (f) { this.emit("insert", { file: f }); this.close(); }
    });
    return el;
  }

  /** Show what the clipboard holds (a Blob) or nothing. */
  setClipboard(blob) {
    if (this.url) { this.props.revoke?.(this.url); this.url = null; }
    this.blob = blob || null;
    if (this.blob) {
      this.url = this.props.objectURL ? this.props.objectURL(this.blob) : URL.createObjectURL(this.blob);
      this.img.src = this.url; this.img.hidden = false;
    } else {
      this.img.removeAttribute("src"); this.img.hidden = true;
    }
    this.insertBtn.disabled = !this.blob;
  }
}
