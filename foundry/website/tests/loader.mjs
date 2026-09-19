/* Registered via `node --import ./tests/loader.mjs`: lets the OS/app
   modules `import "./x.css"` under Node (esbuild bundles those into
   hxh.css; here they become empty modules). */
import { registerHooks } from "node:module";

registerHooks({
  load(url, context, next) {
    if (url.endsWith(".css")) return { format: "module", source: "export default {};", shortCircuit: true };
    return next(url, context);
  },
});
