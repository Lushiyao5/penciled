// Serves e2e/fixtures on http://localhost:$PORT, since content scripts don't run on file: URLs
// unless the user allows it.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const root = join(import.meta.dirname, 'fixtures');
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
};

createServer(async (req, res) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  // Single-page app routes all serve the app.
  const file = path.startsWith('/spa/') ? 'spa.html' : path.slice(1) || 'article.html';
  try {
    const body = await readFile(join(root, file));
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'text/plain' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(Number(process.env.PORT ?? 5180));
