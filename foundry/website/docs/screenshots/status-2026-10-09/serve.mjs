// Local preview for /status/: serves html/ statically and proxies /status/api/* to prod.
//   node serve.mjs 8771
import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
const PORT = Number(process.argv[2] || 8771);
const HTML = "/home/slackwing/src/feathers/foundry/website/html";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/status/api/")) {
    const p = https.request({ host: "andrewcheong.com", method: "GET", path: u.pathname + u.search }, r => { res.writeHead(r.statusCode, { "content-type": r.headers["content-type"] || "application/json" }); r.pipe(res); });
    p.on("error", e => { res.writeHead(502); res.end("proxy: " + e.message); });
    p.end();
    return;
  }
  let file = path.join(HTML, decodeURIComponent(u.pathname));
  if (!file.startsWith(HTML)) { res.writeHead(403); return res.end(); }
  try {
    if (fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    res.writeHead(200, { "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
    res.end(fs.readFileSync(file));
  } catch { res.writeHead(404); res.end("not found"); }
}).listen(PORT, "127.0.0.1", () => console.log(`http://127.0.0.1:${PORT}/status/new/`));
