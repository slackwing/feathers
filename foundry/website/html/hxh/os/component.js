/* Component — the base of everything drawn on the desktop. A component owns
   one root element (`el`), builds it in `render()`, and cleans up after
   itself: bus subscriptions made through `listen()` and child components
   adopted through `adopt()` are torn down by `unmount()`. Each component
   also carries a private EventBus (`events`) for its own signals, e.g. a
   ChromeButton emits "press", a Window emits "chrome". */
import { EventBus } from "./bus.js";

export class Component {
  constructor(props = {}) {
    this.props = props;
    this.el = null;
    this.events = new EventBus();
    this.children = new Set();
    this._subs = [];
    this._mounted = false;
  }

  /** Build and return the root element. Subclasses must override. */
  render() {
    throw new Error(`${this.constructor.name}.render() not implemented`);
  }

  /** Create `el` if needed and attach it to `parent` (before `before` if given). */
  mount(parent = null, { before = null } = {}) {
    if (!this.el) this.el = this.render();
    if (parent) {
      if (before) parent.insertBefore(this.el, before);
      else parent.append(this.el);
    }
    if (!this._mounted) { this._mounted = true; this.onMount(); }
    return this;
  }

  get mounted() { return this._mounted; }

  /** Hook: runs once after the first mount. */
  onMount() {}
  /** Hook: runs after unmount. */
  onUnmount() {}

  unmount() {
    for (const off of this._subs) off();
    this._subs = [];
    for (const c of [...this.children]) c.unmount();
    this.children.clear();
    this.el?.remove();
    this._mounted = false;
    this.onUnmount();
  }

  /** Subscribe to `bus` for the component's lifetime. */
  listen(bus, event, fn) {
    const off = bus.on(event, fn);
    this._subs.push(off);
    return off;
  }

  /** Mount `child` inside this component (default: into `el`) and own it. */
  adopt(child, parent = this.el, opts) {
    child.mount(parent, opts);
    this.children.add(child);
    return child;
  }

  drop(child) {
    child.unmount();
    this.children.delete(child);
  }

  on(event, fn) { return this.events.on(event, fn); }
  once(event, fn) { return this.events.once(event, fn); }
  emit(event, payload) { return this.events.emit(event, payload); }
}
