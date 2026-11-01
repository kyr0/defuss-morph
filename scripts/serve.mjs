// Static file server over the repository root: /docs/ is the website, /examples/ the example pages, both loading
// the built files exactly as published (docs/assets/defuss-morph.mjs, ../dist/all.js). Read-only, no listings,
// `no-store` so a reload after `make build` shows the new build.
// `make start` runs it detached as the dev server (`node scripts/serve.mjs <port>`); scripts/e2e/browser.mjs
// imports `createStaticServer` and listens on a free port.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(import.meta.dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.map': 'application/json' };

/** Serves `root`; `onRequest(method, path, status)` is called once per request. */
export function createStaticServer(root = ROOT, onRequest = () => {}) {
  return createServer((req, res) => {
    const reply = (status, headers = {}) => { onRequest(req.method, req.url, status); return res.writeHead(status, headers); };
    let path;
    try { path = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { reply(400).end(); return; }
    if (path === '/') { reply(302, { location: '/docs/' }).end(); return; }
    let file = normalize(join(root, path));
    if (!file.startsWith(root + sep)) { reply(403).end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) {
      // relative URLs in an index page resolve against the directory only with a trailing slash
      if (!path.endsWith('/')) { reply(301, { location: `${path}/` }).end(); return; }
      file = join(file, 'index.html');
    }
    if (!existsSync(file)) { reply(404).end(); return; }
    const stream = createReadStream(file);
    stream.on('open', () => {
      reply(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      stream.pipe(res);
    });
    // unreadable, or deleted since the check (`make build` cleans dist/): answer 500 or cut the response; an
    // unhandled stream error would end the whole server (VERIFIED: a chmod 000 file did, scripts/serve.test.ts)
    stream.on('error', () => (res.headersSent ? res.destroy() : reply(500).end()));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const log = (level, message, fields = {}) =>
    console.log([new Date().toISOString(), level, message, ...Object.entries(fields).map(([k, v]) => `${k}=${v}`)].join(' '));
  const port = Number(process.argv[2]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`${new Date().toISOString()} ERROR invalid port arg=${process.argv[2]} usage="node scripts/serve.mjs <port>"`);
    process.exit(2);
  }
  const server = createStaticServer(ROOT, (method, url, status) => log('INFO', 'request', { method, url, status }));
  server.on('error', (error) => { console.error(`${new Date().toISOString()} ERROR listen failed code=${error.code} port=${port}`); process.exit(1); });
  server.listen(port, '127.0.0.1', () => log('INFO', 'listening', { url: `http://127.0.0.1:${port}/docs/`, pid: process.pid }));
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
      server.close(() => { log('INFO', 'stopped', { signal }); process.exit(0); });
      server.closeAllConnections();
    });
  }
}
