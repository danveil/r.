import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { ErrorMessage, Sheet } from '../components/Sheet';
import { UpdateNotice } from '../components/UpdateNotice';
import { prettyDate, todayKey, weekDates } from '../lib/dates';
import { PHASE_LABELS } from '../lib/prediction';
import { cachedPartner, refreshPartner } from './service';

import { PartnerError } from './api';
import { clearPartner, partnerDB } from './storage';
import { dayLabel, dayPhase } from './snapshot';
import { PERMISSION_LABELS, type SharedDay, type Snapshot } from './protocol';
import './partner.css';

export default function PartnerView({
  demoSnapshot,
  demoStatus,
}: {
  demoSnapshot?: Snapshot;
  demoStatus?: string;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(demoSnapshot ?? null);
  const [tab, setTab] = useState<'home' | 'calendar' | 'settings'>('home');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [selected, setSelected] = useState<SharedDay | null>(null);
  const [disconnect, setDisconnect] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine || demoStatus === 'offline');
  const demo = demoSnapshot !== undefined || demoStatus !== undefined;
  async function refresh() {
    if (demo) return;
    setBusy(true);
    setError('');
    try {
      const next = await refreshPartner();
      setSnapshot(next);
      setConnected(true);
      setMessage('Shared information refreshed.');
    } catch (err) {
      if (err instanceof PartnerError && err.reason === 'unavailable') {
        setSnapshot(null);
        setConnected(false);
        setMessage('This partner connection is no longer active.');
      } else setError(err instanceof PartnerError ? err.message : 'Couldn’t refresh right now. Try again.');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (demo) return;
    let alive = true;
    void (async () => {
      const connection = await partnerDB.partner.get('partner');
      if (!alive) return;
      setConnected(!!connection);
      if (!connection) return;
      try {
        const cached = await cachedPartner();
        if (alive) setSnapshot(cached);
      } catch {
        if (alive) setError('We couldn’t read the saved cycle. Try pairing again.');
      }
      if (alive) await refresh();
    })().catch(() => {
      if (alive)
        setError('Device storage could not be opened. Check browser storage permissions and try again.');
    });
    return () => {
      alive = false;
    };
    // Load this connection once; foreground refresh is registered separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (demo) return;
    const online = () => {
      setOffline(!navigator.onLine);
      if (navigator.onLine) void refresh();
    };
    const visible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', online);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', online);
      document.removeEventListener('visibilitychange', visible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);
  const categories = (value: Snapshot) => (
    <ul className="shared-categories">
      {(Object.keys(PERMISSION_LABELS) as (keyof typeof PERMISSION_LABELS)[])
        .filter((k) => value.permissions[k])
        .map((k) => (
          <li key={k}>{PERMISSION_LABELS[k]}</li>
        ))}
    </ul>
  );
  const calendar = (days: SharedDay[]) => (
    <div className="calendar-grid partner-calendar">
      {days.map((day) => (
        <button
          key={day.date}
          className={`calendar-day phase-${dayPhase(day)} ${day.period === 'actual' ? 'actual' : 'estimated'} ${day.date === todayKey() ? 'today' : ''}`}
          aria-label={`${prettyDate(day.date, 'EEEE, d MMMM yyyy')}, ${dayLabel(day)}`}
          aria-current={day.date === todayKey() ? 'date' : undefined}
          onClick={() => setSelected(day)}
        >
          <span>
            {prettyDate(day.date, 'd')}
            <small className="outside-month">{prettyDate(day.date, 'MMM')}</small>
          </span>
          <span className="day-markers" aria-hidden="true">
            {day.period === 'actual' ? '−' : day.ovulation ? '○' : day.fertile ? '·' : ''}
          </span>
        </button>
      ))}
    </div>
  );
  const stale =
    !!snapshot &&
    (Date.now() - Date.parse(snapshot.generatedAt) > 24 * 60 * 60 * 1000 || snapshot.date !== todayKey());
  return (
    <div
      className="app-shell partner-shell"
      onClickCapture={(e) =>
        (e.target as Element).closest<HTMLButtonElement>('button')?.focus({ preventScroll: true })
      }
    >
      {demo && <div className="demo-banner">Partner demo · no network sync</div>}
      <main className="page">
        <header className="partner-header">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              r.
            </span>
            rayang
          </div>
          <span className="read-only">Partner View · Read only</span>
        </header>
        {!snapshot ? (
          <div className="stack">
            <h1>A shared rhythm</h1>
            {!demo && (
              <button className="secondary" onClick={() => location.assign('/partner/setup')}>
                I have a partner setup code
              </button>
            )}
            <p>
              {message ||
                (demoStatus === 'revoked'
                  ? 'This partner connection is no longer active.'
                  : 'Connect to the internet to receive the shared cycle. To pair, scan a private invitation from Rayang Settings.')}
            </p>
            {connected && (
              <>
                <button className="primary" disabled={busy} onClick={() => void refresh()}>
                  Refresh shared cycle
                </button>
                <button className="danger-text" onClick={() => setDisconnect(true)}>
                  Disconnect this device
                </button>
              </>
            )}
            {!connected && !demo && (
              <button
                className="text-button"
                onClick={async () => {
                  await partnerDB.preferences.delete('role');
                  location.assign('/');
                }}
              >
                Use Rayang for myself
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="freshness" role="status">
              <strong>
                {offline
                  ? 'Offline · saved snapshot'
                  : stale
                    ? 'Older snapshot · refresh to check'
                    : 'Last shared snapshot'}
              </strong>
              <span>
                For {prettyDate(snapshot.date, 'd MMM yyyy')} · Updated{' '}
                {new Date(snapshot.generatedAt).toLocaleString()}
              </span>
            </div>
            {tab === 'home' && (
              <>
                <section className={`phase-hero phase-${snapshot.current?.phase ?? 'unknown'} partner-hero`}>
                  <p className="eyebrow">Her shared rhythm</p>
                  <h1>
                    {snapshot.current
                      ? snapshot.current.phase === 'unknown'
                        ? 'Shared cycle'
                        : PHASE_LABELS[snapshot.current.phase]
                      : 'A little perspective'}
                  </h1>
                  {snapshot.current && (
                    <p className="partner-cycle-day">Cycle day {snapshot.current.cycleDay ?? '—'}</p>
                  )}
                  {snapshot.current && (
                    <p className="small">
                      {snapshot.current.isActualPeriod
                        ? 'Recorded as on a period on the snapshot date'
                        : 'Phase is an estimate for the snapshot date'}
                    </p>
                  )}
                  {snapshot.period && (
                    <p className="hero-sentence">
                      Next period estimated {prettyDate(snapshot.period.rangeStart)}–
                      {prettyDate(snapshot.period.rangeEnd)}.
                    </p>
                  )}
                </section>
                {snapshot.calendar.length > 0 && (
                  <section className="week-section">
                    <h2>Shared week</h2>
                    {calendar(
                      snapshot.calendar.filter((day) => weekDates(snapshot.date, 1).includes(day.date)),
                    )}
                  </section>
                )}
                {snapshot.fertility && (
                  <section className="settings-section">
                    <h2>Possible fertile window</h2>
                    <p>
                      {prettyDate(snapshot.fertility.start)}–{prettyDate(snapshot.fertility.end)}
                    </p>
                    <p className="small">Predicted ovulation · {prettyDate(snapshot.fertility.ovulation)}</p>
                  </section>
                )}
              </>
            )}
            {tab === 'calendar' && (
              <>
                <h1>Shared calendar</h1>
                {snapshot.calendar.length ? (
                  <>
                    <p className="small">
                      {prettyDate(snapshot.calendar[0].date)}–{prettyDate(snapshot.calendar.at(-1)!.date)}.
                      Only the shared range is shown.
                    </p>
                    <div className="calendar-grid">
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((v, i) => (
                        <span className="weekday" key={i}>
                          {v}
                        </span>
                      ))}
                    </div>
                    {calendar(snapshot.calendar)}
                    <div className="legend">
                      {snapshot.permissions.period && (
                        <>
                          <span>Solid − logged period</span>
                          <span>Dashed · estimated period</span>
                        </>
                      )}
                      {snapshot.permissions.fertility && (
                        <>
                          <span>Ring ○ predicted ovulation</span>
                          <span>Green · possible fertile days</span>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <p>A calendar hasn’t been shared with you.</p>
                )}
              </>
            )}
            {tab === 'settings' && (
              <>
                <h1>Your connection</h1>
                {!demo && (
                  <button className="text-button" onClick={() => location.assign('/#primary')}>
                    Return to my cycle
                  </button>
                )}
                <section className="settings-section">
                  <h2>Shared categories</h2>
                  {categories(snapshot)}
                  <p>
                    Information is decrypted on this device. Cached information remains readable offline until
                    you disconnect, or the app learns that access has stopped.
                  </p>
                </section>
                <section className="settings-section">
                  <h2>Privacy & estimates</h2>
                  <p>
                    This is read-only access to selected timing information. You cannot edit the primary
                    user’s data or access their diary and symptoms.
                  </p>
                  <p>
                    Predictions are estimates, not contraception or medical diagnosis. Days outside a possible
                    fertile window are not guaranteed pregnancy-safe.
                  </p>
                  <p>
                    Device storage is not a hardware keychain. Someone with access to your unlocked device may
                    see this information. The primary user can stop future synchronization.
                  </p>
                  <details>
                    <summary>Install Partner View on iPhone</summary>
                    <p>
                      Install Rayang from Safari → Share → Add to Home Screen. Finish pairing inside the
                      installed app with a fresh invitation’s setup code. Pairing saved in Safari may not
                      appear in Home Screen Rayang. Open once online before using the cached view offline.
                    </p>
                  </details>
                </section>
                <button className="danger-text" onClick={() => setDisconnect(true)}>
                  Disconnect this device
                </button>
              </>
            )}
            <button className="text-button" disabled={busy || demo} onClick={() => void refresh()}>
              {busy ? 'Refreshing…' : 'Refresh shared cycle'}
            </button>
          </>
        )}
        <ErrorMessage message={error} />
        {message && snapshot && (
          <p role="status" className="small">
            {message}
          </p>
        )}
      </main>
      {snapshot && (
        <nav className="bottom-nav partner-nav" aria-label="Partner navigation">
          {(['home', 'calendar', 'settings'] as const).map((item) => (
            <button
              key={item}
              aria-current={tab === item ? 'page' : undefined}
              onClick={() => {
                setTab(item);
                window.scrollTo(0, 0);
              }}
            >
              <Icon name={item} />
              <span>{item[0].toUpperCase() + item.slice(1)}</span>
            </button>
          ))}
        </nav>
      )}
      {selected && (
        <Sheet title={prettyDate(selected.date, 'd MMMM yyyy')} onClose={() => setSelected(null)}>
          <div className="stack">
            <h3>{dayLabel(selected)}</h3>
            <p>
              {selected.period === 'actual'
                ? 'Recorded in the shared snapshot.'
                : 'An estimate from the last shared snapshot.'}
            </p>
            <p className="small">Partner View is read-only.</p>
          </div>
        </Sheet>
      )}
      {disconnect && (
        <Sheet title="Disconnect this device?" onClose={() => setDisconnect(false)}>
          <div className="stack">
            <p>
              This removes the pairing credentials and cached cycle from this device. It does not change the
              primary user’s records. Ask them to stop sharing to remove the remote snapshot too.
            </p>
            <button
              className="danger-button"
              onClick={async () => {
                if (!demo) await clearPartner();
                setSnapshot(null);
                setConnected(false);
                setDisconnect(false);
                setMessage('This device is disconnected.');
              }}
            >
              Confirm disconnect
            </button>
          </div>
        </Sheet>
      )}
      <UpdateNotice formOpen={!!selected || disconnect} />
    </div>
  );
}
