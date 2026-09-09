import { lazy, Suspense, useState } from 'react';
import type { AppData, Backup } from '../types';
import { db, downloadBackup } from '../db/database';
import { makeBackup, parseBackup } from '../lib/validation';
import { prettyDate } from '../lib/dates';
import { ErrorMessage, Sheet } from '../components/Sheet';
import { Icon } from '../components/Icon';
import { guardSharingStopped } from '../partner/storage';
const SharingSettings = lazy(() => import('../partner/SharingSettings'));

export function ImportSheet({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (data: AppData) => Promise<void>;
}) {
  const [backup, setBackup] = useState<Backup | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function read(file?: File) {
    setBackup(null);
    setError('');
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('Choose a backup smaller than 10 MB.');
      return;
    }
    setBusy(true);
    try {
      setBackup(parseBackup(await file.text()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We couldn’t read this file.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet title="Restore your history" onClose={onClose}>
      <div className="stack">
        <p>Choose a Rayang JSON backup. We’ll check it before changing anything.</p>
        <label>
          Backup file
          <input
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={(e) => void read(e.target.files?.[0])}
          />
        </label>
        <ErrorMessage message={error} />
        {backup && (
          <>
            <div className="soft-note">
              <strong>Backup ready</strong>
              <p>
                {backup.data.periods.length} periods · {backup.data.diary.length} notes ·{' '}
                {backup.data.observations.length} ovulation signs · {backup.data.bleeding.length} individual
                bleeding days
              </p>
              <p className="small">Exported {prettyDate(backup.exportedAt.slice(0, 10), 'd MMM yyyy')}</p>
            </div>
            <p>
              This replaces your current history. A recovery copy of the current data will be saved on this
              device first. You can export that copy in Settings.
            </p>
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await onImport(backup.data);
                  onClose();
                } catch {
                  setError('The restore could not be completed. Your existing history has not been changed.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Restoring…' : 'Replace history with this backup'}
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}
export function DeleteSheet({ onClose, onDelete }: { onClose: () => void; onDelete: () => Promise<void> }) {
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Sheet title="Delete all data?" onClose={onClose}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (confirmation !== 'DELETE') return;
          setBusy(true);
          try {
            await onDelete();
            onClose();
          } catch {
            setError('Your data could not be deleted. Please try again.');
            setBusy(false);
          }
        }}
      >
        <p>
          This permanently removes your periods, diary, signs, preferences and local recovery copy from this
          device. Downloaded backups remain wherever you saved them.
        </p>
        <p>Export a backup first if you might want your history later.</p>
        <label>
          Type DELETE to confirm
          <input
            value={confirmation}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </label>
        <ErrorMessage message={error} />
        <button className="danger-button" disabled={busy || confirmation !== 'DELETE'}>
          {busy ? 'Deleting…' : 'Permanently delete all data'}
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          Keep my data
        </button>
      </form>
    </Sheet>
  );
}
export function Settings({
  data,
  change,
  onImport,
  onDelete,
  demo = false,
}: {
  data: AppData;
  change: (fn: (data: AppData) => AppData) => Promise<void>;
  onImport: () => void;
  onDelete: () => void;
  demo?: boolean;
}) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function action(fn: () => Promise<void> | void) {
    setError('');
    setMessage('');
    try {
      await fn();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'That didn’t work. Please try again. Your history is still on this device.',
      );
    }
  }
  return (
    <section className="page settings-page">
      <p className="eyebrow">Just the essentials</p>
      <h1>Make yourself at home</h1>
      <section className="settings-section">
        <h2>Preferences</h2>
        <fieldset className="week-preference">
          <legend>First day of the week</legend>
          {[1, 0].map((day) => (
            <label className="radio-choice" key={day}>
              <input
                type="radio"
                name="week"
                checked={data.profile?.weekStartsOn === day}
                onChange={() =>
                  void action(() =>
                    change((d) => ({
                      ...d,
                      profile: d.profile ? { ...d.profile, weekStartsOn: day as 0 | 1 } : null,
                    })),
                  )
                }
              />
              {day ? 'Monday' : 'Sunday'}
            </label>
          ))}
        </fieldset>
      </section>
      <section className="settings-section">
        <h2>Your data</h2>
        <p className="small">
          Stored only in this browser on this device. Safari may remove website data, so keep occasional
          backups in a safe place. JSON backups contain readable personal information.
        </p>
        <div className="settings-actions">
          <button
            onClick={() =>
              void action(() => {
                downloadBackup(makeBackup(data));
                setMessage('Backup download requested. Keep it somewhere private.');
              })
            }
          >
            <Icon name="download" />
            Export data
            <Icon name="chevron" />
          </button>
          <button
            onClick={() =>
              void action(async () => {
                if (!demo) await guardSharingStopped();
                onImport();
              })
            }
          >
            <Icon name="upload" />
            Import data
            <Icon name="chevron" />
          </button>
          <button
            onClick={() =>
              void action(async () => {
                const recovery = demo ? undefined : await db.recovery.get('before-import');
                if (recovery) {
                  downloadBackup(recovery.backup, 'rayang-before-import');
                  setMessage('Recovery copy download requested.');
                } else setMessage('No recovery copy yet. One is saved before each import.');
              })
            }
          >
            <Icon name="download" />
            Export pre-import recovery copy
            <Icon name="chevron" />
          </button>
          <button
            onClick={() =>
              void action(async () => {
                const allowed = await navigator.storage?.persist?.();
                setMessage(
                  allowed
                    ? 'Persistent storage granted. Keep backups too.'
                    : 'This browser decides how long to keep website data. Backups are your best protection.',
                );
              })
            }
          >
            <Icon name="lock" />
            Help keep data on this device
            <Icon name="chevron" />
          </button>
          <button
            className="danger-text"
            onClick={() =>
              void action(async () => {
                if (!demo) await guardSharingStopped();
                onDelete();
              })
            }
          >
            Delete all data
          </button>
        </div>
        <ErrorMessage message={error} />
        <p role="status" className="small">
          {message}
        </p>
      </section>
      <Suspense fallback={<p className="small">Opening sharing settings…</p>}>
        <SharingSettings demo={demo} />
      </Suspense>
      <section className="settings-section">
        <h2>How estimates work</h2>
        <p>
          Cycle length is the number of days between two logged period starts. We use up to six recent cycles,
          balancing their middle value with a recent-weighted average. Unusual cycles stay in your history,
          with a limited effect on the estimate.
        </p>
        <p>
          With little history, your starting estimate helps. If you didn’t know your cycle length, we start at
          28 days. Period length uses the middle duration of your latest recorded periods.
        </p>
        <p>
          Ovulation is estimated 14 days before the next expected period. The possible fertile window spans
          five days before to one day after that estimate. Logged signs are kept as observations and don’t
          confirm or change predicted ovulation.
        </p>
        <p>
          With at least three cycles, date ranges use the median absolute deviation, scaled by 1.4826 and
          rounded up. They describe variation, not a guaranteed window or probability.
        </p>
      </section>
      <section className="settings-section">
        <h2>About Rayang</h2>
        <p>A small, personal space for your cycle. Partner View release 0.2.</p>
        <p>
          No accounts, analytics or tracking. Cycle tracking stays local unless you explicitly enable Partner
          Sharing. Only selected cycle information is then encrypted and sent to the sharing service. Notes
          and symptoms stay local. Local storage is not encrypted by this app; your device lock helps protect
          it.
        </p>
        <p>
          Predictions are estimates, not a fertility test, pregnancy test, diagnosis, or contraception. Days
          outside a possible fertile window are not guaranteed pregnancy-safe. This app does not replace
          professional medical advice.
        </p>
        <p className="small">
          An independent personal project. Not affiliated with Flo or any other menstrual tracking service.
        </p>
        <p className="small">Source repository: add your repository URL before sharing the project.</p>
        <details>
          <summary>Install on iPhone</summary>
          <p>
            Open this site in Safari, tap Share, then Add to Home Screen. Open the app once while online so
            its files can be saved for offline use.
          </p>
        </details>
      </section>
    </section>
  );
}
