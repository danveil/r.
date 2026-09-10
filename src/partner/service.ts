import type { AppData } from '../types';
import { todayKey } from '../lib/dates';
import { readData } from '../db/database';
import { createSnapshot } from './snapshot';
import { decryptSnapshot, encryptSnapshot, randomSecret, tokenHash } from './crypto';
import { PartnerError, requestShare } from './api';
import { partnerDB, type PrimaryConnection, type PartnerConnection } from './storage';
import { parseEnvelope, type Invitation, type Permissions, type Snapshot } from './protocol';

// Queue primary operations in this tab; server conditional writes arbitrate across tabs/devices.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => {});
  return next;
}
async function updatePrimary(id: string, changes: Partial<PrimaryConnection>) {
  await partnerDB.transaction('rw', partnerDB.primary, async () => {
    const current = await partnerDB.primary.get('primary');
    if (current?.id === id && current.state !== 'revoking')
      await partnerDB.primary.update('primary', changes);
  });
}
async function revokePending() {
  const current = await partnerDB.primary.get('primary');
  if (!current || current.state !== 'revoking') return;
  try {
    await requestShare(current.id, current.write, 'DELETE');
  } catch (error) {
    if (!(error instanceof PartnerError && error.reason === 'unavailable')) {
      await partnerDB.primary.update('primary', {
        error: 'Stopping is pending. Reconnect and retry to revoke remote access.',
      });
      throw error;
    }
  }
  await partnerDB.transaction('rw', partnerDB.primary, async () => {
    if ((await partnerDB.primary.get('primary'))?.id === current.id)
      await partnerDB.primary.delete('primary');
  });
}
export async function stopSharing() {
  const current = await partnerDB.primary.get('primary');
  if (!current) return;
  await partnerDB.primary.update('primary', { state: 'revoking', error: undefined });
  return serial(revokePending);
}
export async function enableSharing(permissions: Permissions) {
  if (!Object.values(permissions).some(Boolean)) throw new Error('Choose at least one category to share.');
  const connection: PrimaryConnection = {
    slot: 'primary',
    id: randomSecret(),
    key: randomSecret(),
    write: randomSecret(),
    invitation: randomSecret(),
    permissions: { ...permissions },
    state: 'creating',
    createdAt: Date.now(),
  };
  await partnerDB.transaction('rw', partnerDB.primary, async () => {
    if (await partnerDB.primary.get('primary'))
      throw new Error('Stop the existing connection before pairing again.');
    await partnerDB.primary.add(connection);
  });
  await syncPrimary(true);
}
export async function syncPrimary(force = false, data?: AppData) {
  return serial(async () => {
    const c = await partnerDB.primary.get('primary');
    if (!c) return;
    if (c.state === 'revoking') return revokePending();
    const snapshot = createSnapshot(data ?? (await readData()), c.permissions, todayKey());
    const fingerprint = JSON.stringify({ ...snapshot, generatedAt: '' });
    if (!force && c.fingerprint === fingerprint && c.state !== 'creating') return;
    try {
      const envelope = await encryptSnapshot(snapshot, c.key, c.id);
      if (c.state === 'creating') {
        try {
          const result = await requestShare(c.id, c.write, 'POST', {
            operation: 'create',
            invitationHash: await tokenHash(c.invitation),
            envelope,
          });
          await updatePrimary(c.id, {
            state: 'pending',
            invitationExpiresAt: Number(result.expiresAt),
            lastSync: Date.now(),
            fingerprint,
            error: undefined,
          });
          return;
        } catch (error) {
          if (!(error instanceof PartnerError && error.reason === 'conflict'))
            throw error; /* A lost create response can be resolved with writer authentication. */
        }
      }
      const latest = await partnerDB.primary.get('primary');
      if (latest?.id !== c.id || latest.state === 'revoking') return;
      const status = await requestShare(c.id, c.write);
      await requestShare(c.id, c.write, 'POST', { operation: 'publish', envelope });
      await updatePrimary(c.id, {
        state: status.state === 'active' ? 'active' : 'pending',
        invitationExpiresAt: status.state === 'pending' ? Number(status.expiresAt) : c.invitationExpiresAt,
        lastSync: Date.now(),
        fingerprint,
        error: undefined,
      });
    } catch (error) {
      await updatePrimary(c.id, {
        error: error instanceof PartnerError ? error.message : 'Couldn’t prepare this update. Try again.',
      });
      throw error;
    }
  });
}
export async function previewInvitation(invite: Invitation): Promise<Snapshot> {
  const result = await requestShare(invite.id, invite.invitation, 'POST', { operation: 'preview' });
  try {
    return await decryptSnapshot(result.envelope, invite.key, invite.id);
  } catch {
    throw new PartnerError('invalid');
  }
}
export async function acceptInvitation(invite: Invitation): Promise<Snapshot> {
  await partnerDB.transaction('rw', partnerDB.partner, async () => {
    const connection = await partnerDB.partner.get('partner');
    if (connection && connection.id !== invite.id)
      throw new Error('Disconnect the existing Partner View before accepting another invitation.');
    if (!connection)
      await partnerDB.partner.put({
        slot: 'partner',
        id: invite.id,
        key: invite.key,
        read: randomSecret(),
        invitation: invite.invitation,
        state: 'accepting',
      });
  });
  const snapshot = await refreshPartner();
  await partnerDB.preferences.put({ id: 'role', value: 'partner' });
  return snapshot;
}
export async function refreshPartner(): Promise<Snapshot> {
  const connection = await partnerDB.partner.get('partner');
  if (!connection) throw new PartnerError('unavailable');
  try {
    if (connection.state === 'accepting')
      await requestShare(connection.id, connection.invitation!, 'POST', {
        operation: 'accept',
        readHash: await tokenHash(connection.read),
      });
    const result = await requestShare(connection.id, connection.read);
    let snapshot: Snapshot;
    try {
      snapshot = await decryptSnapshot(result.envelope, connection.key, connection.id);
    } catch {
      throw new PartnerError('invalid');
    }
    if (connection.generatedAt && snapshot.generatedAt < connection.generatedAt)
      throw new PartnerError('invalid');
    await partnerDB.transaction('rw', partnerDB.partner, async () => {
      const current = await partnerDB.partner.get('partner');
      if (current?.id !== connection.id || current.read !== connection.read)
        throw new PartnerError('unavailable');
      if (current.generatedAt && snapshot.generatedAt < current.generatedAt)
        throw new PartnerError('invalid');
      const next: PartnerConnection = {
        slot: 'partner',
        id: connection.id,
        key: connection.key,
        read: connection.read,
        state: 'active',
        envelope: parseEnvelope(result.envelope),
        receivedAt: Date.now(),
        generatedAt: snapshot.generatedAt,
      };
      await partnerDB.partner.put(next);
    });
    return snapshot;
  } catch (error) {
    if (error instanceof PartnerError && error.reason === 'unavailable')
      await partnerDB.transaction('rw', partnerDB.partner, async () => {
        const current = await partnerDB.partner.get('partner');
        if (current?.id === connection.id && current.read === connection.read)
          await partnerDB.partner.delete('partner');
      });
    throw error;
  }
}
export async function cachedPartner(): Promise<Snapshot | null> {
  const c = await partnerDB.partner.get('partner');
  if (!c?.envelope) return null;
  try {
    return await decryptSnapshot(c.envelope, c.key, c.id);
  } catch {
    throw new PartnerError('invalid');
  }
}
