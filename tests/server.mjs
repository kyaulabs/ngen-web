// $KYAULabs: server.mjs kyau@aura.kyaulabs 2026/11/13 -0800 Exp $
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

const root = process.cwd();
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
const publicFiles = new Set(['/index.html', '/styles.min.css', '/app.min.js', '/theme.min.js', '/space.min.js', '/vendor/d3.min.js']);

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const path = pathname === '/' ? '/index.html' : pathname;
    const asset = /^\/(?:brand|assets)\/[\w./-]+$/.test(path) && !/\.(?:css|js|scss)$/.test(path);
    if (request.method !== 'GET' || path.includes('..') || path.includes('\\') || (!publicFiles.has(path) && !asset) || !types[extname(path)]) {
      response.writeHead(404).end();
      return;
    }
    const content = await readFile(resolve(root, `.${path}`));
    response.writeHead(200, { 'Content-Type': types[extname(path)], 'Cache-Control': 'no-store' });
    response.end(content);
  } catch {
    response.writeHead(404).end();
  }
}).listen(4173, '127.0.0.1');
// vim: ft=javascript sts=4 sw=4 ts=4 et :
