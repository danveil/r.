import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RayangDB, changeData, deleteAllData, importData, readData } from './database';
import { makeBackup, parseBackup, validateData, validateNewDates } from '../lib/validation';
import { fixtureData, fixturePeriod } from '../test/fixtures';
describe('validated local storage and backups', () => {
  let database: RayangDB;
  beforeEach(async () => {
    database = new RayangDB(`test-${crypto.randomUUID()}`);
    await importData(fixtureData(), database);
  });
  afterEach(async () => {
    await database.delete();
  });
  it('round-trips all record types through a JSON backup', () => {
    const data = fixtureData();
    const time = '2025-01-01T00:00:00.000Z';
    data.diary = [
      {
        date: '2025-01-01',
        note: 'Private note 💛',
        mood: ['Calm'],
        symptoms: ['Cramps'],
        flow: 'Light',
        updatedAt: time,
      },
    ];
    data.observations = [
      {
        id: 'sign',
        date: '2025-01-02',
        note: 'Unsure',
        indicators: ['Just a feeling / unsure'],
        createdAt: time,
        updatedAt: time,
      },
    ];
    data.bleeding = [{ date: '2025-01-06', updatedAt: time }];
    expect(parseBackup(JSON.stringify(makeBackup(data))).data).toEqual(data);
  });
  it('backs up the previous data atomically before a valid import', async () => {
    const next = fixtureData('2025-02-01');
    await importData(next, database);
    expect(await readData(database)).toEqual(next);
    expect((await database.recovery.get('before-import'))?.backup.data).toEqual(fixtureData());
  });
  it('rejects failed imports without replacing any records or recovery copy', async () => {
    const before = await readData(database);
    const recovery = await database.recovery.toArray();
    const bad = fixtureData();
    bad.periods[0].endDate = '2024-12-01';
    await expect(importData(bad, database)).rejects.toThrow();
    expect(await readData(database)).toEqual(before);
    expect(await database.recovery.toArray()).toEqual(recovery);
  });
  it('rolls back storage failures during restore, including recovery', async () => {
    const before = await readData(database);
    const recovery = await database.recovery.toArray();
    const fail = () => {
      throw new Error('Quota exceeded');
    };
    database.periods.hook('creating', fail);
    await expect(importData(fixtureData('2025-02-01'), database)).rejects.toThrow();
    database.periods.hook('creating').unsubscribe(fail);
    expect(await readData(database)).toEqual(before);
    expect(await database.recovery.toArray()).toEqual(recovery);
  });
  it('rejects overlaps, duplicate starts, malformed dates and unknown tags', () => {
    const data = fixtureData();
    expect(() => validateData({ ...data, periods: [...data.periods, fixturePeriod('2025-01-03')] })).toThrow(
      /overlap/,
    );
    expect(() =>
      validateData({
        ...data,
        diary: [{ date: '2025-02-30', note: '', symptoms: ['X'], mood: [], updatedAt: '' }],
      }),
    ).toThrow();
  });
  it('rejects future observations and contradictory period status', () => {
    const data = fixtureData();
    expect(() => validateData(data, '2024-12-31')).toThrow();
    expect(() => validateData({ ...data, periods: [{ ...data.periods[0], status: 'active' }] })).toThrow();
  });
  it('rejects invalid backup timestamps before the import summary renders', () => {
    expect(() =>
      parseBackup(JSON.stringify({ ...makeBackup(fixtureData()), exportedAt: '2025-02-30T00:00:00.000Z' })),
    ).toThrow();
    expect(() =>
      parseBackup(JSON.stringify({ ...makeBackup(fixtureData()), exportedAt: '2025-01-01T99:00:00.000Z' })),
    ).toThrow();
  });
  it('preserves already recorded dates when travel moves the local calendar back one day', () => {
    const before = fixtureData('2025-01-01');
    before.periods[0] = fixturePeriod('2025-01-01', 1);
    const after = { ...before, profile: { ...before.profile!, weekStartsOn: 0 as const } };
    expect(() => validateData(after)).not.toThrow();
    expect(() => validateNewDates(before, after, '2024-12-31')).not.toThrow();
    expect(parseBackup(JSON.stringify(makeBackup(after))).data.periods[0].startDate).toBe('2025-01-01');
  });
  it('still rejects newly entered future dates while retaining older records', () => {
    const before = fixtureData('2025-01-01');
    const after = { ...before, periods: [...before.periods, fixturePeriod('2025-02-01')] };
    expect(() => validateNewDates(before, after, '2025-01-31')).toThrow(/no later than today/);
  });
  it('allows long irregular observed cycles and deletion of the final record', async () => {
    await changeData((d) => ({ ...d, periods: [...d.periods, fixturePeriod('2025-08-01')] }), database);
    await changeData((d) => ({ ...d, periods: [] }), database);
    expect((await readData(database)).periods).toEqual([]);
  });
  it('preserves concurrent independent edits by rereading in a transaction', async () => {
    await Promise.all([
      changeData(
        (d) => ({
          ...d,
          bleeding: [...d.bleeding, { date: '2025-01-08', updatedAt: '2025-01-08T00:00:00.000Z' }],
        }),
        database,
      ),
      changeData(
        (d) => ({
          ...d,
          bleeding: [...d.bleeding, { date: '2025-01-09', updatedAt: '2025-01-09T00:00:00.000Z' }],
        }),
        database,
      ),
    ]);
    expect((await readData(database)).bleeding).toHaveLength(2);
  });
  it.each(['{', '{}', '{"app":"another-app","version":1}', '{"app":"rayang","version":2}'])(
    'rejects malformed or unsupported backups',
    (raw) => expect(() => parseBackup(raw)).toThrow(),
  );
  it('deletes active data and recovery together', async () => {
    await deleteAllData(database);
    expect((await readData(database)).profile).toBeNull();
    expect(await database.recovery.count()).toBe(0);
  });
});
