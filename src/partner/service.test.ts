// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { MemoryShareStore } from '../../server/testing';
import { partnerApi } from '../../server/partner-api';
import { db, readData, deleteAllData, importData } from '../db/database';
import { makeBackup } from '../lib/validation';
import { fixtureData } from '../test/fixtures';
import { todayKey, shift } from '../lib/dates';
import { partnerDB, clearPartner } from './storage';
import {
  enableSharing,
  syncPrimary,
  stopSharing,
  previewInvitation,
  acceptInvitation,
  refreshPartner,
  cachedPartner,
} from './service';
import { encryptSnapshot } from './crypto';
import { requestShare } from './api';
import type { Invitation } from './protocol';

let store: MemoryShareStore;
let network: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  for (const table of partnerDB.tables) await table.clear();
  await deleteAllData();
  await importData(fixtureData(shift(todayKey(), -12)));
  store = new MemoryShareStore();
  network = vi.fn(async (url: string, init: RequestInit) =>
    partnerApi(new Request(`https://example.test${url}`, init), store),
  );
  vi.stubGlobal('fetch', network);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function pair(): Promise<Invitation> {
  await enableSharing({ current: true, period: true, fertility: false });
  const c = (await partnerDB.primary.get('primary'))!;
  const invite: Invitation = { version: 1, id: c.id, key: c.key, invitation: c.invitation };
  expect((await previewInvitation(invite)).permissions.fertility).toBe(false);
  await acceptInvitation(invite);
  return invite;
}
it('does no requests while sharing is off', async () => {
  await syncPrimary(true);
  await syncPrimary(false, await readData());
  expect(network).not.toHaveBeenCalled();
});
it('does not activate partner mode before a successful claim and decrypted cache write', async () => {
  await enableSharing({ current: true, period: false, fertility: false });
  const c = (await partnerDB.primary.get('primary'))!;
  const invite: Invitation = { version: 1, id: c.id, key: c.key, invitation: c.invitation };
  network.mockRejectedValueOnce(new TypeError('offline'));
  await expect(acceptInvitation(invite)).rejects.toThrow('Couldn’t connect');
  expect(await partnerDB.preferences.get('role')).toBeUndefined();
  expect((await partnerDB.partner.get('partner'))?.state).toBe('accepting');
  const reader = (await partnerDB.partner.get('partner'))!.read;
  await acceptInvitation(invite);
  expect((await partnerDB.preferences.get('role'))?.value).toBe('partner');
  expect((await partnerDB.partner.get('partner'))?.read).toBe(reader);
  expect((await partnerDB.partner.get('partner'))?.envelope).toBeDefined();
});
it('recovers a lost create response without issuing new credentials', async () => {
  network.mockImplementationOnce(async (url: string, init: RequestInit) => {
    await partnerApi(new Request(`https://example.test${url}`, init), store);
    throw new TypeError('response lost');
  });
  await expect(enableSharing({ current: true, period: false, fertility: false })).rejects.toThrow(
    'Couldn’t connect',
  );
  const before = (await partnerDB.primary.get('primary'))!;
  expect(before.state).toBe('creating');
  await syncPrimary(true);
  const after = (await partnerDB.primary.get('primary'))!;
  expect(after.id).toBe(before.id);
  expect(after.key).toBe(before.key);
  expect(after.state).toBe('pending');
});
it('retries a lost claim acknowledgment with the same persisted reader capability', async () => {
  await enableSharing({ current: true, period: false, fertility: false });
  const c = (await partnerDB.primary.get('primary'))!;
  const invite: Invitation = { version: 1, id: c.id, key: c.key, invitation: c.invitation };
  network.mockImplementationOnce(async (url: string, init: RequestInit) => {
    await partnerApi(new Request(`https://example.test${url}`, init), store);
    throw new TypeError('response lost');
  });
  await expect(acceptInvitation(invite)).rejects.toThrow('Couldn’t connect');
  const reader = (await partnerDB.partner.get('partner'))!.read;
  await refreshPartner();
  expect((await partnerDB.partner.get('partner'))?.read).toBe(reader);
  expect(await cachedPartner()).not.toBeNull();
});
it('pairs, publishes cycle changes, and never publishes diary-only changes', async () => {
  await pair();
  network.mockClear();
  const data = await readData();
  await syncPrimary(false, {
    ...data,
    diary: [
      { date: todayKey(), note: 'SECRET DIARY', mood: [], symptoms: [], updatedAt: new Date().toISOString() },
    ],
  });
  expect(network).not.toHaveBeenCalled();
  const changed = {
    ...data,
    periods: [{ ...data.periods[0], startDate: shift(data.periods[0].startDate, -1) }],
  };
  await syncPrimary(false, changed);
  expect((await refreshPartner()).current?.cycleDay).toBe(14);
  const bodies = network.mock.calls.map((call) => call[1]?.body ?? '').join('');
  expect(bodies).not.toMatch(/SECRET DIARY|cycleDay|symptoms|diary|startDate/);
});
it('keeps the cache encrypted and excludes every credential from primary backups', async () => {
  const invite = await pair();
  const c = (await partnerDB.partner.get('partner'))!;
  expect(c.invitation).toBeUndefined();
  expect(JSON.stringify(c.envelope)).not.toMatch(/cycleDay|calendar|permissions/);
  expect(await cachedPartner()).toMatchObject({ permissions: { fertility: false } });
  const backup = JSON.stringify(makeBackup(await readData()));
  [invite.id, invite.key, invite.invitation, c.read].forEach((secret) =>
    expect(backup).not.toContain(secret),
  );
});
it('preserves v1 primary records when the separate sharing database opens and closes', async () => {
  const before = await readData();
  await pair();
  db.close();
  await db.open();
  expect(db.verno).toBe(1);
  expect(await readData()).toEqual(before);
  await expect(deleteAllData()).rejects.toThrow('Stop Partner Sharing');
  await expect(importData(before)).rejects.toThrow('Stop Partner Sharing');
  expect(await readData()).toEqual(before);
});
it('keeps offline revocation pending, blocks new sharing, then revokes and clears partner cache', async () => {
  await pair();
  network.mockRejectedValueOnce(new TypeError('offline'));
  await expect(stopSharing()).rejects.toThrow('Couldn’t connect');
  expect((await partnerDB.primary.get('primary'))?.state).toBe('revoking');
  await expect(enableSharing({ current: true, period: false, fertility: false })).rejects.toThrow(
    'Stop the existing',
  );
  network.mockClear();
  await syncPrimary();
  expect(network.mock.calls[0][1].method).toBe('DELETE');
  expect(await partnerDB.primary.get('primary')).toBeUndefined();
  await expect(refreshPartner()).rejects.toThrow('no longer available');
  expect(await cachedPartner()).toBeNull();
});
it('retains the last valid cache on offline, malformed and tampered responses', async () => {
  await pair();
  const before = await cachedPartner();
  network.mockRejectedValueOnce(new TypeError('offline'));
  await expect(refreshPartner()).rejects.toThrow('Couldn’t connect');
  network.mockResolvedValueOnce(
    new Response('<html>missing API</html>', { headers: { 'Content-Type': 'text/html' } }),
  );
  await expect(refreshPartner()).rejects.toThrow('couldn’t read');
  network.mockResolvedValueOnce(
    Response.json({
      envelope: { version: 1, algorithm: 'AES-256-GCM', iv: 'AAAAAAAAAAAAAAAA', ciphertext: 'A'.repeat(64) },
    }),
  );
  await expect(refreshPartner()).rejects.toThrow('couldn’t read');
  expect(await cachedPartner()).toEqual(before);
});
it('rejects an older authenticated snapshot without replacing the cache', async () => {
  const invite = await pair();
  const before = (await cachedPartner())!;
  const envelope = await encryptSnapshot(
    { ...before, generatedAt: '2025-01-01T00:00:00.000Z' },
    invite.key,
    invite.id,
  );
  network.mockResolvedValueOnce(Response.json({ envelope }));
  await expect(refreshPartner()).rejects.toThrow('couldn’t read');
  expect(await cachedPartner()).toEqual(before);
});
it('does not restore a cache when an in-flight refresh finishes after disconnect', async () => {
  await pair();
  let release!: (value: Response) => void;
  let entered!: () => void;
  const waiting = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const c = (await partnerDB.partner.get('partner'))!;
  network.mockImplementationOnce(() => {
    entered();
    return new Promise<Response>((resolve) => {
      release = resolve;
    });
  });
  const refreshed = refreshPartner();
  const rejected = expect(refreshed).rejects.toThrow('no longer available');
  await waiting;
  await clearPartner();
  release(Response.json({ envelope: c.envelope }));
  await rejected;
  expect(await cachedPartner()).toBeNull();
});
it('times out stalled requests without discarding credentials', async () => {
  const invite = await pair();
  vi.useFakeTimers();
  network.mockImplementationOnce(
    (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) =>
        init.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
      ),
  );
  const result = expect(requestShare(invite.id, invite.invitation)).rejects.toThrow('Couldn’t connect');
  await vi.advanceTimersByTimeAsync(10001);
  await result;
  vi.useRealTimers();
  expect(await partnerDB.partner.get('partner')).toBeDefined();
});
