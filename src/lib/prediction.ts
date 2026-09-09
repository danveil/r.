import type { AppData, DateKey, PeriodRecord, Profile } from '../types';
import { daysBetween, shift, within } from './dates';

export const MODEL = {
  defaultCycleLength: 28,
  lutealLength: 14,
  fertileDaysBefore: 5,
  fertileDaysAfter: 1,
  recentCycles: 6,
} as const;
export type Phase = 'menstrual' | 'follicular' | 'fertile' | 'ovulation' | 'luteal' | 'unknown';
export const PHASE_LABELS: Record<Phase, string> = {
  menstrual: 'Period',
  follicular: 'Follicular phase',
  fertile: 'Fertile window',
  ovulation: 'Predicted ovulation',
  luteal: 'Luteal phase',
  unknown: 'Your cycle',
};
export const median = (values: number[]): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
export const sortedPeriods = (history: PeriodRecord[]): PeriodRecord[] =>
  [...history].sort((a, b) => a.startDate.localeCompare(b.startDate));
export function calculateCycleStatistics(history: PeriodRecord[], profile: Profile | null) {
  const sorted = sortedPeriods(history);
  const allLengths = sorted.slice(1).map((p, i) => daysBetween(sorted[i].startDate, p.startDate));
  const recent = allLengths.slice(-MODEL.recentCycles);
  const prior = profile?.initialTypicalCycleLength ?? MODEL.defaultCycleLength;
  const mid = median(recent);
  const mad = median(recent.map((value) => Math.abs(value - mid)));
  let estimate = prior;
  if (recent.length && recent.length < 3)
    estimate = (recent.reduce((a, b) => a + b, 0) + prior) / (recent.length + 1);
  if (recent.length >= 3) {
    const radius = Math.max(3, 3 * mad);
    const bounded = recent.map((value) => Math.max(mid - radius, Math.min(mid + radius, value)));
    const weighted =
      bounded.reduce((sum, value, i) => sum + value * (i + 1), 0) /
      ((recent.length * (recent.length + 1)) / 2);
    estimate = 0.6 * mid + 0.4 * weighted;
  }
  const durations = sorted
    .filter((p) => p.status === 'ended' && p.endDate)
    .map((p) => daysBetween(p.startDate, p.endDate!) + 1)
    .slice(-6);
  const range = recent.length ? Math.max(...recent) - Math.min(...recent) : 0;
  return {
    cycleLength: Math.max(1, Math.round(estimate)),
    periodLength: Math.round(
      durations.length ? median(durations) : (profile?.initialTypicalPeriodLength ?? 5),
    ),
    completedCycles: allLengths.length,
    allLengths,
    recentLengths: recent,
    mad,
    range,
    spread: recent.length >= 3 ? Math.ceil(1.4826 * mad) : 0,
    irregular: recent.length >= 3 && (range >= 8 || mad >= 3),
    maturity: allLengths.length === 0 ? 'NEW' : allLengths.length < 3 ? 'LIMITED' : 'ESTABLISHED',
    knownDurations: durations.length,
  };
}
export function predictNextPeriod(
  history: PeriodRecord[],
  profile: Profile | null,
  model: { lutealLength: number; fertileDaysBefore: number; fertileDaysAfter: number } = MODEL,
) {
  const latest = sortedPeriods(history).at(-1);
  const statistics = calculateCycleStatistics(history, profile);
  if (!latest) return null;
  const nextStart = shift(latest.startDate, statistics.cycleLength);
  const ovulation = shift(nextStart, -model.lutealLength);
  const fertileStart = shift(ovulation, -model.fertileDaysBefore);
  const fertileEnd = shift(ovulation, model.fertileDaysAfter);
  return {
    nextStart,
    nextEnd: shift(nextStart, statistics.periodLength - 1),
    ovulation,
    fertileStart,
    fertileEnd,
    rangeStart: shift(nextStart, -statistics.spread),
    rangeEnd: shift(nextStart, statistics.spread),
    ...statistics,
  };
}
export function getCycleDay(value: DateKey, period?: PeriodRecord): number | null {
  return period && value >= period.startDate ? daysBetween(period.startDate, value) + 1 : null;
}
export function getCycleState(value: DateKey, data: AppData, today: DateKey) {
  const sorted = sortedPeriods(data.periods);
  const anchor = sorted.filter((p) => p.startDate <= value).at(-1);
  const nextActual = sorted.find((p) => p.startDate > value);
  const stats = calculateCycleStatistics(data.periods, data.profile);
  const actualPeriod = sorted.find((p) =>
    within(value, p.startDate, p.endDate ?? (p.status === 'active' ? today : p.startDate)),
  );
  const actual = !!actualPeriod || data.bleeding.some((d) => d.date === value);
  const expectedNext = anchor ? (nextActual?.startDate ?? shift(anchor.startDate, stats.cycleLength)) : null;
  const ovulation = expectedNext ? shift(expectedNext, -MODEL.lutealLength) : null;
  const fertile =
    !!ovulation &&
    within(value, shift(ovulation, -MODEL.fertileDaysBefore), shift(ovulation, MODEL.fertileDaysAfter));
  // Only project the next period, never manufacture repeating cycles after an unlogged estimate.
  const predictedPeriod =
    !!anchor &&
    !nextActual &&
    !!expectedNext &&
    within(value, expectedNext, shift(expectedNext, stats.periodLength - 1));
  const unknownEndEstimate =
    anchor?.status === 'end-unknown' &&
    within(value, anchor.startDate, shift(anchor.startDate, stats.periodLength - 1));
  const overdue = !!expectedNext && !nextActual && value > shift(expectedNext, stats.periodLength - 1);
  let phase: Phase = 'unknown';
  if (anchor && !overdue) phase = ovulation && value < ovulation ? 'follicular' : 'luteal';
  if (fertile && anchor) phase = 'fertile';
  if (value === ovulation && anchor) phase = 'ovulation';
  if (predictedPeriod || unknownEndEstimate || actual) phase = 'menstrual';
  return {
    phase,
    actual,
    predictedPeriod: !!(predictedPeriod || unknownEndEstimate) && !actual,
    fertile,
    ovulation: value === ovulation,
    cycleDay: getCycleDay(value, anchor),
    period: actualPeriod,
    overdue,
    anchor,
  };
}
