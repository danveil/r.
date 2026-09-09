import { useState } from 'react';
import type { AppData, DateKey } from '../types';
import { monthDates, monthShift, prettyDate, weekDates } from '../lib/dates';
import { getCycleState, PHASE_LABELS } from '../lib/prediction';
import { Icon } from '../components/Icon';
export function CalendarDay({
  value,
  data,
  today,
  selected,
  outside,
  onSelect,
}: {
  value: DateKey;
  data: AppData;
  today: DateKey;
  selected?: boolean;
  outside?: boolean;
  onSelect: (date: DateKey) => void;
}) {
  const state = getCycleState(value, data, today);
  const diary = data.diary.some((d) => d.date === value);
  const observed = data.observations.some((d) => d.date === value);
  const label = `${prettyDate(value, 'EEEE, d MMMM yyyy')}, ${state.actual ? 'Logged period' : state.phase === 'unknown' ? 'No phase estimate' : `Estimated: ${PHASE_LABELS[state.phase]}`}${diary ? ', diary entry' : ''}${observed ? ', ovulation sign logged' : ''}`;
  return (
    <button
      type="button"
      className={`calendar-day phase-${state.phase} ${state.actual ? 'actual' : 'estimated'} ${value === today ? 'today' : ''} ${outside ? 'outside' : ''} ${selected ? 'selected' : ''}`}
      aria-label={label}
      aria-current={value === today ? 'date' : undefined}
      aria-pressed={selected}
      onClick={() => onSelect(value)}
    >
      <span>
        {prettyDate(value, 'd')}
        {outside && <small className="outside-month">{prettyDate(value, 'MMM')}</small>}
      </span>
      <span className="day-markers" aria-hidden="true">
        {state.actual ? (
          <b>−</b>
        ) : state.phase === 'ovulation' ? (
          <b>○</b>
        ) : state.phase === 'fertile' ? (
          <b>·</b>
        ) : null}
        {diary && <i />}
        {observed && <b>+</b>}
      </span>
    </button>
  );
}
export function CycleLegend() {
  return (
    <div className="legend" aria-label="Calendar key">
      <span>
        <i className="legend-period" />
        Logged period
      </span>
      <span>
        <i className="legend-estimate" />
        Estimated period
      </span>
      <span>
        <i className="legend-fertile" />
        Possible fertile days
      </span>
      <span>
        <i className="legend-ovulation" />
        Predicted ovulation
      </span>
      <span>
        <i className="legend-diary" />
        Diary
      </span>
    </div>
  );
}
export function WeekCalendar({
  data,
  today,
  onSelect,
  onCalendar,
}: {
  data: AppData;
  today: DateKey;
  onSelect: (value: DateKey) => void;
  onCalendar: () => void;
}) {
  const dates = weekDates(today, data.profile?.weekStartsOn ?? 1);
  return (
    <section className="week-section">
      <div className="section-heading">
        <h2>This week</h2>
        <button className="text-button" onClick={onCalendar}>
          {prettyDate(today, 'MMMM')}
          <Icon name="chevron" />
        </button>
      </div>
      <div className="calendar-grid week-grid">
        {dates.map((d) => (
          <div key={d}>
            <span className="weekday">{prettyDate(d, 'EEEEE')}</span>
            <CalendarDay value={d} data={data} today={today} onSelect={onSelect} />
          </div>
        ))}
      </div>
    </section>
  );
}
export function Calendar({
  data,
  today,
  onSelect,
}: {
  data: AppData;
  today: DateKey;
  onSelect: (value: DateKey) => void;
}) {
  const [month, setMonth] = useState(today);
  const [selected, setSelected] = useState(today);
  const dates = monthDates(month, data.profile?.weekStartsOn ?? 1);
  return (
    <section className="page calendar-page">
      <p className="eyebrow">Your rhythm, day by day</p>
      <h1>Calendar</h1>
      <div className="month-heading">
        <button
          className="icon-button previous"
          aria-label="Previous month"
          onClick={() => setMonth(monthShift(month, -1))}
        >
          <Icon name="chevron" />
        </button>
        <h2>{prettyDate(month, 'MMMM yyyy')}</h2>
        <button
          className="icon-button"
          aria-label="Next month"
          onClick={() => setMonth(monthShift(month, 1))}
        >
          <Icon name="chevron" />
        </button>
      </div>
      <div className="calendar-grid month-grid">
        {dates.slice(0, 7).map((d) => (
          <span className="weekday" key={d}>
            {prettyDate(d, 'EEEEE')}
          </span>
        ))}
        {dates.map((d) => (
          <CalendarDay
            key={d}
            value={d}
            data={data}
            today={today}
            selected={d === selected}
            outside={d.slice(0, 7) !== month.slice(0, 7)}
            onSelect={(value) => {
              setSelected(value);
              onSelect(value);
            }}
          />
        ))}
      </div>
      <button
        className="text-button today-button"
        onClick={() => {
          setMonth(today);
          setSelected(today);
        }}
      >
        Back to today
      </button>
      <CycleLegend />
      <p className="small calendar-help">
        Tap a day to see details, add a note, or correct your history. Outlined period days are estimates.
      </p>
    </section>
  );
}
