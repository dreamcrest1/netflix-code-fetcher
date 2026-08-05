const http = require('http');
const fs = require('fs');
const path = require('path');

const fetchLatestCode = require('./api/fetch-latest-code');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Wrap the Vercel-style handler so it works with a plain Node server.
// The handler expects Express-like req.body and res.status().json() helpers.
function adaptResponse(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (obj) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return res;
  };
  return res;
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  const filePath = path.join(PUBLIC_DIR, urlPath);

  // Prevent path traversal outside the public directory.
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      // Fall back to index.html for unknown routes.
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (fallbackErr, html) => {
        if (fallbackErr) {
          res.statusCode = 404;
          return res.end('Not Found');
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(html);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  // Add security and cross-device compatibility headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.url.startsWith('/api/fetch-latest-code')) {
    req.body = await readBody(req);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    adaptResponse(res);
    try {
      await fetchLatestCode(req, res);
    } catch (error) {
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: 'Internal server error.', error: error.message }));
      }
    }
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`[v0] Netflix Code Fetcher running on http://localhost:${PORT}`);
});
