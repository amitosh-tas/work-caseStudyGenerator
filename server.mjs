// Production server: serves the built app (dist/) plus the /api routes from proxy.mjs.
// Run `npm run build` then `npm start`. Node 18+, no extra dependencies.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { apiMiddleware } from './proxy.mjs';

const PORT = process.env.PORT || 3000;
const DIST = join(process.cwd(), 'dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon' };

createServer((req, res) => {
  apiMiddleware(req, res, async () => {
    try {
      let path = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
      if (path === '/' || !extname(path)) path = '/index.html';
      const file = await readFile(join(DIST, path)).catch(() => readFile(join(DIST, 'index.html')));
      res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
      res.end(file);
    } catch (err) {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end('Server error: ' + err.message);
    }
  });
}).listen(PORT, () => console.log(`Case Study Builder running on http://localhost:${PORT}`));
