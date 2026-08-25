/**
 * Serves the CRA production build at the same basename as GitHub Pages.
 *
 * Prerequisite: `npm run build` with the same REACT_APP_* as Pages
 * (via `.env` / `.env.production` / `.env.production.local` — no secrets in docs).
 *
 * Open: http://localhost:<port>/tyres_discs/
 *
 * IndexedDB is origin-scoped: localhost preview never shares DB with github.io.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = path.join(__dirname, '..');
const BUILD = path.join(ROOT, 'build');
const BASENAME = '/tyres_discs';
const PORT = Number(process.env.PORT || process.argv[2] || 5000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const stream = fs.createReadStream(filePath);
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  stream.on('error', () => {
    if (!res.headersSent) send(res, 500, 'Read error');
    else res.destroy();
  });
  stream.pipe(res);
}

function resolveUnderBuild(urlPath) {
  const rel = decodeURIComponent(urlPath.slice(BASENAME.length)).replace(/^\/+/, '');
  const candidate = path.normalize(path.join(BUILD, rel || 'index.html'));
  const buildRoot = BUILD.endsWith(path.sep) ? BUILD : BUILD + path.sep;
  if (candidate !== BUILD && !candidate.startsWith(buildRoot)) {
    return null;
  }
  return candidate;
}

if (!fs.existsSync(path.join(BUILD, 'index.html'))) {
  console.error('build/index.html not found. Run: npm run build');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  const pathname = url.pathname;

  if (pathname === '/' || pathname === '') {
    res.writeHead(302, { Location: `${BASENAME}/` });
    res.end();
    return;
  }

  if (pathname !== BASENAME && !pathname.startsWith(`${BASENAME}/`)) {
    send(res, 404, `Not found. Open ${BASENAME}/\n`);
    return;
  }

  if (pathname === BASENAME) {
    res.writeHead(302, { Location: `${BASENAME}/` });
    res.end();
    return;
  }

  let filePath = resolveUnderBuild(pathname);
  if (!filePath) {
    send(res, 400, 'Bad path\n');
    return;
  }

  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      sendFile(res, filePath);
      return;
    }
  } catch {
    send(res, 500, 'Stat error\n');
    return;
  }

  // SPA fallback — same role as Pages 404.html → index.html
  sendFile(res, path.join(BUILD, 'index.html'));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Production preview (Pages-like): http://localhost:${PORT}${BASENAME}/`);
  console.log('Uses REACT_APP_* from the last build. IndexedDB is per-origin (not shared with github.io).');
});
