import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CashEvent } from "./Cash-Event.js";

export const SimulationOptionsSchema = S.Struct({
  runCount: S.optional(S.Number),
  runLength: S.optional(S.Number),
  dateVarianceDays: S.optional(S.Number),
  valueVariancePct: S.optional(S.Number),
});

export type SimulationOptions = typeof SimulationOptionsSchema.Type;

export class DefaultSimulationConfig extends Effect.Service<DefaultSimulationConfig>()(
  "DefaultSimulationConfig",
  {
    sync: () =>
      ({
        runLength: 60,
        runCount: 20,
        dateVarianceDays: 10,
        valueVariancePct: 20,
      }) satisfies Required<SimulationOptions>,
  },
) {}

export const PredictionSchema = S.Struct({
  run: S.Number,
  occursOn: S.DateFromString,
  value: S.Number,
});

export type Prediction = typeof PredictionSchema.Type;

export const SimulationRunSchema = S.Struct({
  runIndex: S.Number,
  predictions: S.Array(PredictionSchema),
  balanceSeries: S.Array(S.Number),
});

export type SimulationRun = typeof SimulationRunSchema.Type;

export const PercentileDaySchema = S.Struct({
  day: S.Number,
  p10: S.Number,
  p25: S.Number,
  p50: S.Number,
  p75: S.Number,
  p90: S.Number,
});

export const SimulationId = S.String.pipe(S.brand("SimulationId"));

export type PercentileDay = typeof PercentileDaySchema.Type;

export const SimulationReportSchema = S.Struct({
  id: SimulationId,
  meta: S.Struct({
    runCount: S.Number,
    runLength: S.Number,
    runDate: S.DateTimeUtc,
  }),
  cashEvents: S.Array(CashEvent),
  forecast: S.Array(PercentileDaySchema),
  runs: S.Array(SimulationRunSchema),
});

export type SimulationReport = typeof SimulationReportSchema.Type;
