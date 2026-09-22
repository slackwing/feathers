// Local harness for the hxh site: serves html/ statically on PORT and proxies /<site>/api/* → PROXY/api/<site>/*
// the way Apache does in prod (Host preserved — the chat hub checks Origin against Host), tunnelling WebSocket
// upgrades (the chat's /hxh/api/chat/ws). Pair it with hobby-server's config.test.yaml (docker hobby-test-pg :5434).
//   PROXY=http://127.0.0.1:5099 HTML=$PWD/html node scripts/preview.mjs 8768
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const PORT = Number(process.argv[2] || 8768);
const HTML = process.env.HTML || path.join(process.cwd(), "html");
const PROXY = new URL(process.env.PROXY || "http://127.0.0.1:5099");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".map": "application/json", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8" };
const apiPath = url => { const m = url.match(/^\/([a-z0-9_-]+)\/api(\/.*)?$/i); return m ? `/api/${m[1]}${m[2] || "/"}` : null; };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const api = apiPath(u.pathname);
  if (api) {
    const p = http.request({ host: PROXY.hostname, port: PROXY.port, method: req.method, path: api + u.search, headers: { ...req.headers }   /* Host preserved, like Apache ProxyPreserveHost: the hub checks Origin against Host */ }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    p.on("error", e => { res.writeHead(502); res.end("proxy: " + e.message); });
    req.pipe(p);
    return;
  }
  let file = path.join(HTML, decodeURIComponent(u.pathname));
  if (!file.startsWith(HTML)) { res.writeHead(403); return res.end(); }
  try {
    if (fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    const data = fs.readFileSync(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
    res.end(data);
  } catch { res.writeHead(404); res.end("not found"); }
});
server.on("upgrade", (req, socket, head) => {
  const api = apiPath(req.url.split("?")[0]);
  if (!api) return socket.destroy();
  const p = http.request({ host: PROXY.hostname, port: PROXY.port, method: "GET", path: api + (req.url.includes("?") ? "?" + req.url.split("?")[1] : ""), headers: { ...req.headers }   /* Host preserved, like Apache ProxyPreserveHost: the hub checks Origin against Host */ });
  p.on("upgrade", (r, psock, phead) => {
    const lines = [`HTTP/1.1 101 Switching Protocols`];
    for (let i = 0; i < r.rawHeaders.length; i += 2) lines.push(`${r.rawHeaders[i]}: ${r.rawHeaders[i + 1]}`);
    socket.write(lines.join("\r\n") + "\r\n\r\n");
    if (phead.length) socket.write(phead);
    if (head.length) psock.write(head);
    psock.pipe(socket); socket.pipe(psock);
    psock.on("error", () => socket.destroy()); socket.on("error", () => psock.destroy());
  });
  p.on("response", r => { socket.write(`HTTP/1.1 ${r.statusCode} ${r.statusMessage}\r\n\r\n`); socket.destroy(); });
  p.on("error", () => socket.destroy());
  p.end();
});
server.listen(PORT, "127.0.0.1", () => console.log(`preview http://127.0.0.1:${PORT}/hxh/  (html ${HTML}, api → ${PROXY.origin})`));
