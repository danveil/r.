import type { AppData } from '../types';
import { prettyDate } from '../lib/dates';
import { calculateCycleStatistics, predictNextPeriod } from '../lib/prediction';
export function Insights({ data }: { data: AppData }) {
  const stats = calculateCycleStatistics(data.periods, data.profile);
  const prediction = predictNextPeriod(data.periods, data.profile);
  return (
    <section className="page insights-page">
      <p className="eyebrow">Getting to know your rhythm</p>
      <h1>A little perspective</h1>
      <p>
        {stats.completedCycles
          ? `Based on ${stats.completedCycles} recorded ${stats.completedCycles === 1 ? 'cycle' : 'cycles'}.`
          : 'A starting picture. It will become more personal as you log your periods.'}
      </p>
      <div className="insight-stats">
        <div>
          <span>Typical cycle</span>
          <strong>
            {stats.cycleLength}
            <small>days</small>
          </strong>
          <p>
            {stats.maturity === 'NEW'
              ? data.profile?.initialTypicalCycleLength
                ? 'Your starting estimate'
                : '28-day starting estimate'
              : 'Adapted from your history'}
          </p>
        </div>
        <div>
          <span>Typical period</span>
          <strong>
            {stats.periodLength}
            <small>days</small>
          </strong>
          <p>
            {stats.knownDurations ? `${stats.knownDurations} recorded durations` : 'Your starting estimate'}
          </p>
        </div>
      </div>
      <dl className="insight-list">
        <div>
          <dt>Completed cycles</dt>
          <dd>{stats.completedCycles}</dd>
        </div>
        <div>
          <dt>Recent cycle lengths</dt>
          <dd>
            {stats.recentLengths.length
              ? `${Math.min(...stats.recentLengths)}–${Math.max(...stats.recentLengths)} days`
              : 'Still learning'}
          </dd>
        </div>
        <div>
          <dt>Cycle variation</dt>
          <dd>
            {stats.recentLengths.length < 2
              ? 'More history needed'
              : `${stats.range} days from shortest to longest`}
          </dd>
        </div>
        <div>
          <dt>Next estimated period</dt>
          <dd>
            {prediction
              ? prediction.spread >= 3
                ? `${prettyDate(prediction.rangeStart)}–${prettyDate(prediction.rangeEnd)}`
                : prettyDate(prediction.nextStart, 'd MMM yyyy')
              : 'Log a period start'}
          </dd>
        </div>
        <div>
          <dt>Possible fertile window</dt>
          <dd>
            {prediction
              ? `${prettyDate(prediction.fertileStart)}–${prettyDate(prediction.fertileEnd)}`
              : 'More history needed'}
          </dd>
        </div>
        <div>
          <dt>Ovulation signs logged</dt>
          <dd>{data.observations.length}</dd>
        </div>
      </dl>
      {stats.irregular && (
        <p className="soft-note">
          Your recorded cycle lengths vary. Dates are rough estimates and may shift. Every cycle stays in your
          history.
        </p>
      )}
      <p className="small">
        {stats.maturity === 'ESTABLISHED'
          ? 'Estimates use up to six recent cycles, with less influence from unusual lengths.'
          : 'Early estimates blend your starting cycle length with the history available.'}{' '}
        Ovulation signs are observations and don’t confirm ovulation.
      </p>
    </section>
  );
}
