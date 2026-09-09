import { createHash, timingSafeEqual } from 'node:crypto';
import { exact, object, parseEnvelope, SECRET, type Envelope } from '../src/partner/protocol';
export interface ShareRecord {
  state: 'pending' | 'active' | 'revoked';
  writeHash: string;
  invitationHash?: string;
  readHash?: string;
  envelope?: Envelope;
  expiresAt: number;
  updatedAt: number;
}
export interface StoredShare {
  value: ShareRecord;
  etag: string;
}
export interface ShareStore {
  get(id: string): Promise<StoredShare | null>;
  put(id: string, value: ShareRecord, etag?: string): Promise<boolean>;
  delete(id: string): Promise<void>;
  list(): AsyncIterable<string>;
}
export const hash = (token: string) => createHash('sha256').update(token).digest('base64url');
const equal = (a: string | undefined, b: string) =>
  !!a && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export const INVITE_TTL = 10 * 60 * 1000;
export const SHARE_TTL = 30 * 24 * 60 * 60 * 1000;
const headers = {
  'X-Rayang-Partner': '1',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, private',
  'Netlify-CDN-Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};
const response = (status: number, value: object = { error: 'Unavailable' }) =>
  new Response(JSON.stringify(value), { status, headers });
async function boundedJson(request: Request): Promise<Record<string, unknown>> {
  if (
    request.headers.get('content-type')?.split(';')[0] !== 'application/json' ||
    Number(request.headers.get('content-length') ?? 0) > 48000
  )
    throw new Error('Invalid');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Invalid');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.length;
    if (size > 48000) {
      await reader.cancel();
      throw new Error('Invalid');
    }
    chunks.push(next.value);
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!object(value)) throw new Error('Invalid');
  return value;
}
export async function partnerApi(request: Request, store: ShareStore, now = Date.now()): Promise<Response> {
  const url = new URL(request.url);
  const id = /^\/api\/partner\/([A-Za-z0-9_-]{43})$/.exec(url.pathname)?.[1] ?? '';
  if (!SECRET.test(id) || url.search || !['GET', 'POST', 'DELETE'].includes(request.method))
    return response(404);
  if (request.headers.get('origin') && request.headers.get('origin') !== url.origin) return response(404);
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!SECRET.test(token)) return response(404);
  const digest = hash(token);
  let body: Record<string, unknown> = {};
  if (request.method === 'POST') {
    try {
      body = await boundedJson(request);
    } catch {
      return response(400);
    }
  }
  try {
    if (body.operation === 'create') {
      if (
        !exact(body, ['operation', 'invitationHash', 'envelope']) ||
        typeof body.invitationHash !== 'string' ||
        !SECRET.test(body.invitationHash)
      )
        return response(400);
      let envelope: Envelope;
      try {
        envelope = parseEnvelope(body.envelope);
      } catch {
        return response(400);
      }
      const saved = await store.put(id, {
        state: 'pending',
        writeHash: digest,
        invitationHash: body.invitationHash,
        envelope,
        expiresAt: now + INVITE_TTL,
        updatedAt: now,
      });
      if (!saved) return response(409);
      return response(201, { expiresAt: now + INVITE_TTL });
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const entry = await store.get(id);
      if (!entry) {
        // Fence a create racing with cancellation in another tab. No health data is stored.
        if (request.method !== 'DELETE') return response(404);
        if (await store.put(id, { state: 'revoked', writeHash: digest, expiresAt: now, updatedAt: now }))
          return response(200, { revoked: true });
        continue;
      }
      const current = entry.value;
      const writer = equal(current.writeHash, digest);
      if (request.method === 'DELETE') {
        if (!writer) return response(404);
        if (current.state === 'revoked') return response(200, { revoked: true });
        if (
          await store.put(
            id,
            { state: 'revoked', writeHash: current.writeHash, expiresAt: now, updatedAt: now },
            entry.etag,
          )
        )
          return response(200, { revoked: true });
        continue;
      }
      if (current.state === 'revoked' || current.expiresAt <= now) return response(404);
      if (request.method === 'GET') {
        if (writer) return response(200, { state: current.state, expiresAt: current.expiresAt });
        if (current.state !== 'active' || !equal(current.readHash, digest)) return response(404);
        return response(200, { envelope: current.envelope });
      }
      if (body.operation === 'preview' && exact(body, ['operation'])) {
        if (current.state !== 'pending' || !equal(current.invitationHash, digest)) return response(404);
        return response(200, { envelope: current.envelope, expiresAt: current.expiresAt });
      }
      if (
        body.operation === 'accept' &&
        exact(body, ['operation', 'readHash']) &&
        typeof body.readHash === 'string' &&
        SECRET.test(body.readHash)
      ) {
        if (!equal(current.invitationHash, digest)) return response(404);
        if (current.state === 'active')
          return equal(current.readHash, body.readHash) ? response(200, { accepted: true }) : response(404);
        const next: ShareRecord = {
          ...current,
          state: 'active',
          readHash: body.readHash,
          expiresAt: now + SHARE_TTL,
          updatedAt: now,
        };
        if (await store.put(id, next, entry.etag)) return response(200, { accepted: true });
        continue;
      }
      if (body.operation === 'publish' && exact(body, ['operation', 'envelope'])) {
        if (!writer) return response(404);
        let envelope: Envelope;
        try {
          envelope = parseEnvelope(body.envelope);
        } catch {
          return response(400);
        }
        const next = {
          ...current,
          envelope,
          expiresAt: current.state === 'pending' ? current.expiresAt : now + SHARE_TTL,
          updatedAt: now,
        };
        if (await store.put(id, next, entry.etag)) return response(200, { state: next.state });
        continue;
      }
      return response(404);
    }
    return response(409);
  } catch {
    return response(503);
  }
}
export async function cleanupShares(store: ShareStore, now = Date.now()) {
  for await (const id of store.list()) {
    const entry = await store.get(id);
    if (!entry) continue;
    if (entry.value.state === 'revoked') {
      if (entry.value.updatedAt < now - 7 * 24 * 60 * 60 * 1000) await store.delete(id);
    } else if (entry.value.expiresAt <= now)
      await store.put(
        id,
        { state: 'revoked', writeHash: entry.value.writeHash, expiresAt: now, updatedAt: now },
        entry.etag,
      );
  }
}
