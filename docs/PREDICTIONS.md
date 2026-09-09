# Prediction model, version 1

All functions in `src/lib/prediction.ts` are pure. Input observations are never mutated and generated dates are never stored as observations.

## Dates and recorded events

Cycle/diary dates are validated `YYYY-MM-DD` calendar strings, not UTC instants. `date-fns/parseISO` parses a date-only string into local time. Formatting uses local calendar fields; addition and differences use calendar-day functions. Only creation/update/export metadata use ISO UTC timestamps. A focus/visibility listener and 30-second timer refresh today after midnight or device resume.

A completed cycle is the day difference between successive actual period starts, sorted chronologically. A period does not need an exact end for its start-to-start cycle length to be known. Actual gaps are not bounded to a typical biological interval: irregular or missed logs stay visible in history. Starting priors accept 10–180 days or unknown; typical starting bleeding duration accepts 1–30 days. Observed period ranges have no duration cap.

Period statuses:

- `active`: bleeding is treated as ongoing from the actual start through today, never into the future. Only the last chronological record may be active.
- `ended`: inclusive actual range from start through the known last bleeding day.
- `end-unknown`: only the start is actual. A duration estimate may be displayed, but it is not a recorded end and is excluded from duration statistics.

Individually recorded bleeding days are a separate table. They override phase display but do not create cycle boundaries. Flow tags in the diary do not silently start periods either. Period overlaps, duplicate dates/IDs and invalid date ranges are rejected before writes. Newly entered or changed observation dates cannot be later than today. Existing records and explicit backup restores preserve their valid calendar dates even if travel or a clock correction makes them appear ahead of the local date; this does not make the whole database invalid. Deleting the final period is allowed; Home then offers a new period start while other notes remain intact.

## Cycle-length estimate

Let `x` be the last six completed cycle lengths in chronological order, `n` their count, and `p` the onboarding cycle length (28 if unknown).

- No completed cycle: `estimate = p`.
- One or two: `estimate = (sum(x) + p) / (n + 1)`. The prior has the weight of one observation.
- Three or more: let `m = median(x)` and `MAD = median(abs(x − m))`. Bound each value **for estimation only** to `m ± max(3, 3 × MAD)`. Give the bounded chronological values weights `1…n` and compute their weighted mean `w`. `estimate = 0.6 × m + 0.4 × w`.

Round to the nearest whole day, minimum one day. The six-cycle horizon and chronological weights prioritize recent records. Bounding reduces one unusual cycle’s influence, without deleting it. The documented constants are deliberate product heuristics, not a clinically validated predictive model.

Maturity is `NEW` for zero completed cycles, `LIMITED` for one or two, `ESTABLISHED` for at least three. No accuracy percentages are generated.

## Period duration

Each known ended period contributes `daysBetween(start, end) + 1`. Use the rounded median of the last six known durations. Exclude active periods and unknown ends. With no known durations, use the explicitly confirmed onboarding duration.

## Prediction dates

- `nextStart = latestActualStart + estimatedCycleLength`
- `nextEnd = nextStart + estimatedPeriodLength − 1`
- `ovulation = nextStart − lutealLength`, initially 14 days
- Possible fertile window: `ovulation − 5` through `ovulation + 1`, inclusive

The `MODEL` constants and optional prediction-model argument define the luteal/fertile assumptions. Ovulation signs are saved, displayed, editable and counted. They do **not** train or move the model, because subjective signs cannot establish a reliable luteal length.

The model’s biological starting assumptions are informed by [ACOG’s fertility-awareness overview](https://www.acog.org/womens-health/faqs/fertility-awareness-based-methods-of-family-planning). That source does not validate this app or its statistical method. Dates outside the possible fertile window must never be presented as guaranteed pregnancy-safe days.

## Variation

Show the unaltered recent shortest and longest cycle lengths. Flag variation when at least three lengths exist and either the observed range is at least eight days or MAD is at least three days.

With at least three cycles, `spread = ceil(1.4826 × MAD)`; otherwise zero. If spread is at least three days, show `nextStart ± spread` in Home/Insights. The factor is the normal-consistency scale for MAD, used here only as a descriptive robust measure of recent variation. This is **not a calibrated prediction interval, probability, or guarantee**. One extreme outlier can yield a wide observed range but a small MAD; the outlier remains visible in the statistics even when the date display stays centered.

## Calendar state and priority

The latest actual start on or before the requested date is its cycle-day anchor. An existing next actual start can serve as a retrospective anchor for estimated phases in a completed historical cycle; otherwise use the current cycle estimate. Historical phase estimates can change when history is corrected and are always labeled estimates.

Display priority:

1. Actual bleeding or estimated menstrual day (solid logged vs dashed/patterned estimated treatment).
2. Predicted ovulation (ring).
3. Possible fertile window (green and dot).
4. Estimated follicular phase before predicted ovulation.
5. Estimated luteal phase after predicted ovulation.

The returned state retains fertility and ovulation flags even when bleeding wins the display priority. Today uses an underline and an external dot; notes have a small dot and ovulation observations a plus. Every date has an explicit screen-reader label.

Only the next period is projected. The model does not manufacture repeating cycles when a predicted start passes without an actual log. Cycle day remains measured from the latest actual start; it is not reset to 1 by a prediction. After the projected period window passes, show an uncertain/awaiting state and keep the period-start action available. Dates before the first actual record have no phase estimate.

No personal symptom-pattern claims are currently generated. This deliberately avoids unsubstantiated observations while history is sparse.
