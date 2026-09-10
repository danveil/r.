import { decode, encode, parseInvitation } from './crypto';
import type { Invitation } from './protocol';
export const INVALID_SETUP = "This setup code isn't valid. Ask your partner to create a new invitation.";
const prefix = 'RAYANG1-';
const utf8 = new TextEncoder();
// SHA-256 detects copying errors. It is not authentication: API capabilities and AES-GCM remain authoritative.
async function checksum(body: string) {
  return encode(new Uint8Array(await crypto.subtle.digest('SHA-256', utf8.encode(prefix + body))));
}
function canonical(value: unknown): Invitation {
  const invite = parseInvitation('#invite=' + encode(utf8.encode(JSON.stringify(value))));
  for (const secret of [invite.id, invite.invitation, invite.key])
    if (decode(secret).length !== 32 || encode(decode(secret)) !== secret) throw new Error(INVALID_SETUP);
  return { version: 1, id: invite.id, invitation: invite.invitation, key: invite.key };
}
export async function createSetupCode(value: Invitation): Promise<string> {
  try {
    const body = encode(utf8.encode(JSON.stringify(canonical(value))));
    return prefix + body + '.' + (await checksum(body));
  } catch {
    throw new Error(INVALID_SETUP);
  }
}
export async function parseSetupCode(input: string): Promise<Invitation> {
  try {
    if (input.length > 1200) throw new Error();
    const match = /^RAYANG1-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/.exec(input.trim());
    if (!match || (await checksum(match[1])) !== match[2]) throw new Error();
    const bytes = decode(match[1]);
    if (encode(bytes) !== match[1]) throw new Error();
    const value = canonical(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
    if (encode(utf8.encode(JSON.stringify(value))) !== match[1]) throw new Error();
    return value;
  } catch {
    throw new Error(INVALID_SETUP);
  }
}
