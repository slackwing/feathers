/* Tiny DOM helpers shared by every component. No framework: `h()` builds
   an element from a tag, an attribute bag and children. */

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/**
 * h("button", { className: "btn", type: "button", text: "OK", dataset: { act: "x" },
 *               onclick: fn, style: { width: "1px" }, hidden: true }, ...children)
 * Attribute rules: `className`, `text`, `html`, `dataset`, `style` (object),
 * `on<event>` functions, booleans set/clear the attribute, everything else
 * is setAttribute. Children: nodes, strings (as text), arrays, or falsy.
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "className") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k === "html") el.innerHTML = v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
  }
  return el;
}

/**
 * Safari's engine (WebKit — every iPad) applies CSS `zoom` a second time to
 * container-query units: under a total zoom of z, 100cqw comes out z times
 * the container. Blink and Gecko are right. On Abi's iPad (2026-09-27, 820
 * wide) the page zoom 0.917 times the binder's 0.705 drew every card's
 * artwork at 0.646 of its sleeve. cqFix measures the error for everything
 * under `host` and sets `--cqk` there to cancel it; the stylesheets write
 * each container length as calc(N cqw * var(--cqk, 1)). Always set (1 where
 * the engine is right) so a host overrides whatever it inherits. Needs a
 * laid-out host (not display:none). Returns the factor.
 */
export function cqFix(host) {
  const doc = host?.ownerDocument;
  if (!doc) return 1;
  const box = doc.createElement("div"), i = doc.createElement("i");
  box.style.cssText = "position:absolute;left:0;top:0;width:100px;height:1px;container-type:inline-size;visibility:hidden;pointer-events:none";
  i.style.cssText = "display:block;width:100cqw;height:1px";
  box.append(i); host.append(box);
  const want = box.getBoundingClientRect().width, got = i.getBoundingClientRect().width;
  box.remove();
  const k = want > 0 && got > 0 && Math.abs(want / got - 1) > 0.002 ? Math.round(want / got * 10000) / 10000 : 1;
  host.style.setProperty("--cqk", String(k));
  return k;
}
