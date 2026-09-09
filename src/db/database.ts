import Dexie, { type Table } from 'dexie';
import type {
  AppData,
  Backup,
  BleedingDay,
  DiaryEntry,
  OvulationObservation,
  PeriodRecord,
  Profile,
} from '../types';
import { makeBackup, validateData, validateNewDates } from '../lib/validation';
import { guardSharingStopped } from '../partner/storage';

export class RayangDB extends Dexie {
  profile!: Table<Profile, string>;
  periods!: Table<PeriodRecord, string>;
  diary!: Table<DiaryEntry, string>;
  observations!: Table<OvulationObservation, string>;
  bleeding!: Table<BleedingDay, string>;
  recovery!: Table<{ id: 'before-import'; backup: Backup }, string>;
  constructor(name = 'rayang-private') {
    super(name);
    this.version(1).stores({
      profile: 'id',
      periods: 'id,startDate',
      diary: 'date',
      observations: 'id,date',
      bleeding: 'date',
      recovery: 'id',
    });
  }
}
export const db = new RayangDB();
export async function readData(database = db): Promise<AppData> {
  return database.transaction(
    'r',
    [database.profile, database.periods, database.diary, database.observations, database.bleeding],
    async () => ({
      profile: (await database.profile.get('profile')) ?? null,
      periods: await database.periods.toArray(),
      diary: await database.diary.toArray(),
      observations: await database.observations.toArray(),
      bleeding: await database.bleeding.toArray(),
    }),
  );
}
async function writeData(data: AppData, database: RayangDB) {
  await Promise.all([
    database.profile.clear(),
    database.periods.clear(),
    database.diary.clear(),
    database.observations.clear(),
    database.bleeding.clear(),
  ]);
  if (data.profile) await database.profile.put(data.profile);
  await database.periods.bulkPut(data.periods);
  await database.diary.bulkPut(data.diary);
  await database.observations.bulkPut(data.observations);
  await database.bleeding.bulkPut(data.bleeding);
}
export async function changeData(change: (data: AppData) => AppData, database = db): Promise<AppData> {
  return database.transaction('rw', database.tables, async () => {
    const previous = await readData(database);
    const next = validateData(change(previous));
    validateNewDates(previous, next);
    await writeData(next, database);
    return next;
  });
}
export async function importData(data: AppData, database = db): Promise<AppData> {
  if (database === db) await guardSharingStopped();
  const valid = validateData(data); // Validate before opening the write transaction.
  return database.transaction('rw', database.tables, async () => {
    await database.recovery.put({ id: 'before-import', backup: makeBackup(await readData(database)) });
    await writeData(valid, database);
    return valid;
  });
}
export async function deleteAllData(database = db) {
  if (database === db) await guardSharingStopped();
  await database.transaction('rw', database.tables, async () => {
    for (const table of database.tables) await table.clear();
  });
}
export function downloadBackup(backup: Backup, prefix = 'rayang-backup') {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${prefix}-${backup.exportedAt.slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
