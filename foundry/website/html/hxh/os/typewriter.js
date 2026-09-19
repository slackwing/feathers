/* type(el, runs, opts) — types runs of text into an element with a
   blinking cursor. A run is a string or { t, tag, cls, title }. Returns
   { skip } to finish instantly. `instant` (or reduced motion) renders at
   once. */
export function type(el, runs, { speed = 16, onDone, instant = false, reduced = false } = {}) {
  const seq = runs.map(r => typeof r === "string" ? { t: r } : r);
  const node = (r, text) => {
    const n = document.createElement(r.tag || "span");
    if (r.cls) n.className = r.cls;
    if (r.title) n.title = r.title;
    n.textContent = text;
    return n;
  };
  let ri = 0, ci = 0, span = null, timer = null, done = false;
  const finish = () => {
    if (done) return;
    done = true; clearInterval(timer);
    el.innerHTML = ""; seq.forEach(r => el.append(node(r, r.t)));
    el.classList.remove("cur"); onDone?.();
  };
  el.innerHTML = "";
  if (reduced || instant) { finish(); return { skip: finish, get done() { return done; } }; }
  el.classList.add("cur");
  timer = setInterval(() => {
    if (ri >= seq.length) { finish(); return; }
    const r = seq[ri];
    if (!span) { span = node(r, ""); el.append(span); }
    span.textContent += r.t[ci++];
    if (ci >= r.t.length) { ri++; ci = 0; span = null; }
  }, speed);
  return { skip: finish, get done() { return done; } };
}
