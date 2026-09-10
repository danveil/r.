import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { MemoryShareStore } from '../server/testing';
import { partnerApi } from '../server/partner-api';
const port = Number(process.argv[2] ?? 8888);
const root = resolve('dist');
const store = new MemoryShareStore();
const mime: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};
const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url ?? '/', `http://127.0.0.1:${port}`);
    if (url.pathname.startsWith('/api/partner/')) {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of incoming) {
        size += chunk.length;
        if (size > 48000) {
          outgoing.writeHead(413);
          outgoing.end();
          return;
        }
        chunks.push(chunk);
      }
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers))
        if (typeof value === 'string') headers.set(name, value);
      const request = new Request(url, {
        method: incoming.method,
        headers,
        ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
      });
      const result = await partnerApi(request, store);
      outgoing.writeHead(result.status, Object.fromEntries(result.headers));
      outgoing.end(await result.text());
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      outgoing.writeHead(404);
      outgoing.end();
      return;
    }
    const pathname = ['/', '/partner', '/partner/setup'].includes(url.pathname)
      ? '/index.html'
      : url.pathname;
    const file = resolve(root, '.' + pathname);
    if (!file.startsWith(root + sep)) {
      outgoing.writeHead(403);
      outgoing.end();
      return;
    }
    const body = await readFile(file);
    outgoing.writeHead(200, {
      'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    });
    outgoing.end(body);
  } catch {
    outgoing.writeHead(503, { 'Cache-Control': 'no-store' });
    outgoing.end();
  }
});
server.listen(port, '127.0.0.1', () =>
  process.stdout.write(
    `Local Partner View test server: http://127.0.0.1:${port} (ephemeral store; never production)\n`,
  ),
);
