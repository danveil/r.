import {
  parseEnvelope,
  requireProtocol,
  object,
  exact,
  SECRET,
  type Envelope,
  type Invitation,
  type Snapshot,
} from './protocol';
import { parseSnapshot } from './snapshot';
const encoder = new TextEncoder();
export const encode = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
export const decode = (value: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0));
export const randomSecret = (): string => encode(crypto.getRandomValues(new Uint8Array(32)));
export async function tokenHash(token: string): Promise<string> {
  requireProtocol(SECRET.test(token));
  return encode(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token))));
}
async function contentKey(value: string) {
  requireProtocol(SECRET.test(value));
  return crypto.subtle.importKey('raw', decode(value), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
const aad = (id: string) => {
  requireProtocol(SECRET.test(id));
  return encoder.encode(`rayang-partner:1:${id}`);
};
export async function encryptSnapshot(snapshot: Snapshot, key: string, id: string): Promise<Envelope> {
  const plaintext = encoder.encode(JSON.stringify(parseSnapshot(snapshot)));
  requireProtocol(plaintext.length <= 32000);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad(id), tagLength: 128 },
    await contentKey(key),
    plaintext,
  );
  return {
    version: 1,
    algorithm: 'AES-256-GCM',
    iv: encode(iv),
    ciphertext: encode(new Uint8Array(ciphertext)),
  };
}
export async function decryptSnapshot(input: unknown, key: string, id: string): Promise<Snapshot> {
  const envelope = parseEnvelope(input);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decode(envelope.iv), additionalData: aad(id), tagLength: 128 },
    await contentKey(key),
    decode(envelope.ciphertext),
  );
  requireProtocol(plaintext.byteLength <= 32000);
  return parseSnapshot(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext)));
}
export function invitationLink(invitation: Invitation, origin = location.origin): string {
  return `${origin}/partner#invite=${encode(encoder.encode(JSON.stringify(invitation)))}`;
}
export function parseInvitation(fragment: string): Invitation {
  requireProtocol(fragment.startsWith('#invite=') && fragment.length < 1000);
  const value: unknown = JSON.parse(new TextDecoder().decode(decode(fragment.slice(8))));
  requireProtocol(
    object(value) &&
      exact(value, ['version', 'id', 'invitation', 'key']) &&
      value.version === 1 &&
      ['id', 'invitation', 'key'].every(
        (k) => typeof value[k] === 'string' && SECRET.test(value[k] as string),
      ),
  );
  return value as unknown as Invitation;
}
