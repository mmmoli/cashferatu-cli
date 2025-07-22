import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Random from "effect/Random";
import type { CashEvent } from "../domain/Cash-Event.js";
import {
	DefaultSimulationConfig,
	type Prediction,
	PredictionSchema,
	type SimulationOptions,
	type SimulationRun,
	SimulationRunSchema,
} from "../domain/Simulation.js";
import { daysFromToday } from "../util/Date.js";
import { applyDateJitter, applyValueJitter } from "../util/Jitter.js";

export class GeneratePredictionsFn extends Effect.Service<GeneratePredictionsFn>()(
	"services/PredictionService/GeneratePredictionsFn",
	{
		sync: () =>
			Effect.fn(function* ({
				dateVarianceDays,
				events,
				runCount,
				valueVariancePct,
			}: {
				dateVarianceDays: number;
				events: CashEvent[];
				runCount: number;
				valueVariancePct: number;
			}) {
				const today = yield* DateTime.nowAsDate;

				const predictions: Prediction[] = [];

				for (const event of events) {
					if (event.date < today) continue;

					for (let run = 0; run < runCount; run++) {
						const rng = Random.make(`${run}-${event.ID}`);

						const jitteredValue = yield* applyValueJitter(
							event.value,
							valueVariancePct,
						).pipe(Effect.withRandom(rng));

						const jitteredDate = yield* applyDateJitter(
							DateTime.unsafeFromDate(event.date),
							dateVarianceDays,
						).pipe(
							Effect.map((dt) => DateTime.toDate(dt)),
							Effect.withRandom(rng),
						);

						predictions.push(
							PredictionSchema.make({
								run,
								occursOn: jitteredDate,
								value: jitteredValue,
							}),
						);
					}
				}

				return predictions;
			}),
	},
) {}

export class GroupPredictionsByRunIndexFn extends Effect.Service<GroupPredictionsByRunIndexFn>()(
	"services/PredictionService/GroupPredictionsByRunIndexFn",
	{
		sync: () => (predictions: Prediction[]) => {
			const byRun = new Map<number, Prediction[]>();
			for (const pred of predictions) {
				if (!byRun.has(pred.run)) byRun.set(pred.run, []);
				byRun.get(pred.run)?.push(pred);
			}

			return byRun;
		},
	},
) {}

export class ComputeBalanceForRunFn extends Effect.Service<ComputeBalanceForRunFn>()(
	"services/PredictionService/ComputeBalanceForRunFn",
	{
		sync:
			() =>
			({
				runCount,
				runLength,
				byRun,
			}: {
				runCount: number;
				runLength: number;
				byRun: Map<number, Prediction[]>;
			}) =>
				Effect.forEach(
					Array.from({ length: runCount }, (_, runIndex) => runIndex),
					(runIndex) =>
						Effect.gen(function* (_) {
							const preds = byRun.get(runIndex) ?? [];

							const dayOffsetPairs = yield* Effect.forEach(preds, (p) =>
								daysFromToday(DateTime.unsafeFromDate(p.occursOn)).pipe(
									Effect.map((dayOffset) => ({
										dayOffset: Math.round(dayOffset),
										value: p.value,
									})),
								),
							);

							const balanceSeries: number[] = dayOffsetPairs
								.filter((e) => e.dayOffset >= 0 && e.dayOffset < runLength)
								.reduce((acc, { dayOffset, value }) => {
									acc[dayOffset] += value;
									return acc;
								}, Array(runLength).fill(0));

							for (let i = 1; i < balanceSeries.length; i++) {
								balanceSeries[i] += balanceSeries[i - 1];
							}

							return balanceSeries;
						}),
				),
	},
) {}

export class PredictionsService extends Effect.Service<PredictionsService>()(
	"services/PredictionsService",
	{
		dependencies: [
			GeneratePredictionsFn.Default,
			ComputeBalanceForRunFn.Default,
			DefaultSimulationConfig.Default,
			GroupPredictionsByRunIndexFn.Default,
		],
		effect: Effect.gen(function* () {
			const defaultConfig = yield* DefaultSimulationConfig;
			const generatePredictions = yield* GeneratePredictionsFn;
			const groupByRunIndex = yield* GroupPredictionsByRunIndexFn;
			const computeBalance = yield* ComputeBalanceForRunFn;

			const generate = Effect.fn("PredictionsService.generate")(function* (
				events: CashEvent[],
				opts: SimulationOptions,
			) {
				const RUN_COUNT = opts.runCount ?? defaultConfig.runCount;
				const RUN_LENGTH = opts.runLength ?? defaultConfig.runLength;
				const VALUE_VARIANCE =
					opts.valueVariancePct ?? defaultConfig.valueVariancePct;
				const DATE_VARIANCE =
					opts.dateVarianceDays ?? defaultConfig.dateVarianceDays;

				const predictions = yield* generatePredictions({
					events,
					dateVarianceDays: DATE_VARIANCE,
					runCount: RUN_COUNT,
					valueVariancePct: VALUE_VARIANCE,
				});

				const byRun = groupByRunIndex(predictions);

				const balanceSeriesList = yield* computeBalance({
					runCount: RUN_COUNT,
					runLength: RUN_LENGTH,
					byRun,
				});

				const runs: SimulationRun[] = Array.from(
					{ length: RUN_COUNT },
					(_, i) =>
						SimulationRunSchema.make({
							runIndex: i,
							predictions: byRun.get(i) ?? [],
							balanceSeries: balanceSeriesList[i],
						}),
				);

				return {
					runs,
					runCount: RUN_COUNT,
					runLength: RUN_LENGTH,
				};
			});

			return { generate } as const;
		}),
	},
) {}
