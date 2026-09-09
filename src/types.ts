export type DateKey = string;
export interface Profile {
  id: 'profile';
  onboardingComplete: boolean;
  initialTypicalCycleLength: number | null;
  initialTypicalPeriodLength: number;
  weekStartsOn: 0 | 1;
}
export interface PeriodRecord {
  id: string;
  startDate: DateKey;
  endDate?: DateKey;
  status: 'active' | 'ended' | 'end-unknown';
  createdAt: string;
  updatedAt: string;
}
export const MOODS = [
  'Happy',
  'Calm',
  'Sensitive',
  'Sad',
  'Irritated',
  'Anxious',
  'Energetic',
  'Tired',
] as const;
export const SYMPTOMS = [
  'Cramps',
  'Headache',
  'Bloating',
  'Breast tenderness',
  'Back pain',
  'Acne',
  'Cravings',
  'Nausea',
  'Discharge changes',
  'Poor sleep',
  'Good sleep',
  'Low energy',
  'High energy',
  'Low libido',
  'High libido',
] as const;
export const FLOWS = ['Spotting', 'Light', 'Medium', 'Heavy'] as const;
export const INDICATORS = [
  'Cervical mucus change',
  'Ovulation test',
  'Temperature change',
  'Ovulation pain',
  'Other',
  'Just a feeling / unsure',
] as const;
export interface DiaryEntry {
  date: DateKey;
  note: string;
  symptoms: string[];
  mood: string[];
  flow?: string;
  updatedAt: string;
}
export interface OvulationObservation {
  id: string;
  date: DateKey;
  indicators: string[];
  note: string;
  createdAt: string;
  updatedAt: string;
}
export interface BleedingDay {
  date: DateKey;
  updatedAt: string;
}
export interface AppData {
  profile: Profile | null;
  periods: PeriodRecord[];
  diary: DiaryEntry[];
  observations: OvulationObservation[];
  bleeding: BleedingDay[];
}
export interface Backup {
  app: 'rayang';
  version: 1;
  exportedAt: string;
  data: AppData;
}
export const emptyData = (): AppData => ({
  profile: null,
  periods: [],
  diary: [],
  observations: [],
  bleeding: [],
});
