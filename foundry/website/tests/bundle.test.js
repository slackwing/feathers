/* The served bundle must be what the sources produce: run `npm run build`
   (or `npm run check`) before committing. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bundle, outfile } from "../scripts/build.mjs";

test("html/hxh/hxh.js and hxh.css are up to date with os/ and apps/", () => {
  const r = bundle({ write: false });
  assert.equal(r.errors.length, 0);
  for (const f of r.outputFiles) {
    const served = f.path.replace(/\.js$/, ".js").replace(/^.*\/html\/hxh\//, "");
    const want = f.text;
    let have;
    try { have = readFileSync(f.path, "utf8"); } catch { have = null; }
    assert.ok(have !== null, `missing ${served} — run npm run build`);
    assert.ok(have === want, `${served} is stale — run npm run build`);
  }
  assert.ok(r.outputFiles.some(f => f.path === outfile));
  const js = readFileSync(outfile, "utf8");
  assert.match(js, /^\/\* GENERATED/);
  assert.match(js, /var HxH = /);
});
