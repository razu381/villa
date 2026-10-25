#!/usr/bin/env node
/**
 * Serve the static export (out/) the way the cPanel host does: folders answer
 * with their index.html, a folder without its slash is redirected to it (the
 * query kept), anything missing gets 404.html. `/classic` redirects as in
 * public/.htaccess.
 *   node scripts/serve-out.mjs [port]      (npm start; PORT works too)
 */
import fs from "fs";
import http from "http";
import path from "path";

const port = +(process.argv[2] || process.env.PORT || 3000);
const root = path.join(process.cwd(), "out");
const types = {
  ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css", ".json": "application/json",
  ".txt": "text/plain", ".xml": "application/xml", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".webp": "image/webp", ".avif": "image/avif", ".mp4": "video/mp4", ".webm": "video/webm", ".m4a": "audio/mp4",
  ".woff2": "font/woff2", ".ico": "image/x-icon",
};

const send = (res, status, file) => {
  const stat = fs.statSync(file);
  res.writeHead(status, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream", "Content-Length": stat.size, "Accept-Ranges": "bytes" });
  fs.createReadStream(file).pipe(res);
};

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    if (/^\/classic\/?$/.test(url.pathname)) {
      res.writeHead(301, { Location: "/" + url.search }).end();
      return;
    }
    const file = path.join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!url.pathname.endsWith("/")) return res.writeHead(301, { Location: url.pathname + "/" + url.search }).end();
      const index = path.join(file, "index.html");
      return fs.existsSync(index) ? send(res, 200, index) : send(res, 404, path.join(root, "404.html"));
    }
    if (fs.existsSync(file)) {
      // Video seeks ask for byte ranges.
      const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
      if (range) {
        const size = fs.statSync(file).size;
        const start = range[1] ? +range[1] : 0;
        const end = range[2] ? +range[2] : size - 1;
        res.writeHead(206, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream", "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1, "Accept-Ranges": "bytes" });
        return fs.createReadStream(file, { start, end }).pipe(res);
      }
      return send(res, 200, file);
    }
    send(res, 404, path.join(root, "404.html"));
  })
  .listen(port, () => console.log(`out/ on http://localhost:${port}`));
