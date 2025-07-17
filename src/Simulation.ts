import * as E from "effect";
import type { CashEvent } from "./Parse.js";

export type SimulationOptions = {
  runCount: number;
};

export type Prediction = {
  run: number;
  occursOn: Date;
  value: number;
};

const dateDiffInDays = (a: Date, b: Date): number => {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
};

export const runSimulation = E.Effect.fn("runSimulation")(function* (
  events: CashEvent[],
  opts: SimulationOptions,
) {
  const FORECAST_LENGTH = 120 as const;
  const predictions: Prediction[] = [];

  // Step 1: Generate predictions
  for (const event of events) {
    for (let run = 0; run < opts.runCount; run++) {
      predictions.push({
        run,
        occursOn: event.date,
        value: event.value,
      });
    }
  }

  // Step 2: Group predictions by run index
  const runs: number[][] = Array.from({ length: opts.runCount }, () =>
    Array(FORECAST_LENGTH).fill(0),
  );

  const today = yield* E.DateTime.nowAsDate;
  today.setHours(0, 0, 0, 0);

  for (const prediction of predictions) {
    const dayOffset = dateDiffInDays(today, prediction.occursOn);
    if (dayOffset >= 0 && dayOffset < FORECAST_LENGTH) {
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
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
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
