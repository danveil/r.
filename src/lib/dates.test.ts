import { describe, expect, it, vi } from 'vitest';
import { date, daysBetween, isDateKey, key, monthDates, shift, todayKey, weekDates } from './dates';
describe('local calendar dates', () => {
  it.each([
    ['2024-02-28', 1, '2024-02-29'],
    ['2024-02-28', 2, '2024-03-01'],
    ['2025-02-28', 1, '2025-03-01'],
    ['2025-12-31', 1, '2026-01-01'],
    ['2025-01-01', -1, '2024-12-31'],
  ])('shifts %s by %s days', (from, amount, expected) => expect(shift(from, amount)).toBe(expected));
  it.each(['2025-02-29', '2025-13-01', '2025-2-1', '2025-01-01T00:00:00Z', '', 'nonsense'])(
    'rejects non-date-only input %s',
    (value) => expect(isDateKey(value)).toBe(false),
  );
  it('serializes the same calendar day locally', () => {
    expect(key(date('2025-09-10'))).toBe('2025-09-10');
    expect(JSON.parse(JSON.stringify({ day: '2025-09-10' })).day).toBe('2025-09-10');
  });
  it('counts days spanning months and New Year', () => {
    expect(daysBetween('2025-12-20', '2026-01-17')).toBe(28);
    expect(daysBetween('2024-02-20', '2024-03-19')).toBe(28);
  });
  it('counts calendar days across spring and autumn DST', () => {
    expect(daysBetween('2025-03-08', '2025-03-10')).toBe(2);
    expect(daysBetween('2025-11-01', '2025-11-03')).toBe(2);
    expect(shift('2025-03-09', 1)).toBe('2025-03-10');
  });
  it('reads the local current day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 8, 10, 0, 5));
    expect(todayKey()).toBe('2025-09-10');
    vi.useRealTimers();
  });
  it('creates aligned Monday or Sunday weeks and months', () => {
    expect(weekDates('2025-01-01', 1)[0]).toBe('2024-12-30');
    expect(weekDates('2025-01-01', 0)[0]).toBe('2024-12-29');
    expect(monthDates('2025-01-01', 1)).toHaveLength(42);
  });
});
