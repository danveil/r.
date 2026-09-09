import type { AppData } from '../types';
import { emptyData } from '../types';
import { getCycleState, predictNextPeriod } from '../lib/prediction';
import { isDateKey, shift, weekDates } from '../lib/dates';
import { exact, object, requireProtocol, type Permissions, type Snapshot, type SharedDay } from './protocol';

export function createSnapshot(
  data: AppData,
  permissions: Permissions,
  date: string,
  generatedAt = new Date().toISOString(),
): Snapshot {
  // Explicit inputs: observations/diary never even enter the calculation surface.
  const cycleData: AppData = {
    ...emptyData(),
    profile: data.profile,
    periods: data.periods,
    bleeding: data.bleeding,
  };
  const state = getCycleState(date, cycleData, date);
  const prediction = predictNextPeriod(cycleData.periods, cycleData.profile);
  const first = shift(weekDates(date, 1)[0], -7);
  const snapshot: Snapshot = {
    schemaVersion: 1,
    generatedAt,
    date,
    permissions: {
      current: permissions.current,
      period: permissions.period,
      fertility: permissions.fertility,
    },
    calendar: [],
  };
  if (permissions.current)
    snapshot.current = {
      phase:
        !permissions.fertility && ['fertile', 'ovulation'].includes(state.phase) ? 'unknown' : state.phase,
      cycleDay: state.cycleDay,
      isActualPeriod: state.actual,
    };
  if (permissions.period && prediction)
    snapshot.period = {
      start: prediction.nextStart,
      end: prediction.nextEnd,
      rangeStart: prediction.rangeStart,
      rangeEnd: prediction.rangeEnd,
    };
  if (permissions.fertility && prediction)
    snapshot.fertility = {
      start: prediction.fertileStart,
      end: prediction.fertileEnd,
      ovulation: prediction.ovulation,
    };
  if (permissions.period || permissions.fertility)
    snapshot.calendar = Array.from({ length: 42 }, (_, i) => {
      const dateKey = shift(first, i);
      const day = getCycleState(dateKey, cycleData, date);
      return {
        date: dateKey,
        ...(permissions.period
          ? {
              period: day.actual
                ? ('actual' as const)
                : day.predictedPeriod
                  ? ('estimated' as const)
                  : ('none' as const),
            }
          : {}),
        ...(permissions.fertility ? { fertile: day.fertile, ovulation: day.ovulation } : {}),
      };
    });
  return parseSnapshot(snapshot);
}
export function parseSnapshot(value: unknown): Snapshot {
  requireProtocol(
    object(value) &&
      exact(value, [
        'schemaVersion',
        'generatedAt',
        'date',
        'permissions',
        'current',
        'period',
        'fertility',
        'calendar',
      ]) &&
      value.schemaVersion === 1 &&
      isDateKey(value.date),
  );
  requireProtocol(
    typeof value.generatedAt === 'string' &&
      /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.generatedAt) &&
      Number.isFinite(Date.parse(value.generatedAt)) &&
      new Date(value.generatedAt).toISOString() === value.generatedAt,
  );
  const p = value.permissions;
  requireProtocol(
    object(p) &&
      exact(p, ['current', 'period', 'fertility']) &&
      ['current', 'period', 'fertility'].every((k) => typeof p[k] === 'boolean') &&
      (p.current || p.period || p.fertility),
  );
  if (p.current) {
    const c = value.current;
    requireProtocol(
      object(c) &&
        exact(c, ['phase', 'cycleDay', 'isActualPeriod']) &&
        ['menstrual', 'follicular', 'fertile', 'ovulation', 'luteal', 'unknown'].includes(String(c.phase)) &&
        (c.cycleDay === null ||
          (Number.isInteger(c.cycleDay) && Number(c.cycleDay) > 0 && Number(c.cycleDay) < 120000)) &&
        typeof c.isActualPeriod === 'boolean',
    );
    requireProtocol(p.fertility || !['fertile', 'ovulation'].includes(String(c.phase)));
  } else requireProtocol(value.current === undefined);
  if (value.period !== undefined) {
    const r = value.period;
    requireProtocol(
      p.period &&
        object(r) &&
        exact(r, ['start', 'end', 'rangeStart', 'rangeEnd']) &&
        ['start', 'end', 'rangeStart', 'rangeEnd'].every((k) => isDateKey(r[k])) &&
        String(r.start) <= String(r.end) &&
        String(r.rangeStart) <= String(r.rangeEnd),
    );
  }
  if (value.fertility !== undefined) {
    const r = value.fertility;
    requireProtocol(
      p.fertility &&
        object(r) &&
        exact(r, ['start', 'end', 'ovulation']) &&
        ['start', 'end', 'ovulation'].every((k) => isDateKey(r[k])) &&
        String(r.start) <= String(r.ovulation) &&
        String(r.ovulation) <= String(r.end),
    );
  }
  requireProtocol(
    Array.isArray(value.calendar) &&
      value.calendar.length <= 42 &&
      (p.period || p.fertility || value.calendar.length === 0),
  );
  let previous = '';
  for (const day of value.calendar) {
    requireProtocol(
      object(day) &&
        exact(day, ['date', 'period', 'fertile', 'ovulation']) &&
        isDateKey(day.date) &&
        (!previous || shift(previous, 1) === day.date),
    );
    previous = day.date;
    requireProtocol(
      p.period ? ['actual', 'estimated', 'none'].includes(String(day.period)) : day.period === undefined,
    );
    requireProtocol(
      p.fertility
        ? typeof day.fertile === 'boolean' && typeof day.ovulation === 'boolean'
        : day.fertile === undefined && day.ovulation === undefined,
    );
  }
  return structuredClone(value) as unknown as Snapshot;
}
export function dayPhase(day: SharedDay): string {
  return day.period && day.period !== 'none'
    ? 'menstrual'
    : day.ovulation
      ? 'ovulation'
      : day.fertile
        ? 'fertile'
        : 'unknown';
}
export function dayLabel(day: SharedDay): string {
  return day.period === 'actual'
    ? 'Logged period'
    : day.period === 'estimated'
      ? 'Estimated period'
      : day.ovulation
        ? 'Predicted ovulation'
        : day.fertile
          ? 'Possible fertile window'
          : 'No shared event';
}
