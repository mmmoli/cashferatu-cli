import * as E from "effect";
import { DateTime } from "effect";
import type { CashEvent } from "./Parse.js";
import { applyDateJitter, applyValueJitter, daysFromToday } from "./Util.js";

export const DEFAULT_DATE_VARIANCE_DAYS = 10 as const;
export const DEFAULT_VALUE_VARIANCE_PERCENT = 30 as const;
export const DEFAULT_RUN_LENGTH = 30 as const;

export type SimulationOptions = {
  runCount: number;
  runLength?: number;
  dateVarianceDays?: number;
  valueVariancePct?: number;
};

export type Prediction = {
  run: number;
  occursOn: Date;
  value: number;
};

export const runSimulation = E.Effect.fn("runSimulation")(function* (
  events: CashEvent[],
  opts: SimulationOptions,
) {
  const FORECAST_LENGTH = opts.runLength ?? DEFAULT_RUN_LENGTH;
  const DATE_VARIANCE_DAYS =
    opts.dateVarianceDays ?? DEFAULT_DATE_VARIANCE_DAYS;
  const VALUE_VARIANCE_PERCENT =
    opts.valueVariancePct ?? DEFAULT_VALUE_VARIANCE_PERCENT;

  const today = yield* E.DateTime.nowAsDate;
  today.setHours(0, 0, 0, 0);

  const predictions: Prediction[] = [];

  // Step 1: Generate predictions
  for (const event of events) {
    if (event.date < today) continue;

    for (let run = 0; run < opts.runCount; run++) {
      const rng = E.Random.make(`${run}-${event.ID}`);

      const jitteredValue = yield* applyValueJitter(
        event.value,
        VALUE_VARIANCE_PERCENT,
      ).pipe(E.Effect.withRandom(rng));

      const jitteredDate = yield* applyDateJitter(
        DateTime.unsafeFromDate(event.date),
        DATE_VARIANCE_DAYS,
      ).pipe(
        E.Effect.map((dt) => DateTime.toDate(dt)),
        E.Effect.withRandom(rng),
      );

      predictions.push({
        run,
        occursOn: jitteredDate,
        value: jitteredValue,
      });
    }
  }

  // Step 2: Group predictions by run index
  const runs: number[][] = Array.from({ length: opts.runCount }, () =>
    Array(FORECAST_LENGTH).fill(0),
  );

  for (const prediction of predictions) {
    const dayOffset = yield* daysFromToday(
      DateTime.unsafeFromDate(prediction.occursOn),
    ).pipe(E.Effect.map(Math.round));

    // Skip past events completely
    if (dayOffset < 0) {
      continue;
    }

    if (dayOffset < FORECAST_LENGTH) {
      runs[prediction.run][dayOffset] += prediction.value;
    }
  }

  // Step 3: Turn into cumulative balances
  for (const run of runs) {
    for (let i = 1; i < run.length; i++) {
      run[i] += run[i - 1];
    }
  }

  return runs;
});

const getPercentile = (sorted: number[], percentile: number): number => {
  const idx = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);

  if (lower === upper) return sorted[lower];

  const weight = idx - lower;
  const result = sorted[lower] * (1 - weight) + sorted[upper] * weight;
  return parseFloat(result.toFixed(3));
};

export type PercentileDay = {
  day: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
};

export const reduceToPercentiles = (runs: number[][]): PercentileDay[] => {
  const nDays = runs[0]?.length ?? 0;

  return Array.from({ length: nDays }, (_, dayIndex) => {
    const balances = runs.map((run) => run[dayIndex]).sort((a, b) => a - b);

    return {
      day: dayIndex,
      p10: getPercentile(balances, 10),
      p25: getPercentile(balances, 25),
      p50: getPercentile(balances, 50),
      p75: getPercentile(balances, 75),
      p90: getPercentile(balances, 90),
    };
  });
};
