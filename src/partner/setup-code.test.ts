// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createSetupCode, parseSetupCode, INVALID_SETUP } from './setup-code';
import { randomSecret, invitationLink, parseInvitation, decode } from './crypto';
import type { Invitation } from './protocol';
const invite: Invitation = {
  version: 1,
  id: randomSecret(),
  invitation: randomSecret(),
  key: randomSecret(),
};
function unchecked(value: unknown) {
  const body = Buffer.from(JSON.stringify(value)).toString('base64url');
  return (
    'RAYANG1-' +
    body +
    '.' +
    createHash('sha256')
      .update('RAYANG1-' + body)
      .digest('base64url')
  );
}
describe('portable setup code', () => {
  it('round-trips original v0.2 invitation material without changing entropy', async () => {
    const original = parseInvitation(new URL(invitationLink(invite, 'https://example.test')).hash);
    const code = await createSetupCode(original);
    expect(await parseSetupCode(code)).toEqual(invite);
    expect(await parseSetupCode(' \n' + code + '\n ')).toEqual(invite);
    expect(code.startsWith('RAYANG1-')).toBe(true);
    expect(decode((await parseSetupCode(code)).key)).toHaveLength(32);
  });
  it('contains only version, ID, invitation capability and key; no reader is issued in Safari', async () => {
    const body = JSON.parse(
      Buffer.from((await createSetupCode(invite)).slice(8).split('.')[0], 'base64url').toString(),
    );
    expect(Object.keys(body)).toEqual(['version', 'id', 'invitation', 'key']);
    expect(Object.keys(body).join(' ')).not.toMatch(
      /write|read|diary|symptoms|mood|note|calendar|period|snapshot|profile/,
    );
  });
  it.each([
    '',
    '123456',
    'RAYANG2-aaa.bbb',
    'RAYANG1-%%%.aaa',
    'RAYANG1-a',
    'RAYANG1-a.b.c',
    'x'.repeat(1201),
  ])('rejects malformed, unsupported or truncated code %s', async (value) => {
    await expect(parseSetupCode(value)).rejects.toThrow(INVALID_SETUP);
  });
  it.each([
    { ...invite, version: 2 },
    { ...invite, key: undefined },
    { ...invite, key: 'A'.repeat(42) },
    { ...invite, key: 'A'.repeat(44) },
    { ...invite, invitation: undefined },
    { ...invite, invitation: '123456' },
    { ...invite, id: '123' },
    { ...invite, write: randomSecret() },
    { ...invite, read: randomSecret() },
    { ...invite, algorithm: 'AES-CBC' },
    { ...invite, diary: ['private'] },
    { ...invite, symptoms: ['private'] },
    { ...invite, mood: ['private'] },
    { ...invite, notes: 'private' },
    { ...invite, snapshot: { date: '2026-09-09' } },
    { ...invite, key: 'A'.repeat(42) + 'B' },
  ])(
    'rejects missing/extra fields and invalid secret lengths even with a correct checksum',
    async (value) => {
      await expect(parseSetupCode(unchecked(value))).rejects.toThrow(INVALID_SETUP);
      await expect(createSetupCode(value as Invitation)).rejects.toThrow(INVALID_SETUP);
    },
  );
  it('detects modified payload, truncation and checksum corruption before any network access', async () => {
    const code = await createSetupCode(invite);
    for (const bad of [
      code.slice(0, -1),
      code.slice(0, 20) + ' ' + code.slice(20),
      code.slice(0, -1) + (code.endsWith('A') ? 'B' : 'A'),
      code.replace('RAYANG1-', 'RAYANG1-A'),
    ])
      await expect(parseSetupCode(bad)).rejects.toThrow(INVALID_SETUP);
  });
});
