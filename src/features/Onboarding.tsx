import { useState } from 'react';
import type { AppData } from '../types';
import { emptyData } from '../types';
import { daysBetween, todayKey } from '../lib/dates';
import { newId, stamp } from '../lib/records';
import { ErrorMessage } from '../components/Sheet';
import { Icon } from '../components/Icon';
export function Onboarding({
  onFinish,
  onRestore,
}: {
  onFinish: (data: AppData) => Promise<void>;
  onRestore: () => void;
}) {
  const [step, setStep] = useState(0);
  const [start, setStart] = useState('');
  const [ended, setEnded] = useState('');
  const [end, setEnd] = useState('');
  const [duration, setDuration] = useState('5');
  const [cycleChoice, setCycleChoice] = useState('');
  const [cycleLength, setCycleLength] = useState('28');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const next = () => {
    setError('');
    setStep(step + 1);
  };
  async function finish() {
    setBusy(true);
    setError('');
    const time = stamp();
    try {
      await onFinish({
        ...emptyData(),
        profile: {
          id: 'profile',
          onboardingComplete: true,
          initialTypicalCycleLength: cycleChoice === 'unknown' ? null : Number(cycleLength),
          initialTypicalPeriodLength: ended === 'yes' ? daysBetween(start, end) + 1 : Number(duration),
          weekStartsOn: 1,
        },
        periods: [
          {
            id: newId(),
            startDate: start,
            ...(ended === 'yes' ? { endDate: end } : {}),
            status: ended === 'yes' ? 'ended' : ended === 'no' ? 'active' : 'end-unknown',
            createdAt: time,
            updatedAt: time,
          },
        ],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not save your details. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="onboarding">
      <header className="brand">
        <span className="brand-mark" aria-hidden="true">
          r.
        </span>
        rayang
      </header>
      {step === 0 ? (
        <div className="welcome stack">
          <div className="welcome-orbit" aria-hidden="true">
            <span>r.</span>
          </div>
          <p className="eyebrow">A little closer to yourself</p>
          <h1>
            Your cycle.
            <br />
            Your own rhythm.
          </h1>
          <p>
            A quiet place to notice your cycle
            <br className="wide-only" /> and how you feel along the way.
          </p>
          <p className="privacy-line">
            <Icon name="lock" /> Your information stays on this device unless you enable Partner Sharing.
          </p>
          <button className="primary" onClick={next}>
            Let’s begin <Icon name="chevron" />
          </button>
          <button className="text-button" onClick={onRestore}>
            Restore from a backup
          </button>
          <button className="text-button" onClick={() => location.assign('/partner/setup')}>
            I have a partner setup code
          </button>
        </div>
      ) : (
        <form
          className="onboarding-form stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (step < 3) next();
            else void finish();
          }}
        >
          <div className="step-progress" aria-label={`Step ${step} of 3`}>
            {[1, 2, 3].map((i) => (
              <span key={i} className={i <= step ? 'done' : ''} />
            ))}
          </div>
          <p className="eyebrow">A few things to start</p>
          {step === 1 && (
            <>
              <h1>When did your latest period start?</h1>
              <p>The first day of bleeding is day one of your cycle.</p>
              <label>
                First bleeding day
                <input
                  type="date"
                  required
                  max={todayKey()}
                  min="1900-01-01"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
            </>
          )}
          {step === 2 && (
            <>
              <h1>Has that period ended?</h1>
              <div className="choice-list">
                {[
                  ['yes', 'Yes'],
                  ['no', 'Not yet'],
                  ['unknown', 'It ended, but I don’t remember when'],
                ].map(([value, label]) => (
                  <label className="radio-choice" key={value}>
                    <input
                      type="radio"
                      required
                      name="ended"
                      value={value}
                      checked={ended === value}
                      onChange={() => setEnded(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
              {ended === 'yes' && (
                <label>
                  Last bleeding day
                  <input
                    type="date"
                    required
                    min={start}
                    max={todayKey()}
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </label>
              )}
              {(ended === 'no' || ended === 'unknown') && (
                <>
                  <label>
                    How long does your period usually last?
                    <div className="number-field">
                      <input
                        type="number"
                        required
                        min="1"
                        max="30"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                      />
                      <span>days</span>
                    </div>
                  </label>
                  <p className="small">
                    5 is a starting suggestion. Please adjust it or confirm it by continuing.
                  </p>
                </>
              )}
            </>
          )}
          {step === 3 && (
            <>
              <h1>Do you know your usual cycle length?</h1>
              <p>From one period’s first day to the next period’s first day.</p>
              <div className="choice-list">
                <label className="radio-choice">
                  <input
                    type="radio"
                    required
                    name="cycle"
                    checked={cycleChoice === 'known'}
                    onChange={() => setCycleChoice('known')}
                  />
                  Yes, I have an idea
                </label>
                <label className="radio-choice">
                  <input
                    type="radio"
                    required
                    name="cycle"
                    checked={cycleChoice === 'unknown'}
                    onChange={() => setCycleChoice('unknown')}
                  />
                  I don’t know
                </label>
              </div>
              {cycleChoice === 'known' && (
                <label>
                  Usual cycle length
                  <div className="number-field">
                    <input
                      type="number"
                      min="10"
                      max="180"
                      required
                      value={cycleLength}
                      onChange={(e) => setCycleLength(e.target.value)}
                    />
                    <span>days</span>
                  </div>
                </label>
              )}
              {cycleChoice === 'unknown' && (
                <p className="soft-note">
                  We’ll begin with a 28-day estimate and adjust it as you record your periods.
                </p>
              )}
            </>
          )}
          <ErrorMessage message={error} />
          <button className="primary" disabled={busy}>
            {busy ? 'Saving…' : step === 3 ? 'Meet your cycle' : 'Continue'}
            <Icon name="chevron" />
          </button>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => {
              setError('');
              setStep(step - 1);
            }}
          >
            Back
          </button>
        </form>
      )}
    </main>
  );
}
