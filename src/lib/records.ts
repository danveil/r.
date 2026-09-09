import type { AppData, PeriodRecord } from '../types';

export const stamp = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();
export function savePeriod(data: AppData, record: PeriodRecord): AppData {
  return { ...data, periods: [...data.periods.filter((p) => p.id !== record.id), record] };
}
