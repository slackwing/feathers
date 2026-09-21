/* Dialogs — the 90s message boxes the Roster DB asks with: a question
   with OK / Cancel, a one-line prompt, and the rejection reason. All are
   small popup windows (Escape cancels) with no taskbar button; they
   resolve a promise so callers read naturally. */
import { Window } from "../../os/window.js";
import { esc } from "../../os/dom.js";

let seq = 0;

export class Dialog extends Window {
  /** props: title, body (html), buttons [{act, label, primary}], width, focus (selector) */
  constructor({ title, body, buttons = [{ act: "ok", label: "OK", primary: true }, { act: "cancel", label: "Cancel" }], width = 420, focus = null, icon = "question", cls = "" } = {}) {
    super({
      id: "win-dlg-" + (++seq), title, icon, width, popup: true, task: false, minimizable: false, cls: "roster dlg " + cls,
      content: `<div class="dbody">${body}</div>
        <div class="actions right">${buttons.map(b => `<button class="btn ${b.primary ? "primary" : ""}" type="button" data-act="${b.act}">${esc(b.label)}</button>`).join("")}</div>`,
    });
    this.focusSel = focus;
    this.result = null;
  }

  render() {
    const el = super.render();
    el.querySelector(".actions").addEventListener("click", e => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act) this.finish(act);
    });
    el.addEventListener("keydown", e => {
      if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") { e.preventDefault(); if (this.canOK()) this.finish("ok"); }
    });
    return el;
  }

  canOK() { return !this.$('[data-act="ok"]')?.disabled; }

  finish(act) {
    if (act === "ok" && !this.canOK()) return;
    this.result = act === "ok" ? this.value() : null;
    this.emit(act === "ok" ? "ok" : "cancel", this.result);
    this.close();
  }

  /** What OK resolves with; subclasses override. */
  value() { return true; }

  /** Show on the window manager and resolve with the value, or null on cancel / close. */
  ask(os) {
    os.wm.add(this);
    return new Promise(res => {
      let done = false;
      const settle = v => { if (!done) { done = true; res(v); os.wm.remove(this.id); } };
      this.on("ok", v => settle(v));
      this.on("cancel", () => settle(null));
      this.on("close", () => settle(null));
      os.wm.open(this.id, this.centre(os)).then(() => this.$(this.focusSel || ".btn")?.focus());
    });
  }

  centre(os) {
    if (!os.env.floating()) return null;
    const w = this.props.width || 420;
    return { x: Math.max(16, (os.env.width - w) / 2), y: Math.max(40, os.env.height * 0.3) };
  }
}

export class ConfirmDialog extends Dialog {
  constructor({ title = "Roster DB", message, ok = "OK" } = {}) {
    super({ title, body: `<p class="q">${esc(message)}</p>`, buttons: [{ act: "ok", label: ok, primary: true }, { act: "cancel", label: "Cancel" }] });
  }
}

export class PromptDialog extends Dialog {
  constructor({ title, label, value = "", ok = "OK" } = {}) {
    super({ title, body: `<label class="lbl" for="dlg-in">${esc(label)}</label><input class="field" id="dlg-in" value="${esc(value)}" autocomplete="off">`,
      buttons: [{ act: "ok", label: ok, primary: true }, { act: "cancel", label: "Cancel" }], focus: "input" });
  }
  render() {
    const el = super.render();
    const input = el.querySelector("input"), ok = el.querySelector('[data-act="ok"]');
    const sync = () => { ok.disabled = !input.value.trim(); };
    input.addEventListener("input", sync); sync();
    return el;
  }
  value() { return this.$("input").value.trim(); }
}

/* A request to the bot (Andrew, 2026-09-21): a kind from the server's
   list (already narrowed to the character or to one picture), then the
   details — optional unless the kind says otherwise ("Other…": the
   text IS the request). */
export class RequestDialog extends Dialog {
  constructor({ kinds = [], image = null } = {}) {
    super({ title: image ? `Request · #${image}` : "Request", body: `<label class="lbl" for="dlg-kind">Request:</label><select class="field" id="dlg-kind">${kinds.map(k => `<option value="${esc(k.slug)}"${k.needs_text ? ' data-needs="1"' : ""}>${esc(k.label)}</option>`).join("")}</select>
      <label class="lbl" for="dlg-req">Details (optional):</label><textarea class="field" id="dlg-req" rows="4"></textarea>`,
      buttons: [{ act: "ok", label: "Request", primary: true }, { act: "cancel", label: "Cancel" }], focus: "select", width: 460 });
    this.image = image;
  }
  render() {
    const el = super.render();
    const sel = el.querySelector("select"), ta = el.querySelector("textarea"), ok = el.querySelector('[data-act="ok"]'), lbl = el.querySelector('label[for="dlg-req"]');
    const sync = () => { const needs = !!sel.selectedOptions[0]?.dataset.needs; lbl.textContent = needs ? "Details:" : "Details (optional):"; ok.disabled = needs && !ta.value.trim(); };
    sel.addEventListener("change", sync); ta.addEventListener("input", sync); sync();
    ta.addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.finish("ok"); } });
    return el;
  }
  value() { return { kind: this.$("select").value, text: this.$("textarea").value.trim(), image_id: this.image }; }
}

export class ReasonDialog extends Dialog {
  constructor({ name } = {}) {
    void name;
    super({ title: "Reject", body: `<label class="lbl" for="dlg-reason">Rejection reason (optional):</label><textarea class="field" id="dlg-reason" rows="4"></textarea>`,
      buttons: [{ act: "ok", label: "Reject", primary: true }, { act: "cancel", label: "Cancel" }], focus: "textarea", width: 460 });
  }
  render() {
    const el = super.render();
    el.querySelector("textarea").addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.finish("ok"); } });
    return el;
  }
  /** The reason, possibly empty — OK always means "reject". */
  value() { return this.$("textarea").value.trim(); }
}
