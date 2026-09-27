import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'dist');
const port = Number(process.env.PORT || 3000);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };

const server = createServer(async (request, response) => {
  try {
    const requested = decodeURIComponent((request.url || '/').split('?')[0]);
    const safe = normalize(requested).replace(/^([.][.][/\\])+/, '');
    let target = join(root, safe === '/' ? 'index.html' : safe);
    try { await stat(target); } catch { target = join(root, 'index.html'); }
    const body = await readFile(target);
    response.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    response.end(body);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(`Offline server error: ${error.message}`);
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Daily Progress Report System is running at http://127.0.0.1:${port}`);
  console.log('Keep this window open while using the application. Press Ctrl+C to stop.');
});
