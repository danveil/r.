import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { DateKey } from '../types';

// Calendar dates are parsed in LOCAL time; never use new Date('YYYY-MM-DD') or UTC serialization.
export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = parseISO(value);
  return (
    isValid(parsed) &&
    format(parsed, 'yyyy-MM-dd') === value &&
    value >= '1900-01-01' &&
    value <= '2200-12-31'
  );
}
export function date(value: DateKey): Date {
  if (!isDateKey(value)) throw new Error('Please choose a valid calendar date.');
  return parseISO(value);
}
export const key = (value: Date): DateKey => format(value, 'yyyy-MM-dd');
export const todayKey = (): DateKey => key(new Date());
export const shift = (value: DateKey, days: number): DateKey => key(addDays(date(value), days));
export const daysBetween = (from: DateKey, to: DateKey): number =>
  differenceInCalendarDays(date(to), date(from));
export const prettyDate = (value: DateKey, pattern = 'd MMM'): string => format(date(value), pattern);
export const monthShift = (value: DateKey, amount: number): DateKey =>
  key(startOfMonth(addMonths(date(value), amount)));
export const weekDates = (value: DateKey, weekStartsOn: 0 | 1): DateKey[] => {
  const start = key(startOfWeek(date(value), { weekStartsOn }));
  return Array.from({ length: 7 }, (_, i) => shift(start, i));
};
export const monthDates = (value: DateKey, weekStartsOn: 0 | 1): DateKey[] => {
  const start = key(startOfWeek(startOfMonth(date(value)), { weekStartsOn }));
  return Array.from({ length: 42 }, (_, i) => shift(start, i));
};
export const within = (value: DateKey, start: DateKey, end: DateKey): boolean =>
  value >= start && value <= end;
