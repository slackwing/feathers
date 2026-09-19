import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { Component } from "../html/hxh/os/component.js";
import { EventBus } from "../html/hxh/os/bus.js";
import { h } from "../html/hxh/os/dom.js";

setupDom();

class Box extends Component {
  render() { return h("div", { className: "box", text: this.props.text || "" }); }
  onMount() { this.mounted_ = (this.mounted_ || 0) + 1; }
  onUnmount() { this.unmounted_ = true; }
}

test("render is abstract", () => {
  assert.throws(() => new Component().mount(), /render\(\) not implemented/);
});

test("mount renders once, appends, and fires onMount once", () => {
  const b = new Box({ text: "hi" });
  b.mount(document.body);
  assert.equal(document.body.lastChild, b.el);
  assert.equal(b.el.textContent, "hi");
  assert.equal(b.mounted, true);
  b.mount(document.body);
  assert.equal(b.mounted_, 1);
  b.unmount();
  assert.equal(b.el.isConnected, false);
  assert.equal(b.unmounted_, true);
});

test("mount before a sibling", () => {
  const first = h("i"); document.body.append(first);
  const b = new Box().mount(document.body, { before: first });
  assert.equal(b.el.nextSibling, first);
  b.unmount(); first.remove();
});

test("adopt/drop own children; unmount tears them down and unsubscribes", () => {
  const bus = new EventBus();
  const parent = new Box().mount(document.body);
  const child = parent.adopt(new Box({ text: "c" }));
  assert.equal(parent.el.querySelector(".box"), child.el);
  let n = 0;
  parent.listen(bus, "x", () => n++);
  bus.emit("x");
  const other = parent.adopt(new Box());
  parent.drop(other);
  assert.equal(other.el.isConnected, false);
  assert.equal(parent.children.size, 1);
  parent.unmount();
  bus.emit("x");
  assert.equal(n, 1);
  assert.equal(child.el.isConnected, false);
  assert.equal(child.unmounted_, true);
  assert.equal(parent.children.size, 0);
});

test("a component's own events", () => {
  const b = new Box();
  let got = null;
  const off = b.on("press", p => { got = p; });
  b.emit("press", 7);
  assert.equal(got, 7);
  off();
  b.emit("press", 8);
  assert.equal(got, 7);
  b.once("z", p => { got = p; });
  b.emit("z", 1); b.emit("z", 2);
  assert.equal(got, 1);
});
