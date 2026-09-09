// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fixtureData } from '../test/fixtures';
import { createSnapshot, parseSnapshot } from './snapshot';
import {
  encryptSnapshot,
  decryptSnapshot,
  randomSecret,
  parseInvitation,
  invitationLink,
  decode,
  encode,
} from './crypto';
import { parseEnvelope, type Permissions } from './protocol';
const permissions: Permissions = { current: true, period: true, fertility: true };
const snapshot = () =>
  createSnapshot(fixtureData('2025-01-01'), permissions, '2025-01-13', '2025-01-13T12:00:00.000Z');
describe('minimal shared payload', () => {
  it('never serializes diary, symptoms, moods, notes, observations or profile values', () => {
    const data = fixtureData();
    Object.defineProperty(data, 'diary', {
      get: () => {
        throw new Error('Private diary accessed');
      },
    });
    Object.defineProperty(data, 'observations', {
      get: () => {
        throw new Error('Private observations accessed');
      },
    });
    const payload = JSON.stringify(createSnapshot(data, permissions, '2025-01-13'));
    for (const forbidden of [
      'diary',
      'symptoms',
      'mood',
      'note',
      'observations',
      'profile',
      'initialTypical',
      'createdAt',
      'recovery',
    ])
      expect(payload).not.toContain(forbidden);
    expect(JSON.parse(payload).calendar).toHaveLength(42);
  });
  it.each([0, 1, 2, 3, 4, 5, 6])('enforces independent category choices %s', (mask) => {
    const grants = { current: !!(mask & 1), period: !!(mask & 2), fertility: !!(mask & 4) };
    if (!mask) {
      expect(() => createSnapshot(fixtureData(), grants, '2025-01-13')).toThrow();
      return;
    }
    const s = createSnapshot(fixtureData(), grants, '2025-01-13');
    expect(!!s.current).toBe(grants.current);
    expect(!!s.period).toBe(grants.period);
    expect(!!s.fertility).toBe(grants.fertility);
    s.calendar.forEach((day) => {
      expect('period' in day).toBe(grants.period);
      expect('fertile' in day).toBe(grants.fertility);
    });
    if (!grants.fertility && s.current) expect(s.current.phase).not.toBe('fertile');
  });
  it('preserves date-only values across timezones and leap/year boundaries', () => {
    for (const date of ['2024-02-29', '2025-01-01', '2025-03-09', '2025-11-02'])
      expect(createSnapshot(fixtureData('2024-01-01'), permissions, date).date).toBe(date);
    expect(JSON.parse(JSON.stringify(snapshot())).date).toBe('2025-01-13');
  });
  it('rejects extra fields, schema mismatch and contradictory permissions', () => {
    expect(() => parseSnapshot({ ...snapshot(), diary: ['private'] })).toThrow();
    expect(() => parseSnapshot({ ...snapshot(), schemaVersion: 2 })).toThrow();
    expect(() =>
      parseSnapshot({ ...snapshot(), permissions: { current: false, period: true, fertility: true } }),
    ).toThrow();
  });
});
describe('Web Crypto envelope', () => {
  it('round-trips an authenticated snapshot', async () => {
    const key = randomSecret(),
      id = randomSecret();
    const encrypted = await encryptSnapshot(snapshot(), key, id);
    expect(await decryptSnapshot(encrypted, key, id)).toEqual(snapshot());
    expect(JSON.stringify(encrypted)).not.toContain('2025-01-13');
    expect(Object.keys(encrypted)).toEqual(['version', 'algorithm', 'iv', 'ciphertext']);
  });
  it('uses fresh IVs for every encryption under the same key', async () => {
    const key = randomSecret(),
      id = randomSecret();
    const values = await Promise.all(Array.from({ length: 100 }, () => encryptSnapshot(snapshot(), key, id)));
    expect(new Set(values.map((v) => v.iv)).size).toBe(100);
    values.forEach((v) => expect(decode(v.iv)).toHaveLength(12));
  });
  it('rejects wrong key, altered ciphertext, altered IV and another share context', async () => {
    const key = randomSecret(),
      id = randomSecret();
    const encrypted = await encryptSnapshot(snapshot(), key, id);
    await expect(decryptSnapshot(encrypted, randomSecret(), id)).rejects.toThrow();
    const bytes = decode(encrypted.ciphertext);
    bytes[0] ^= 1;
    await expect(decryptSnapshot({ ...encrypted, ciphertext: encode(bytes) }, key, id)).rejects.toThrow();
    await expect(
      decryptSnapshot({ ...encrypted, iv: encode(new Uint8Array(12)) }, key, id),
    ).rejects.toThrow();
    await expect(decryptSnapshot(encrypted, key, randomSecret())).rejects.toThrow();
  });
  it.each([
    {},
    { version: 2 },
    { version: 1, algorithm: 'AES-CBC', iv: 'abc', ciphertext: 'x' },
    { version: 1, algorithm: 'AES-256-GCM', iv: 'A'.repeat(16), ciphertext: 'A'.repeat(44001) },
  ])('rejects malformed envelopes', (value) => expect(() => parseEnvelope(value)).toThrow());
  it('puts pairing material only in a fragment, never a query or server path', () => {
    const invite = {
      version: 1 as const,
      id: randomSecret(),
      invitation: randomSecret(),
      key: randomSecret(),
    };
    const url = new URL(invitationLink(invite, 'https://example.test'));
    expect(url.search).toBe('');
    expect(url.pathname).toBe('/partner');
    expect(parseInvitation(url.hash)).toEqual(invite);
    expect(url.origin + url.pathname).not.toContain(invite.key);
  });
  it.each(['#invite=bad', '#invite=', '?key=abc', '#home'])('rejects invalid invitation %s', (value) =>
    expect(() => parseInvitation(value)).toThrow(),
  );
});
