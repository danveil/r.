import { useState } from 'react';
import type { AppData, DateKey, DiaryEntry, OvulationObservation, PeriodRecord } from '../types';
import { FLOWS, INDICATORS, MOODS, SYMPTOMS } from '../types';
import { prettyDate } from '../lib/dates';
import { newId, savePeriod, stamp } from '../lib/records';
import { getCycleState, PHASE_LABELS } from '../lib/prediction';
import { Chips, ErrorMessage, Sheet } from '../components/Sheet';
type Change = (update: (data: AppData) => AppData) => Promise<void>;
type Common = { value: DateKey; today: DateKey; data: AppData; onClose: () => void; change: Change };
function useSave(onClose: () => void) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We couldn’t save that. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return { error, busy, save };
}
export function DiarySheet({ value, data, today, onClose, change }: Common) {
  const entry = data.diary.find((d) => d.date === value);
  const [note, setNote] = useState(entry?.note ?? '');
  const [mood, setMood] = useState(entry?.mood ?? []);
  const [symptoms, setSymptoms] = useState(entry?.symptoms ?? []);
  const [flow, setFlow] = useState(entry?.flow ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { error, busy, save } = useSave(onClose);
  const dirty =
    note !== (entry?.note ?? '') ||
    JSON.stringify(mood) !== JSON.stringify(entry?.mood ?? []) ||
    JSON.stringify(symptoms) !== JSON.stringify(entry?.symptoms ?? []) ||
    flow !== (entry?.flow ?? '');
  const hasContent = note.trim() || mood.length || symptoms.length || flow;
  return (
    <Sheet title={entry ? 'Your daily note' : 'A moment for you'} dirty={dirty && !busy} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          const updated: DiaryEntry = {
            date: value,
            note: note.trim(),
            mood,
            symptoms,
            ...(flow ? { flow } : {}),
            updatedAt: stamp(),
          };
          void save(() =>
            change((d) => ({ ...d, diary: [...d.diary.filter((v) => v.date !== value), updated] })),
          );
        }}
      >
        <p className="sheet-date">{prettyDate(value, 'EEEE, d MMMM yyyy')}</p>
        <label>
          How did today feel?
          <textarea
            data-initial-focus
            rows={3}
            maxLength={10000}
            placeholder="Anything you’d like to remember…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <p className="small">A note, a few tags, or both. This space is yours.</p>
        <Chips title="Mood" options={MOODS} selected={mood} onChange={setMood} />
        <Chips
          title="Body & everyday feelings"
          options={SYMPTOMS}
          selected={symptoms}
          onChange={setSymptoms}
        />
        <Chips
          title="Flow · optional"
          options={FLOWS}
          selected={flow ? [flow] : []}
          onChange={(values) => setFlow(values.filter((v) => v !== flow)[0] ?? '')}
        />
        <ErrorMessage message={error} />
        <div className="sheet-actions">
          <button className="primary" disabled={busy || !hasContent || value > today}>
            {busy ? 'Saving…' : 'Save note'}
          </button>
        </div>
        {entry && (
          <button
            type="button"
            className="danger-text"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            Delete this note
          </button>
        )}
        {confirmDelete && (
          <div className="confirm-box">
            <p>Delete this day’s note and tags?</p>
            <button
              type="button"
              className="danger-button"
              disabled={busy}
              onClick={() =>
                void save(() => change((d) => ({ ...d, diary: d.diary.filter((v) => v.date !== value) })))
              }
            >
              Yes, delete note
            </button>
            <button type="button" className="text-button" onClick={() => setConfirmDelete(false)}>
              Keep note
            </button>
          </div>
        )}
      </form>
    </Sheet>
  );
}
export function PeriodSheet({
  value,
  today,
  onClose,
  change,
  record,
  ending = false,
}: Common & { record?: PeriodRecord; ending?: boolean }) {
  const [start, setStart] = useState(record?.startDate ?? value);
  const [status, setStatus] = useState<PeriodRecord['status']>(
    ending ? 'ended' : (record?.status ?? (value < today ? 'ended' : 'active')),
  );
  const [end, setEnd] = useState(record?.endDate ?? value);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { error, busy, save } = useSave(onClose);
  return (
    <Sheet
      title={ending ? 'My period ended' : record ? 'Edit period' : 'Log a period'}
      dirty={dirty && !busy}
      onClose={onClose}
    >
      <form
        className="stack"
        onChange={() => setDirty(true)}
        onSubmit={(e) => {
          e.preventDefault();
          const time = stamp();
          const updated: PeriodRecord = {
            id: record?.id ?? newId(),
            startDate: start,
            ...(status === 'ended' ? { endDate: end } : {}),
            status,
            createdAt: record?.createdAt ?? time,
            updatedAt: time,
          };
          void save(() => change((d) => savePeriod(d, updated)));
        }}
      >
        <p>Record what happened. Your estimates will adjust around it.</p>
        <label>
          First bleeding day
          <input
            type="date"
            min="1900-01-01"
            max={today}
            value={start}
            required
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <fieldset className="choice-list">
          <legend>Period status</legend>
          {[
            ['active', 'Still in progress'],
            ['ended', 'Ended — I know the last day'],
            ['end-unknown', 'Ended — last day unknown'],
          ].map(([v, label]) => (
            <label className="radio-choice" key={v}>
              <input
                type="radio"
                name="status"
                checked={status === v}
                onChange={() => setStatus(v as PeriodRecord['status'])}
              />
              {label}
            </label>
          ))}
        </fieldset>
        {status === 'ended' && (
          <label>
            Last bleeding day
            <input
              type="date"
              required
              min={start}
              max={today}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        )}
        {status === 'active' && (
          <p className="small">This period is treated as ongoing through today until you log its end.</p>
        )}
        {status === 'end-unknown' && (
          <p className="small">
            Only the start is recorded as an actual day. Its duration remains an estimate.
          </p>
        )}
        <ErrorMessage message={error} />
        <button className="primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save period'}
        </button>
        {record && (
          <button
            type="button"
            className="danger-text"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            Delete this period
          </button>
        )}
        {confirmDelete && (
          <div className="confirm-box">
            <p>Delete this period range? Notes and separately logged bleeding days will stay.</p>
            <button
              type="button"
              className="danger-button"
              disabled={busy}
              onClick={() =>
                void save(() =>
                  change((d) => ({ ...d, periods: d.periods.filter((p) => p.id !== record?.id) })),
                )
              }
            >
              Yes, delete period
            </button>
            <button type="button" className="text-button" onClick={() => setConfirmDelete(false)}>
              Keep period
            </button>
          </div>
        )}
      </form>
    </Sheet>
  );
}
export function OvulationSheet({ value, data, today, onClose, change }: Common) {
  const entry = data.observations.find((o) => o.date === value);
  const [observedDate, setObservedDate] = useState(value);
  const [indicators, setIndicators] = useState(entry?.indicators ?? []);
  const [note, setNote] = useState(entry?.note ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { error, busy, save } = useSave(onClose);
  const dirty =
    observedDate !== value ||
    note !== (entry?.note ?? '') ||
    JSON.stringify(indicators) !== JSON.stringify(entry?.indicators ?? []);
  return (
    <Sheet
      title={entry ? 'Edit ovulation sign' : 'Log ovulation sign'}
      dirty={dirty && !busy}
      onClose={onClose}
    >
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          const time = stamp();
          const observation: OvulationObservation = {
            id: entry?.id ?? newId(),
            date: observedDate,
            indicators,
            note: note.trim(),
            createdAt: entry?.createdAt ?? time,
            updatedAt: time,
          };
          void save(() =>
            change((d) => ({
              ...d,
              observations: [...d.observations.filter((o) => o.id !== observation.id), observation],
            })),
          );
        }}
      >
        <p>
          A sign you noticed, not confirmation of ovulation. These observations won’t move your estimated
          dates.
        </p>
        <label>
          Day noticed
          <input
            type="date"
            value={observedDate}
            required
            min="1900-01-01"
            max={today}
            onChange={(e) => setObservedDate(e.target.value)}
          />
        </label>
        <Chips
          title="What did you notice?"
          options={INDICATORS}
          selected={indicators}
          onChange={setIndicators}
        />
        <label>
          Anything else? · optional
          <textarea rows={3} maxLength={10000} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <ErrorMessage message={error} />
        <button className="primary" disabled={busy || !indicators.length}>
          {busy ? 'Saving…' : 'Save sign'}
        </button>
        {entry && (
          <button type="button" className="danger-text" onClick={() => setConfirmDelete(true)}>
            Delete this sign
          </button>
        )}
        {confirmDelete && (
          <div className="confirm-box">
            <p>Delete this ovulation observation?</p>
            <button
              type="button"
              className="danger-button"
              disabled={busy}
              onClick={() =>
                void save(() =>
                  change((d) => ({ ...d, observations: d.observations.filter((o) => o.id !== entry?.id) })),
                )
              }
            >
              Yes, delete sign
            </button>
            <button type="button" className="text-button" onClick={() => setConfirmDelete(false)}>
              Keep sign
            </button>
          </div>
        )}
      </form>
    </Sheet>
  );
}
export function DateDetailSheet({
  value,
  today,
  data,
  onClose,
  change,
  onDiary,
  onPeriod,
  onOvulation,
}: Common & { onDiary: () => void; onPeriod: (record?: PeriodRecord) => void; onOvulation: () => void }) {
  const state = getCycleState(value, data, today);
  const entry = data.diary.find((d) => d.date === value);
  const observation = data.observations.find((o) => o.date === value);
  const individualDay = data.bleeding.some((d) => d.date === value);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const { error, busy, save } = useSave(onClose);
  const period = state.period ?? data.periods.find((p) => p.startDate === value);
  return (
    <Sheet title={prettyDate(value, 'd MMMM yyyy')} onClose={onClose}>
      <div className="stack">
        <div className={`date-summary phase-${state.phase}`}>
          <p className="eyebrow">
            {state.cycleDay ? `Cycle day ${state.cycleDay}` : 'No cycle recorded yet'}
          </p>
          <h3>
            {state.actual
              ? 'Logged period'
              : state.phase === 'unknown'
                ? 'No phase estimate'
                : `Estimated · ${PHASE_LABELS[state.phase]}`}
          </h3>
          <p className="small">
            {state.actual ? 'Actual bleeding recorded' : 'Calculated estimate, not a recorded event'}
          </p>
        </div>
        {entry && (
          <div className="note-preview">
            <p>{entry.note}</p>
            <div className="chips">
              {[...entry.mood, ...entry.symptoms, entry.flow].filter(Boolean).map((s) => (
                <span className="chip static" key={s}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
        {observation && (
          <div className="soft-note">
            <strong>Ovulation sign logged</strong>
            <p>{observation.indicators.join(' · ')}</p>
            {observation.note && <p>{observation.note}</p>}
          </div>
        )}
        {value <= today ? (
          <>
            <button className="primary" onClick={onDiary}>
              {entry ? 'Edit note' : 'Add note'}
            </button>
            <button className="secondary" onClick={() => onPeriod(period)}>
              {period ? 'Edit period range' : 'Mark period started'}
            </button>
            {!state.actual && (
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  void save(() =>
                    change((d) => ({
                      ...d,
                      bleeding: [
                        ...d.bleeding.filter((b) => b.date !== value),
                        { date: value, updatedAt: stamp() },
                      ],
                    })),
                  )
                }
              >
                Mark only this bleeding day
              </button>
            )}
            {individualDay && (
              <button className="danger-text" onClick={() => setConfirmRemove(true)}>
                Remove this bleeding day
              </button>
            )}
            {confirmRemove && (
              <div className="confirm-box">
                <p>Remove this separately logged bleeding day?</p>
                <button
                  className="danger-button"
                  disabled={busy}
                  onClick={() =>
                    void save(() =>
                      change((d) => ({ ...d, bleeding: d.bleeding.filter((b) => b.date !== value) })),
                    )
                  }
                >
                  Yes, remove day
                </button>
                <button className="text-button" onClick={() => setConfirmRemove(false)}>
                  Keep day
                </button>
              </div>
            )}
            <button className="text-button" onClick={onOvulation}>
              {observation ? 'Edit ovulation sign' : 'Log ovulation sign'}
            </button>
            <p className="small">
              A single bleeding day does not start a new cycle. Use “Mark period started” for a new cycle.
            </p>
          </>
        ) : (
          <p className="small">You can record how this day felt when it arrives.</p>
        )}
        <ErrorMessage message={error} />
      </div>
    </Sheet>
  );
}
