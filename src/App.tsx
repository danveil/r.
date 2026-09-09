import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import type { AppData, PeriodRecord } from './types';
import { emptyData } from './types';
import { changeData, db, deleteAllData, downloadBackup, importData, readData } from './db/database';
import { makeBackup, validateData, validateNewDates } from './lib/validation';
import { saveError } from './lib/errors';
import { useToday } from './hooks/useToday';
import { Icon, type IconName } from './components/Icon';
import { Onboarding } from './features/Onboarding';
import { Home } from './features/Home';
import { Calendar } from './features/Calendar';
import { Insights } from './features/Insights';
import { DeleteSheet, ImportSheet, Settings } from './features/Settings';
import { DateDetailSheet, DiarySheet, OvulationSheet, PeriodSheet } from './features/LogSheets';
import { UpdateNotice } from './components/UpdateNotice';
import { PrimarySync } from './partner/PrimarySync';
type Tab = 'home' | 'calendar' | 'insights' | 'settings';
type OpenSheet =
  | {
      type: 'date' | 'diary' | 'ovulation' | 'period';
      value: string;
      record?: PeriodRecord;
      ending?: boolean;
    }
  | { type: 'import' | 'delete' }
  | null;
const tabs: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'insights', label: 'Insights', icon: 'insights' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];
const currentTab = (): Tab => tabs.find((t) => `#${t.id}` === window.location.hash)?.id ?? 'home';
export default function App({ demoData }: { demoData?: AppData }) {
  const today = useToday();
  const [data, setData] = useState<AppData | null>(demoData ?? null);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState<Tab>(currentTab);
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const [toast, setToast] = useState('');
  const demo = demoData !== undefined;
  useEffect(() => {
    if (demo) return;
    const subscription = liveQuery(() => readData()).subscribe({
      next: (next) => {
        try {
          setData(validateData(next));
          setLoadError(false);
        } catch {
          setLoadError(true);
        }
      },
      error: () => setLoadError(true),
    });
    return () => subscription.unsubscribe();
  }, [demo]);
  useEffect(() => {
    const sync = () => {
      setTab(currentTab());
    };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);
  async function change(fn: (current: AppData) => AppData) {
    try {
      if (demo) {
        const previous = data ?? emptyData();
        const next = validateData(fn(previous));
        validateNewDates(previous, next);
        setData(next);
      } else setData(await changeData(fn));
      setToast(demo ? 'Saved for this demo session' : 'Saved on this device');
    } catch (error) {
      throw saveError(error);
    }
  }
  async function restore(next: AppData) {
    if (demo) setData(validateData(next));
    else setData(await importData(next));
    setToast('Your history is restored');
  }
  async function removeAll() {
    if (!demo) await deleteAllData();
    setData(emptyData());
    setTab('home');
    window.location.hash = 'home';
  }
  function navigate(next: Tab) {
    setTab(next);
    window.location.hash = next;
  }
  const close = () => setSheet(null);
  if (loadError)
    return (
      <main className="recovery-page stack">
        <h1>Your history needs a little care.</h1>
        <p>
          We couldn’t open the local data. Nothing has been deleted. Try reopening Rayang, or export a
          recovery file before restoring a backup.
        </p>
        <button className="primary" onClick={() => window.location.reload()}>
          Try again
        </button>
        <button
          className="secondary"
          onClick={async () => {
            try {
              downloadBackup(makeBackup(await readData(db)), 'rayang-recovery');
              setToast('Recovery download requested');
            } catch {
              setToast('Storage is unavailable. Try opening your normal browser outside private browsing.');
            }
          }}
        >
          Export readable recovery data
        </button>
        <button className="text-button" onClick={() => setSheet({ type: 'import' })}>
          Restore a backup
        </button>
        <p role="status">{toast}</p>
        {sheet?.type === 'import' && <ImportSheet onClose={close} onImport={restore} />}
      </main>
    );
  if (!data)
    return (
      <main className="loading-page" aria-busy="true">
        <span className="brand-mark">r.</span>
        <p>Opening your space…</p>
      </main>
    );
  const shared = { data, today, change, onClose: close };
  return (
    <div
      className="app-shell"
      onClickCapture={(event) => {
        (event.target as Element).closest<HTMLButtonElement>('button')?.focus({ preventScroll: true });
      }}
    >
      {demo && <div className="demo-banner">Demo · temporary sample data, never saved to your database</div>}
      {!demo && data.profile && <PrimarySync data={data} today={today} />}
      {!data.profile?.onboardingComplete ? (
        <Onboarding onFinish={(next) => change(() => next)} onRestore={() => setSheet({ type: 'import' })} />
      ) : (
        <>
          <main id="main-content">
            {tab === 'home' && (
              <Home
                data={data}
                today={today}
                onDate={(value) => setSheet({ type: 'date', value })}
                onCalendar={() => navigate('calendar')}
                onDiary={() => setSheet({ type: 'diary', value: today })}
                onPeriod={(ending) =>
                  setSheet({
                    type: 'period',
                    value: today,
                    ending,
                    record: ending ? data.periods.find((p) => p.status === 'active') : undefined,
                  })
                }
                onOvulation={() => setSheet({ type: 'ovulation', value: today })}
              />
            )}
            {tab === 'calendar' && (
              <Calendar data={data} today={today} onSelect={(value) => setSheet({ type: 'date', value })} />
            )}
            {tab === 'insights' && <Insights data={data} />}
            {tab === 'settings' && (
              <Settings
                data={data}
                change={change}
                onImport={() => setSheet({ type: 'import' })}
                onDelete={() => setSheet({ type: 'delete' })}
                demo={demo}
              />
            )}
          </main>
          <nav className="bottom-nav" aria-label="Main navigation">
            {tabs.map((t) => (
              <button
                key={t.id}
                aria-current={tab === t.id ? 'page' : undefined}
                onClick={() => navigate(t.id)}
              >
                <Icon name={t.icon} />
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
        </>
      )}
      {sheet && 'value' in sheet && (
        <div key={`${sheet.type}-${sheet.value}`}>
          {sheet.type === 'date' && (
            <DateDetailSheet
              {...shared}
              value={sheet.value}
              onDiary={() => setSheet({ type: 'diary', value: sheet.value })}
              onPeriod={(record) => setSheet({ type: 'period', value: sheet.value, record })}
              onOvulation={() => setSheet({ type: 'ovulation', value: sheet.value })}
            />
          )}
          {sheet.type === 'diary' && <DiarySheet {...shared} value={sheet.value} />}
          {sheet.type === 'period' && (
            <PeriodSheet {...shared} value={sheet.value} record={sheet.record} ending={sheet.ending} />
          )}
          {sheet.type === 'ovulation' && <OvulationSheet {...shared} value={sheet.value} />}
        </div>
      )}
      {sheet?.type === 'import' && <ImportSheet onClose={close} onImport={restore} />}
      {sheet?.type === 'delete' && <DeleteSheet onClose={close} onDelete={removeAll} />}
      <div className={`toast ${toast ? 'visible' : ''}`} role="status">
        {toast && (
          <>
            <Icon name="check" />
            {toast}
          </>
        )}
      </div>
      <UpdateNotice formOpen={sheet !== null || !data.profile?.onboardingComplete} />
    </div>
  );
}
