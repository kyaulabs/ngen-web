import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

const root = process.cwd();
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
const publicFiles = new Set(['/index.html', '/styles.css', '/app.min.js', '/theme.min.js', '/space.min.js']);

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const path = pathname === '/' ? '/index.html' : pathname;
    if (request.method !== 'GET' || path.includes('..') || path.includes('\\') || (!publicFiles.has(path) && !/^\/(?:vendor|brand|assets)\/[\w./-]+$/.test(path)) || !types[extname(path)]) {
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
