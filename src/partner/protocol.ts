export const SECRET = /^[A-Za-z0-9_-]{43}$/;
export interface Permissions {
  current: boolean;
  period: boolean;
  fertility: boolean;
}
export const PERMISSION_LABELS: Record<keyof Permissions, string> = {
  current: 'Current cycle and phase',
  period: 'Period calendar and estimates',
  fertility: 'Fertility estimates',
};
export type SharedPhase = 'menstrual' | 'follicular' | 'fertile' | 'ovulation' | 'luteal' | 'unknown';
export interface SharedDay {
  date: string;
  period?: 'actual' | 'estimated' | 'none';
  fertile?: boolean;
  ovulation?: boolean;
}
export interface Snapshot {
  schemaVersion: 1;
  generatedAt: string;
  date: string;
  permissions: Permissions;
  current?: { phase: SharedPhase; cycleDay: number | null; isActualPeriod: boolean };
  period?: { start: string; end: string; rangeStart: string; rangeEnd: string };
  fertility?: { start: string; end: string; ovulation: string };
  calendar: SharedDay[];
}
export interface Envelope {
  version: 1;
  algorithm: 'AES-256-GCM';
  iv: string;
  ciphertext: string;
}
export interface Invitation {
  version: 1;
  id: string;
  invitation: string;
  key: string;
}
export function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
export function exact(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).every((k) => keys.includes(k));
}
export function requireProtocol(value: unknown): asserts value {
  if (!value) throw new Error('Invalid partner data');
}
export function parseEnvelope(value: unknown): Envelope {
  requireProtocol(
    object(value) &&
      exact(value, ['version', 'algorithm', 'iv', 'ciphertext']) &&
      value.version === 1 &&
      value.algorithm === 'AES-256-GCM' &&
      typeof value.iv === 'string' &&
      /^[A-Za-z0-9_-]{16}$/.test(value.iv) &&
      typeof value.ciphertext === 'string' &&
      /^[A-Za-z0-9_-]{22,44000}$/.test(value.ciphertext),
  );
  return {
    version: 1,
    algorithm: 'AES-256-GCM',
    iv: value.iv as string,
    ciphertext: value.ciphertext as string,
  };
}
