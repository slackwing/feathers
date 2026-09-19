/* Profiles — AIM style. ProfileWindow shows someone's styled text;
   ProfileEditor is the WYSIWYG editor for your own: font, size, colour,
   highlight, bold / italic / underline, a live character count against
   the limit. Output is the runs format (runs.js), never HTML. */
import { Window } from "../../os/window.js";
import { h, esc } from "../../os/dom.js";
import { renderRuns, runsFromNode, textLength, normalizeRuns, LIMIT, FONTS, FONT_LABELS, SIZES } from "./runs.js";

export class ProfileWindow extends Window {
  constructor({ user, name }) {
    super({ id: "win-chat-profile-" + user.replace(/[^a-z0-9]+/gi, "-"), title: `${name} — Profile`, icon: "card", width: 440, cls: "chat profile-view", popup: true, content: `<div class="pbody sunken"></div>` });
    this.user = user;
  }
  setRuns(runs) {
    const box = this.$(".pbody");
    box.replaceChildren();
    if (!runs || !runs.length) box.append(h("i", { className: "empty", text: "No profile yet." }));
    else box.append(renderRuns(runs, box.ownerDocument));
  }
}

export class ProfileEditor extends Window {
  /** props: exec (cmd, value) → runs document.execCommand by default */
  constructor(props = {}) {
    super({
      id: "win-chat-profile-edit", title: "My profile", icon: "card", width: 540, cls: "chat profile-edit",
      content: `
        <div class="tb">
          <select class="field" data-cmd="fontName" title="Font">${Object.keys(FONTS).map(k => `<option value="${k}">${esc(FONT_LABELS[k])}</option>`).join("")}</select>
          <select class="field" data-cmd="fontSize" title="Size">${SIZES.map((px, i) => i ? `<option value="${i}"${i === 3 ? " selected" : ""}>${px}</option>` : "").join("")}</select>
          <label class="swatch" title="Colour"><input type="color" data-cmd="foreColor" value="#0b0a08"></label>
          <label class="swatch hl" title="Highlight"><input type="color" data-cmd="hiliteColor" value="#ffd166"></label>
          <button class="btn sm" type="button" data-cmd="bold" title="Bold"><b>B</b></button>
          <button class="btn sm" type="button" data-cmd="italic" title="Italic"><i>I</i></button>
          <button class="btn sm" type="button" data-cmd="underline" title="Underline"><u>U</u></button>
        </div>
        <div class="ed field sunken" contenteditable="true" spellcheck="false"></div>
        <div class="foot">
          <span class="count">0 / ${LIMIT}</span>
          <span class="actions"><button class="btn sm" type="button" data-act="cancel">Cancel</button><button class="btn sm primary" type="button" data-act="save">Save</button></span>
        </div>`,
      ...props,
    });
  }

  render() {
    const el = super.render();
    this.editor = el.querySelector(".ed");
    this.countEl = el.querySelector(".count");
    const exec = this.props.exec || ((cmd, value) => { try { el.ownerDocument.execCommand("styleWithCSS", false, cmd === "fontName" || cmd === "hiliteColor"); return el.ownerDocument.execCommand(cmd, false, value); } catch { return false; } });
    el.querySelector(".tb").addEventListener("mousedown", e => { if (e.target.closest("button")) e.preventDefault(); });   // keep the selection
    el.querySelector(".tb").addEventListener("click", e => {
      const b = e.target.closest("button[data-cmd]");
      if (b) { this.editor.focus(); exec(b.dataset.cmd); this.update(); }
    });
    for (const sel of el.querySelectorAll("select[data-cmd]")) {
      sel.addEventListener("change", () => {
        this.editor.focus();
        exec(sel.dataset.cmd, sel.dataset.cmd === "fontName" ? FONTS[sel.value] : sel.value);
        this.update();
      });
    }
    for (const inp of el.querySelectorAll("input[type=color][data-cmd]")) {
      inp.addEventListener("input", () => { this.editor.focus(); exec(inp.dataset.cmd, inp.value); this.update(); });
    }
    this.editor.addEventListener("input", () => this.update());
    el.querySelector('[data-act="cancel"]').addEventListener("click", () => this.emit("cancel"));
    el.querySelector('[data-act="save"]').addEventListener("click", () => this.save());
    return el;
  }

  setRuns(runs) {
    this.editor.replaceChildren();
    this.editor.append(renderRuns(runs || [], this.editor.ownerDocument));
    this.update();
  }

  runs() { return runsFromNode(this.editor); }

  get length() { return textLength(this.runs()); }

  update() {
    const n = this.length;
    this.countEl.textContent = `${n} / ${LIMIT}`;
    this.countEl.classList.toggle("over", n > LIMIT);
    return n;
  }

  save() {
    const { runs, error } = normalizeRuns(this.runs());
    if (error) { this.countEl.classList.add("over"); this.emit("error", { error }); return false; }
    this.emit("save", { runs });
    return true;
  }

  focusEditor() { this.editor?.focus(); }
}
