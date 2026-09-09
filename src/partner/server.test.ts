// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryShareStore } from '../../server/testing';
import { cleanupShares, hash, INVITE_TTL, partnerApi, SHARE_TTL } from '../../server/partner-api';
import { randomSecret, encryptSnapshot } from './crypto';
import { createSnapshot } from './snapshot';
import { fixtureData } from '../test/fixtures';
let store: MemoryShareStore;
let id: string;
let write: string;
let invitation: string;
let read: string;
const now = 1750000000000;
const request = (token: string, method = 'GET', body?: object) =>
  new Request(`https://example.test/api/partner/${id}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
async function create() {
  const envelope = await encryptSnapshot(
    createSnapshot(fixtureData(), { current: true, period: true, fertility: true }, '2025-01-13'),
    randomSecret(),
    id,
  );
  const result = await partnerApi(
    request(write, 'POST', { operation: 'create', invitationHash: hash(invitation), envelope }),
    store,
    now,
  );
  expect(result.status).toBe(201);
  return envelope;
}
async function accept() {
  return partnerApi(
    request(invitation, 'POST', { operation: 'accept', readHash: hash(read) }),
    store,
    now + 1,
  );
}
beforeEach(() => {
  store = new MemoryShareStore();
  id = randomSecret();
  write = randomSecret();
  invitation = randomSecret();
  read = randomSecret();
});
describe('capability API', () => {
  it('rejects alternate function URLs that would bypass the configured rate-limit path', async () => {
    await create();
    const alternate = new Request(`https://example.test/.netlify/functions/partner/${id}`, {
      headers: { Authorization: `Bearer ${write}` },
    });
    expect((await partnerApi(alternate, store, now)).status).toBe(404);
  });
  it('fences creation that arrives after cancellation in another tab', async () => {
    expect((await partnerApi(request(write, 'DELETE'), store, now)).status).toBe(200);
    const envelope = await encryptSnapshot(
      createSnapshot(fixtureData(), { current: true, period: false, fertility: false }, '2025-01-13'),
      randomSecret(),
      id,
    );
    expect(
      (
        await partnerApi(
          request(write, 'POST', { operation: 'create', invitationHash: hash(invitation), envelope }),
          store,
          now + 1,
        )
      ).status,
    ).toBe(409);
    expect((await store.get(id))?.value.envelope).toBeUndefined();
  });
  it('allows only invitation preview, then reader downloads, and writer publication', async () => {
    const envelope = await create();
    expect((await partnerApi(request(read), store, now)).status).toBe(404);
    expect((await partnerApi(request(invitation, 'POST', { operation: 'preview' }), store, now)).status).toBe(
      200,
    );
    expect((await accept()).status).toBe(200);
    expect((await partnerApi(request(read), store, now + 2)).status).toBe(200);
    expect(
      (await partnerApi(request(read, 'POST', { operation: 'publish', envelope }), store, now + 2)).status,
    ).toBe(404);
    expect((await partnerApi(request(read, 'DELETE'), store, now + 2)).status).toBe(404);
    expect(
      (await partnerApi(request(write, 'POST', { operation: 'publish', envelope }), store, now + 2)).status,
    ).toBe(200);
    expect((await partnerApi(request(write), store, now + 2)).headers.get('cache-control')).toContain(
      'no-store',
    );
  });
  it('stores capability hashes but no keys or plaintext', async () => {
    await create();
    await accept();
    const raw = JSON.stringify((await store.get(id))!.value);
    [write, invitation, read, '2025-01-13', 'cycleDay', 'diary'].forEach((v) => expect(raw).not.toContain(v));
    expect(raw).toContain(hash(write));
  });
  it('has one winner for concurrent claims, with idempotent retry only for that reader', async () => {
    await create();
    const another = randomSecret();
    const [a, b] = await Promise.all([
      accept(),
      partnerApi(
        request(invitation, 'POST', { operation: 'accept', readHash: hash(another) }),
        store,
        now + 1,
      ),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 404]);
    expect((await accept()).status).toBe(200);
    expect(
      (await partnerApi(request(invitation, 'POST', { operation: 'preview' }), store, now + 2)).status,
    ).toBe(404);
  });
  it('rejects expired invitations and snapshots', async () => {
    await create();
    expect(
      (await partnerApi(request(invitation, 'POST', { operation: 'preview' }), store, now + INVITE_TTL))
        .status,
    ).toBe(404);
    expect(
      (
        await partnerApi(
          request(invitation, 'POST', { operation: 'accept', readHash: hash(read) }),
          store,
          now + INVITE_TTL,
        )
      ).status,
    ).toBe(404);
    await accept();
    expect((await partnerApi(request(read), store, now + SHARE_TTL + 2)).status).toBe(404);
  });
  it('revoke removes ciphertext and prevents future uploads/downloads', async () => {
    const envelope = await create();
    await accept();
    expect((await partnerApi(request(write, 'DELETE'), store, now + 2)).status).toBe(200);
    expect((await store.get(id))!.value.envelope).toBeUndefined();
    expect((await partnerApi(request(read), store, now + 3)).status).toBe(404);
    expect(
      (await partnerApi(request(write, 'POST', { operation: 'publish', envelope }), store, now + 3)).status,
    ).toBe(404);
    expect((await partnerApi(request(write, 'DELETE'), store, now + 3)).status).toBe(200);
  });
  it('cannot resurrect a revoked snapshot with an older ETag', async () => {
    await create();
    const old = (await store.get(id))!;
    await partnerApi(request(write, 'DELETE'), store, now + 2);
    expect(await store.put(id, old.value, old.etag)).toBe(false);
    expect((await store.get(id))!.value.state).toBe('revoked');
  });
  it('fails closed when storage is unavailable', async () => {
    store.get = async () => {
      throw new Error('Failure');
    };
    expect((await partnerApi(request(read), store, now)).status).toBe(503);
  });
  it('uses a generic response for invalid tokens and missing identifiers', async () => {
    await create();
    const first = await partnerApi(request(randomSecret()), store, now);
    id = randomSecret();
    const second = await partnerApi(request(read), store, now);
    expect(first.status).toBe(second.status);
    expect(await first.text()).toBe(await second.text());
  });
  it('rejects malformed envelopes, oversized JSON, wrong content type and cross-origin requests', async () => {
    expect(
      (
        await partnerApi(
          request(write, 'POST', { operation: 'create', invitationHash: hash(invitation), envelope: {} }),
          store,
          now,
        )
      ).status,
    ).toBe(400);
    expect((await partnerApi(request(write, 'POST', { data: 'x'.repeat(49000) }), store, now)).status).toBe(
      400,
    );
    const wrong = request(write, 'POST', {});
    wrong.headers.set('content-type', 'text/plain');
    expect((await partnerApi(wrong, store, now)).status).toBe(400);
    const cross = request(write);
    cross.headers.set('origin', 'https://attacker.test');
    expect((await partnerApi(cross, store, now)).status).toBe(404);
  });
  it('cleans expired ciphertext and aged tombstones', async () => {
    await create();
    await cleanupShares(store, now + INVITE_TTL);
    expect((await store.get(id))!.value.envelope).toBeUndefined();
    await cleanupShares(store, now + INVITE_TTL + 8 * 24 * 60 * 60 * 1000);
    expect(await store.get(id)).toBeNull();
  });
});
