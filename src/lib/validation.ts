import type { AppData, Backup } from '../types';
import { FLOWS, INDICATORS, MOODS, SYMPTOMS } from '../types';
import { isDateKey, todayKey } from './dates';

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const timestamp = (value: unknown): boolean =>
  typeof value === 'string' &&
  isDateKey(value.slice(0, 10)) &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
const text = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length <= max;
const integer = (value: unknown, min: number, max: number): boolean =>
  Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
const tags = (value: unknown, allowed: readonly string[]): boolean =>
  Array.isArray(value) &&
  value.length <= allowed.length &&
  new Set(value).size === value.length &&
  value.every((v) => typeof v === 'string' && allowed.includes(v));
function unique(rows: Record<string, unknown>[], field: string) {
  requireValue(
    new Set(rows.map((r) => r[field])).size === rows.length,
    'This file contains duplicate records.',
  );
}
// Existing date-only history must survive a clock/timezone change, including travel west across midnight.
// Entry-time bounds are enforced separately on newly added or changed observation dates.
export function validateData(value: unknown, today = '2200-12-31'): AppData {
  requireValue(object(value), 'The data is not a valid Rayang backup.');
  for (const table of ['periods', 'diary', 'observations', 'bleeding']) {
    requireValue(
      Array.isArray(value[table]) && value[table].length <= 100000 && value[table].every(object),
      'Some records are missing or invalid.',
    );
  }
  const profile = value.profile;
  requireValue(profile === null || object(profile), 'The profile is invalid.');
  if (profile) {
    requireValue(
      profile.id === 'profile' &&
        profile.onboardingComplete === true &&
        (profile.weekStartsOn === 0 || profile.weekStartsOn === 1),
      'The profile is incomplete.',
    );
    requireValue(
      profile.initialTypicalCycleLength === null || integer(profile.initialTypicalCycleLength, 10, 180),
      'Choose a usual cycle length between 10 and 180 days, or choose unknown.',
    );
    requireValue(
      integer(profile.initialTypicalPeriodLength, 1, 30),
      'Choose a typical period length between 1 and 30 days.',
    );
  }
  const actualDate = (d: unknown) => isDateKey(d) && d <= today;
  const periods = value.periods as Record<string, unknown>[];
  for (const p of periods) {
    requireValue(
      text(p.id, 100) && p.id.length > 0 && timestamp(p.createdAt) && timestamp(p.updatedAt),
      'A period record is invalid.',
    );
    requireValue(actualDate(p.startDate), 'Period starts must be valid dates no later than today.');
    requireValue(
      ['active', 'ended', 'end-unknown'].includes(String(p.status)),
      'A period status is invalid.',
    );
    requireValue(
      p.status === 'ended'
        ? actualDate(p.endDate) && String(p.endDate) >= String(p.startDate)
        : p.endDate === undefined,
      'The final bleeding day must be on or after the start, and no later than today.',
    );
  }
  unique(periods, 'id');
  const sorted = [...periods].sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
  sorted.forEach((p, i) => {
    const next = sorted[i + 1];
    requireValue(
      !next || (p.status !== 'active' && String(p.endDate ?? p.startDate) < String(next.startDate)),
      'Period ranges cannot overlap. End or correct the existing period first.',
    );
  });
  requireValue(
    profile ||
      [value.periods, value.diary, value.observations, value.bleeding].every(
        (rows) => (rows as unknown[]).length === 0,
      ),
    'Records require an onboarding profile.',
  );
  const diary = value.diary as Record<string, unknown>[];
  for (const d of diary) {
    requireValue(
      actualDate(d.date) &&
        text(d.note, 10000) &&
        tags(d.mood, MOODS) &&
        tags(d.symptoms, SYMPTOMS) &&
        (d.flow === undefined || FLOWS.includes(d.flow as (typeof FLOWS)[number])) &&
        timestamp(d.updatedAt),
      'A diary entry has invalid dates, text, or tags.',
    );
  }
  unique(diary, 'date');
  const observations = value.observations as Record<string, unknown>[];
  for (const o of observations)
    requireValue(
      text(o.id, 100) &&
        o.id.length > 0 &&
        actualDate(o.date) &&
        tags(o.indicators, INDICATORS) &&
        (o.indicators as string[]).length > 0 &&
        text(o.note, 10000) &&
        timestamp(o.createdAt) &&
        timestamp(o.updatedAt),
      'An ovulation sign has invalid dates or indicators.',
    );
  unique(observations, 'id');
  unique(observations, 'date');
  const bleeding = value.bleeding as Record<string, unknown>[];
  for (const b of bleeding)
    requireValue(actualDate(b.date) && timestamp(b.updatedAt), 'A bleeding day is invalid.');
  unique(bleeding, 'date');
  // Rebuild an allowlisted object. Unknown fields cannot introduce executable or hidden data.
  return {
    profile: profile
      ? {
          id: 'profile',
          onboardingComplete: true,
          initialTypicalCycleLength: profile.initialTypicalCycleLength as number | null,
          initialTypicalPeriodLength: Number(profile.initialTypicalPeriodLength),
          weekStartsOn: profile.weekStartsOn as 0 | 1,
        }
      : null,
    periods: periods.map((p) => ({
      id: String(p.id),
      startDate: String(p.startDate),
      ...(p.endDate ? { endDate: String(p.endDate) } : {}),
      status: p.status as AppData['periods'][number]['status'],
      createdAt: String(p.createdAt),
      updatedAt: String(p.updatedAt),
    })),
    diary: diary.map((d) => ({
      date: String(d.date),
      note: String(d.note),
      mood: [...(d.mood as string[])],
      symptoms: [...(d.symptoms as string[])],
      ...(d.flow ? { flow: String(d.flow) } : {}),
      updatedAt: String(d.updatedAt),
    })),
    observations: observations.map((o) => ({
      id: String(o.id),
      date: String(o.date),
      indicators: [...(o.indicators as string[])],
      note: String(o.note),
      createdAt: String(o.createdAt),
      updatedAt: String(o.updatedAt),
    })),
    bleeding: bleeding.map((b) => ({ date: String(b.date), updatedAt: String(b.updatedAt) })),
  };
}
export function validateNewDates(before: AppData, after: AppData, today = todayKey()) {
  const check = (value: string | undefined, previous: string | undefined) => {
    requireValue(
      !value || value <= today || value === previous,
      'New observations must be no later than today.',
    );
  };
  for (const period of after.periods) {
    const previous = before.periods.find((p) => p.id === period.id);
    check(period.startDate, previous?.startDate);
    check(period.endDate, previous?.endDate);
  }
  for (const entry of after.diary) check(entry.date, before.diary.find((d) => d.date === entry.date)?.date);
  for (const sign of after.observations)
    check(sign.date, before.observations.find((o) => o.id === sign.id)?.date);
  for (const day of after.bleeding) check(day.date, before.bleeding.find((b) => b.date === day.date)?.date);
}
export const makeBackup = (data: AppData): Backup => ({
  app: 'rayang',
  version: 1,
  exportedAt: new Date().toISOString(),
  data,
});
export function parseBackup(raw: string): Backup {
  requireValue(raw.length <= 10 * 1024 * 1024, 'This backup is too large. The limit is 10 MB.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('This file is not valid JSON. Choose a Rayang backup.');
  }
  requireValue(
    object(parsed) && parsed.app === 'rayang' && parsed.version === 1 && timestamp(parsed.exportedAt),
    'This is not a supported Rayang backup (version 1).',
  );
  return {
    app: 'rayang',
    version: 1,
    exportedAt: String(parsed.exportedAt),
    data: validateData(parsed.data),
  };
}
