import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import type { CashEvent } from "../domain/Cash-Event.js";
import {
  SimulationId,
  type SimulationOptions,
  SimulationReportSchema,
} from "../domain/Simulation.js";
import { ReduceToPercentiles } from "./Percentiles.js";
import { PredictionsService } from "./Prediction-Service.js";

export class SimulationService extends Effect.Service<SimulationService>()(
  "services/SimulationService",
  {
    dependencies: [PredictionsService.Default, ReduceToPercentiles.Default],
    effect: Effect.gen(function* (_) {
      const reduceToPercentiles = yield* _(ReduceToPercentiles);
      const Predictions = yield* _(PredictionsService);

      const generate = Effect.fn("SimulationService.generate")(function* (
        events: CashEvent[],
        opts: SimulationOptions,
        seed?: string,
      ) {
        const now = yield* DateTime.now;

        const { runs, runCount, runLength } = yield* Predictions.generate(
          events,
          opts,
          seed,
        );

        const forecast = yield* reduceToPercentiles(runs);

        return SimulationReportSchema.make({
          id: SimulationId.make(crypto.randomUUID()),
          runs,
          forecast,
          cashEvents: events,
          meta: {
            runCount,
            runLength,
            runDate: now,
          },
        });
      });

      return {
        generate,
      } as const;
    }),
  },
) {}
