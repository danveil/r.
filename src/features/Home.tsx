import type { AppData } from '../types';
import { daysBetween, prettyDate } from '../lib/dates';
import { getCycleState, PHASE_LABELS, predictNextPeriod } from '../lib/prediction';
import { Icon } from '../components/Icon';
import { WeekCalendar } from './Calendar';
export function Home({
  data,
  today,
  onDate,
  onCalendar,
  onDiary,
  onPeriod,
  onOvulation,
}: {
  data: AppData;
  today: string;
  onDate: (value: string) => void;
  onCalendar: () => void;
  onDiary: () => void;
  onPeriod: (end?: boolean) => void;
  onOvulation: () => void;
}) {
  const state = getCycleState(today, data, today);
  const prediction = predictNextPeriod(data.periods, data.profile);
  const active = data.periods.find((p) => p.status === 'active');
  const until = prediction ? daysBetween(today, prediction.nextStart) : 0;
  const entry = data.diary.find((d) => d.date === today);
  const status = state.actual
    ? 'Logged period'
    : state.phase === 'unknown'
      ? 'A little room for uncertainty'
      : 'Cycle estimate';
  const sentence = !prediction
    ? 'Log a period start to see your estimates.'
    : state.overdue
      ? 'Your next period hasn’t been logged yet.'
      : prediction.spread >= 3
        ? `Next period may start ${prettyDate(prediction.rangeStart)}–${prettyDate(prediction.rangeEnd)}.`
        : until > 0
          ? `Next period estimated in ${until} ${until === 1 ? 'day' : 'days'}.`
          : until === 0
            ? 'Your next period is estimated around today.'
            : `Next period was estimated around ${prettyDate(prediction.nextStart)}.`;
  const action = active
    ? 'My period ended'
    : !prediction || until <= 3
      ? 'My period started'
      : state.fertile
        ? 'Log ovulation sign'
        : null;
  return (
    <div className="home-page">
      <header className="home-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            r.
          </span>
          rayang
        </div>
        <span>{prettyDate(today, 'EEE, d MMM')}</span>
      </header>
      <section className={`phase-hero phase-${state.phase}`} aria-labelledby="phase-title">
        <div className="hero-topline">
          <span className="eyebrow">Today, in your rhythm</span>
          <span className="status-pill">{status}</span>
        </div>
        <div
          className="cycle-orbit"
          aria-label={state.cycleDay ? `Cycle day ${state.cycleDay}` : 'No cycle recorded'}
        >
          <div className="orbit-inner">
            <span>Cycle day</span>
            <strong>{state.cycleDay ?? '—'}</strong>
          </div>
        </div>
        <h1 id="phase-title">
          {state.phase === 'menstrual' && !state.actual
            ? 'Estimated period'
            : state.overdue
              ? 'Taking its own time'
              : PHASE_LABELS[state.phase]}
        </h1>
        <p className="hero-sentence">{sentence}</p>
        {action && (
          <button
            className="context-action"
            onClick={() => (action === 'Log ovulation sign' ? onOvulation() : onPeriod(!!active))}
          >
            <Icon name={action === 'Log ovulation sign' ? 'plus' : 'drop'} />
            {action}
            <Icon name="chevron" />
          </button>
        )}
      </section>
      <WeekCalendar data={data} today={today} onSelect={onDate} onCalendar={onCalendar} />
      <section className="daily-prompt">
        <div className="daily-icon">
          <Icon name={entry ? 'check' : 'pen'} />
        </div>
        <div>
          <h2>{entry ? 'A moment, remembered.' : 'How are you feeling?'}</h2>
          <p>
            {entry
              ? entry.note || [...entry.mood, ...entry.symptoms, entry.flow].filter(Boolean).join(' · ')
              : 'A few words for yourself, whenever you’re ready.'}
          </p>
          <button className="text-button" onClick={onDiary}>
            {entry ? 'Edit today’s note' : 'Add today’s note'}
            <Icon name="chevron" />
          </button>
        </div>
      </section>
      <button className="diary-fab" aria-label="Open today’s diary" onClick={onDiary}>
        <Icon name="pen" />
      </button>
    </div>
  );
}
