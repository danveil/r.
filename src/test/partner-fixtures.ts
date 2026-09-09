import { demoFixture } from './fixtures';
import { shift, todayKey } from '../lib/dates';
import { createSnapshot } from '../partner/snapshot';
export function partnerFixture(mode: string) {
  if (mode === 'revoked' || mode === 'none') return undefined;
  const date = mode === 'stale' ? shift(todayKey(), -3) : todayKey();
  return createSnapshot(
    demoFixture(mode, date),
    { current: true, period: true, fertility: mode !== 'limited' },
    date,
    mode === 'stale' ? `${date}T08:00:00.000Z` : new Date().toISOString(),
  );
}
