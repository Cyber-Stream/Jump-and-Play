const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream');
const root = path.resolve(__dirname, '../public');
// A pulled production environment must not make the local server impersonate Vercel.
process.env.VERCEL_ENV = 'development';
delete process.env.VERCEL;
if (!fs.existsSync(path.join(root, 'index.html'))) { console.error('Run npm run build first.'); process.exit(1); }
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4' };
http.createServer(async (req, res) => {
  res.status = status => { res.statusCode = status; return res; };
  res.json = data => res.end(JSON.stringify(data));
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/enquiries') return await require('../api/enquiries.js')(req, res);
    if (url.pathname === '/api/health') return await require('../api/health.js')(req, res);
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = path.resolve(root, '.' + relative);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    if (req.method === 'HEAD') return res.end();
    pipeline(fs.createReadStream(file), res, () => {});
  } catch { if (!res.headersSent) res.writeHead(500); res.end('Request failed'); }
}).listen(3000, '127.0.0.1', () => console.log('Jump & Play: http://localhost:3000'));
