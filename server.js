// Static dev server with the cross-origin isolation headers required for
// SharedArrayBuffer, so the threaded box3d build works in the browser.
import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ROOT=site node server.js serves the assembled deploy directory instead
const base = path.dirname(fileURLToPath(import.meta.url));
const root = process.env.ROOT ? path.resolve(base, process.env.ROOT) : base;
const port = Number(process.env.PORT || 8973);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  let filePath = path.join(root, decodeURIComponent(url.pathname));
  if (!filePath.startsWith(root)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!existsSync(filePath)) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cache-Control': 'no-cache',
  });
  createReadStream(filePath).pipe(res);
});

server.listen(port, () => {
  console.log(`http://localhost:${port}`);
  console.log(`http://localhost:${port}/?threads=4 for the threaded build`);
});
