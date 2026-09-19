import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { normalizeRuns, mergeRuns, renderRuns, runsFromNode, textLength, rgbToHex, fontKey, sizeKey, LIMIT, FONTS, SIZES } from "../html/hxh/apps/chat/runs.js";

setupDom();

test("normalizeRuns mirrors the server: drops bad styles, empties, enforces the limit", () => {
  const { runs, length, error } = normalizeRuns([
    { t: "hi ", b: true, font: "px", size: 3, color: "#FF0000", bg: "#00ff00" },
    { t: "" }, { t: "x", font: "comic", size: 9, color: "red", bg: "#12" }, { nope: 1 }, null,
  ]);
  assert.equal(error, null);
  assert.equal(length, 4);
  assert.deepEqual(runs, [{ t: "hi ", b: true, font: "px", size: 3, color: "#ff0000", bg: "#00ff00" }, { t: "x" }]);
  assert.equal(normalizeRuns("nope").error, "runs must be an array");
  const over = normalizeRuns([{ t: "a".repeat(LIMIT + 1) }]);
  assert.match(over.error, /limit is 1024/);
  assert.equal(normalizeRuns([{ t: "é".repeat(LIMIT) }]).error, null);   // characters, not bytes
  assert.equal(textLength([{ t: "ab" }, { t: "😀" }]), 3);
});

test("mergeRuns joins equal neighbours only", () => {
  assert.deepEqual(mergeRuns([{ t: "a", b: true }, { t: "b", b: true }, { t: "c" }, { t: "d" }]), [{ t: "ab", b: true }, { t: "cd" }]);
});

test("renderRuns produces styled spans and <br>s, never markup from text", () => {
  const frag = renderRuns([{ t: "<b>x</b>\ny", b: true, i: true, u: true, font: "px", size: 7, color: "#ff0000", bg: "#00ff00" }]);
  const span = frag.firstChild;
  assert.equal(span.tagName, "SPAN");
  assert.equal(span.querySelector("b"), null);
  assert.equal(span.textContent, "<b>x</b>y");
  assert.equal(span.querySelectorAll("br").length, 1);
  assert.equal(span.style.fontWeight, "bold");
  assert.equal(span.style.fontStyle, "italic");
  assert.equal(span.style.textDecoration, "underline");
  assert.equal(span.style.fontFamily, FONTS.px);
  assert.equal(span.style.fontSize, SIZES[7] + "px");
  assert.equal(span.style.color, "rgb(255, 0, 0)");
  assert.equal(span.style.backgroundColor, "rgb(0, 255, 0)");
});

test("helpers: rgb → hex, font and size keys", () => {
  assert.equal(rgbToHex("rgb(255, 0, 16)"), "#ff0010");
  assert.equal(rgbToHex("#ABCDEF"), "#abcdef");
  assert.equal(rgbToHex("red"), "");
  assert.equal(fontKey('"Press Start 2P", monospace'), "px");
  assert.equal(fontKey("Georgia"), "serif");
  assert.equal(fontKey("Papyrus"), "");
  assert.equal(sizeKey("3"), 3);
  assert.equal(sizeKey("19px"), 4);
  assert.equal(sizeKey("100px"), 7);
  assert.equal(sizeKey(""), 0);
});

test("runsFromNode reads a contenteditable back: tags, <font>, inline styles, blocks", () => {
  const ed = document.createElement("div");
  ed.innerHTML = '<div>Hello <b>bold</b> <i>it</i> <u>ul</u></div><div><font face="Georgia" size="5" color="#ff0000">big red</font></div><div><span style="background-color: rgb(0, 255, 0); font-family: &quot;Press Start 2P&quot;, monospace; font-size: 13px">hl</span><br></div><p>x&nbsp;y</p>';
  const runs = runsFromNode(ed);
  assert.deepEqual(runs, [
    { t: "Hello " }, { t: "bold", b: true }, { t: " " }, { t: "it", i: true }, { t: " " }, { t: "ul", u: true }, { t: "\n" },
    { t: "big red", font: "serif", size: 5, color: "#ff0000" }, { t: "\n" },
    { t: "hl", font: "px", size: 2, bg: "#00ff00" }, { t: "\nx y" },   // the break and the plain text merge
  ]);
  const round = document.createElement("div");
  round.append(renderRuns(runs));
  assert.deepEqual(runsFromNode(round), runs);   // render → read is stable
  assert.deepEqual(runsFromNode(document.createElement("div")), []);
});
