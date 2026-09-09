import Dexie, { type Table } from 'dexie';
import type { Envelope, Permissions } from './protocol';
export interface PrimaryConnection {
  slot: 'primary';
  id: string;
  key: string;
  write: string;
  invitation: string;
  permissions: Permissions;
  state: 'creating' | 'pending' | 'active' | 'revoking';
  createdAt: number;
  invitationExpiresAt?: number;
  lastSync?: number;
  fingerprint?: string;
  error?: string;
}
export interface PartnerConnection {
  slot: 'partner';
  id: string;
  key: string;
  read: string;
  invitation?: string;
  state: 'accepting' | 'active';
  envelope?: Envelope;
  receivedAt?: number;
  generatedAt?: string;
}
export class PartnerDB extends Dexie {
  primary!: Table<PrimaryConnection, string>;
  partner!: Table<PartnerConnection, string>;
  preferences!: Table<{ id: 'role'; value: 'partner' }, string>;
  constructor(name = 'rayang-partner') {
    super(name);
    this.version(1).stores({ primary: 'slot', partner: 'slot', preferences: 'id' });
  }
}
export const partnerDB = new PartnerDB();
export async function guardSharingStopped() {
  if (await partnerDB.primary.get('primary'))
    throw new Error('Stop Partner Sharing in Settings before replacing or deleting your history.');
}
export async function clearPartner() {
  await partnerDB.partner.delete('partner');
}
