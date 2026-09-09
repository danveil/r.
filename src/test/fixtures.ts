import { emptyData, type AppData, type PeriodRecord, type Profile } from '../types';
import { shift, todayKey } from '../lib/dates';
export const fixtureProfile: Profile = {
  id: 'profile',
  onboardingComplete: true,
  initialTypicalCycleLength: 28,
  initialTypicalPeriodLength: 5,
  weekStartsOn: 1,
};
export const fixturePeriod = (startDate: string, duration = 5, id = startDate): PeriodRecord => ({
  id,
  startDate,
  endDate: shift(startDate, duration - 1),
  status: 'ended',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
});
export function fixtureData(startDate = '2025-01-01'): AppData {
  return { ...emptyData(), profile: { ...fixtureProfile }, periods: [fixturePeriod(startDate)] };
}
export function demoFixture(mode: string, today = todayKey()): AppData {
  if (mode === 'new') return emptyData();
  const offset =
    (
      { period: 1, follicular: 6, fertile: 12, ovulation: 14, luteal: 21, irregular: 14 } as Record<
        string,
        number
      >
    )[mode] ?? 12;
  const start = shift(today, -offset);
  const periods =
    mode === 'irregular'
      ? [
          fixturePeriod(shift(start, -110)),
          fixturePeriod(shift(start, -83)),
          fixturePeriod(shift(start, -47)),
          fixturePeriod(start),
        ]
      : [-84, -56, -28, 0].map((n) => fixturePeriod(shift(start, n)));
  if (mode === 'period')
    periods[periods.length - 1] = { ...fixturePeriod(start), endDate: undefined, status: 'active' };
  return { ...emptyData(), profile: { ...fixtureProfile }, periods };
}
