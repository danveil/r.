import { describe, expect, it } from 'vitest';
import { calculateCycleStatistics, getCycleState, median, predictNextPeriod } from './prediction';
import { fixtureData, fixturePeriod, fixtureProfile } from '../test/fixtures';
import { shift } from './dates';

const historyFromLengths = (lengths: number[]) => {
  let start = '2024-01-01';
  return [
    fixturePeriod(start),
    ...lengths.map((length) => {
      start = shift(start, length);
      return fixturePeriod(start);
    }),
  ];
};
describe('adaptive statistics', () => {
  it('uses onboarding for the first period and the neutral prior when unknown', () => {
    expect(
      calculateCycleStatistics([fixturePeriod('2025-01-01')], {
        ...fixtureProfile,
        initialTypicalCycleLength: 32,
      }),
    ).toMatchObject({ cycleLength: 32, maturity: 'NEW', completedCycles: 0 });
    expect(
      calculateCycleStatistics([], { ...fixtureProfile, initialTypicalCycleLength: null }).cycleLength,
    ).toBe(28);
    expect(predictNextPeriod([], fixtureProfile)).toBeNull();
  });
  it('blends the second period’s completed length with one prior observation', () => {
    expect(calculateCycleStatistics(historyFromLengths([32]), fixtureProfile)).toMatchObject({
      cycleLength: 30,
      maturity: 'LIMITED',
      completedCycles: 1,
    });
    expect(calculateCycleStatistics(historyFromLengths([32, 30]), fixtureProfile).cycleLength).toBe(30);
  });
  it('learns multiple cycles and preserves original lengths', () => {
    const stats = calculateCycleStatistics(historyFromLengths([30, 30, 30, 30]), fixtureProfile);
    expect(stats).toMatchObject({ cycleLength: 30, maturity: 'ESTABLISHED', completedCycles: 4 });
    expect(stats.allLengths).toEqual([30, 30, 30, 30]);
  });
  it('resists one unusual month without removing it', () => {
    const stats = calculateCycleStatistics(historyFromLengths([28, 29, 28, 27, 28, 80]), fixtureProfile);
    expect(stats.cycleLength).toBeLessThanOrEqual(29);
    expect(stats.allLengths).toContain(80);
    expect(stats.range).toBe(53);
  });
  it('lets recent stable changes influence the model', () => {
    expect(
      calculateCycleStatistics(historyFromLengths([28, 28, 28, 32, 32, 32]), fixtureProfile).cycleLength,
    ).toBeGreaterThan(28);
    expect(
      calculateCycleStatistics(historyFromLengths([90, 28, 28, 28, 28, 28, 28]), fixtureProfile).cycleLength,
    ).toBe(28);
  });
  it('uses median duration and excludes ongoing or unknown ends', () => {
    const history = [
      fixturePeriod('2025-01-01', 4),
      fixturePeriod('2025-02-01', 6),
      { ...fixturePeriod('2025-03-01'), status: 'end-unknown' as const, endDate: undefined },
    ];
    expect(calculateCycleStatistics(history, fixtureProfile)).toMatchObject({
      periodLength: 5,
      knownDurations: 2,
    });
  });
  it('reports sensible robust variation for irregular history', () => {
    const stats = calculateCycleStatistics(historyFromLengths([25, 33, 42, 28, 38, 31]), fixtureProfile);
    expect(stats.irregular).toBe(true);
    expect(stats.spread).toBeGreaterThanOrEqual(3);
    expect(stats.range).toBe(17);
  });
  it('recalculates after a historical edit or deletion', () => {
    const history = historyFromLengths([28, 28]);
    const before = predictNextPeriod(history, fixtureProfile)!;
    const edited = history.map((p, i) => (i === 2 ? fixturePeriod(shift(p.startDate, 4)) : p));
    expect(predictNextPeriod(edited, fixtureProfile)!.nextStart).not.toBe(before.nextStart);
    expect(calculateCycleStatistics(history.slice(0, -1), fixtureProfile).completedCycles).toBe(1);
    expect(predictNextPeriod(history.slice(0, -1), fixtureProfile)!.nextStart).not.toBe(before.nextStart);
  });
  it('calculates even and odd medians', () => {
    expect(median([1, 9, 3])).toBe(3);
    expect(median([8, 2, 4, 6])).toBe(5);
  });
});
describe('phase and prediction correctness', () => {
  const data = fixtureData();
  const today = '2025-04-01';
  it('estimates next period and inclusive duration', () => {
    expect(predictNextPeriod(data.periods, data.profile)).toMatchObject({
      nextStart: '2025-01-29',
      nextEnd: '2025-02-02',
    });
  });
  it('estimates ovulation relative to the next period, not fixed day 14', () => {
    const p = predictNextPeriod(data.periods, { ...fixtureProfile, initialTypicalCycleLength: 35 });
    expect(p).toMatchObject({
      nextStart: '2025-02-05',
      ovulation: '2025-01-22',
      fertileStart: '2025-01-17',
      fertileEnd: '2025-01-23',
    });
  });
  it('supports configurable luteal and fertile windows', () => {
    expect(
      predictNextPeriod(data.periods, data.profile, {
        lutealLength: 12,
        fertileDaysBefore: 4,
        fertileDaysAfter: 0,
      }),
    ).toMatchObject({ ovulation: '2025-01-17', fertileStart: '2025-01-13', fertileEnd: '2025-01-17' });
  });
  it.each([
    ['2025-01-02', 'menstrual', true],
    ['2025-01-07', 'follicular', false],
    ['2025-01-12', 'fertile', false],
    ['2025-01-15', 'ovulation', false],
    ['2025-01-20', 'luteal', false],
    ['2025-01-29', 'menstrual', false],
  ])('labels %s as %s with correct actual status', (day, phase, actual) => {
    expect(getCycleState(day, data, today)).toMatchObject({ phase, actual });
  });
  it('retains overlap while actual bleeding wins display priority', () => {
    const overlapping = {
      ...data,
      bleeding: [{ date: '2025-01-15', updatedAt: '2025-01-15T12:00:00.000Z' }],
    };
    expect(getCycleState('2025-01-15', overlapping, today)).toMatchObject({
      phase: 'menstrual',
      actual: true,
      fertile: true,
      ovulation: true,
    });
  });
  it('an actual early period resets cycle day and replaces the forecast', () => {
    const early = { ...data, periods: [...data.periods, fixturePeriod('2025-01-25')] };
    expect(getCycleState('2025-01-25', early, today)).toMatchObject({ cycleDay: 1, actual: true });
    expect(predictNextPeriod(early.periods, early.profile)!.nextStart).toBe('2025-02-20');
  });
  it('never resets the actual cycle on an unlogged predicted start', () => {
    expect(getCycleState('2025-01-29', data, today).cycleDay).toBe(29);
    expect(getCycleState('2025-03-01', data, today)).toMatchObject({
      phase: 'unknown',
      overdue: true,
      actual: false,
    });
  });
  it('does not invent actual days for unknown ends or future active periods', () => {
    const unknown = {
      ...data,
      periods: [{ ...data.periods[0], status: 'end-unknown' as const, endDate: undefined }],
    };
    expect(getCycleState('2025-01-03', unknown, today)).toMatchObject({
      predictedPeriod: true,
      actual: false,
    });
    const active = {
      ...data,
      periods: [{ ...data.periods[0], status: 'active' as const, endDate: undefined }],
    };
    expect(getCycleState('2025-01-03', active, '2025-01-02').actual).toBe(false);
  });
  it('does not derive ovulation from subjective indicators', () => {
    const signs = {
      ...data,
      observations: [
        {
          id: 'sign',
          date: '2025-01-10',
          indicators: ['Ovulation pain'],
          note: '',
          createdAt: '',
          updatedAt: '',
        },
      ],
    };
    expect(getCycleState('2025-01-10', signs, today)).toEqual(getCycleState('2025-01-10', data, today));
  });
  it('handles a date before the first record', () => {
    expect(getCycleState('2024-12-01', data, today)).toMatchObject({ phase: 'unknown', cycleDay: null });
  });
});
