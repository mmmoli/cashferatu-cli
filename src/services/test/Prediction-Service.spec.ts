import { describe, expect, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Random from "effect/Random";
import { TestContext } from "effect/TestContext";
import { CashEvent } from "../../domain/Cash-Event.js";
import {
	DefaultSimulationConfig,
	type SimulationOptions,
} from "../../domain/Simulation.js";
import {
	ComputeBalanceForRunFn,
	GeneratePredictionsFn,
	GroupPredictionsByRunIndexFn,
	PredictionsService,
} from "../Prediction-Service.js";

// Helper function to create a CashEvent
const createCashEvent = (
	id: string,
	label: string,
	value: number,
	date: Date,
): CashEvent => {
	const normalizedDate = new Date(date);
	normalizedDate.setHours(0, 0, 0, 0);
	return new CashEvent({
		ID: id,
		label,
		value,
		date: normalizedDate,
	});
};

// Helper to create future date relative to test environment's "today"
const createFutureDate = (daysFromNow: number): Effect.Effect<Date> =>
	Effect.gen(function* () {
		const today = yield* DateTime.nowAsDate;
		const futureDate = new Date(
			today.getTime() + daysFromNow * 24 * 60 * 60 * 1000,
		);
		futureDate.setHours(0, 0, 0, 0);
		return futureDate;
	});

const TestEnvironmentLayer = Layer.mergeAll(
	DefaultSimulationConfig.Default,
	GeneratePredictionsFn.Default,
	GroupPredictionsByRunIndexFn.Default,
	ComputeBalanceForRunFn.Default,
	PredictionsService.Default,
	TestContext,
);

describe("Prediction Service", () => {
	describe("GeneratePredictionsFn", () => {
		it.effect("should generate predictions for future events only", () =>
			Effect.gen(function* (_) {
				const generatePredictions = yield* _(GeneratePredictionsFn);
				const today = yield* DateTime.nowAsDate;
				const pastDate = new Date(today.getTime() - 24 * 60 * 60 * 1000); // yesterday
				const futureDate = yield* createFutureDate(5);

				const events = [
					createCashEvent("past", "Past Event", 100, pastDate),
					createCashEvent("future", "Future Event", 200, futureDate),
				];

				const predictions = yield* _(
					generatePredictions({
						events,
						dateVarianceDays: 0,
						runCount: 2,
						valueVariancePct: 0,
					}),
				);

				// Should only generate predictions for future event
				expect(predictions).toHaveLength(2); // 2 runs for 1 future event
				expect(predictions.every((p) => p.value === 200)).toBe(true);
			}).pipe(
				Effect.withRandom(Random.make("test-seed")),
				Effect.provide(TestEnvironmentLayer),
			),
		);

		it.effect("should generate correct number of predictions per event", () =>
			Effect.gen(function* (_) {
				const generatePredictions = yield* _(GeneratePredictionsFn);
				const futureDate1 = yield* createFutureDate(1);
				const futureDate2 = yield* createFutureDate(2);
				const events = [
					createCashEvent("1", "Event 1", 100, futureDate1),
					createCashEvent("2", "Event 2", 200, futureDate2),
				];

				const runCount = 3;
				const predictions = yield* _(
					generatePredictions({
						events,
						dateVarianceDays: 0,
						runCount,
						valueVariancePct: 0,
					}),
				);

				expect(predictions).toHaveLength(6); // 2 events × 3 runs

				// Check run indices are correct
				const runIndices = predictions.map((p) => p.run);
				expect(runIndices.sort()).toEqual([0, 0, 1, 1, 2, 2]);
			}).pipe(
				Effect.withRandom(Random.make("test-seed")),
				Effect.provide(TestEnvironmentLayer),
			),
		);

		it.effect("should apply value variance when specified", () =>
			Effect.gen(function* (_) {
				const generatePredictions = yield* _(GeneratePredictionsFn);
				const futureDate = yield* createFutureDate(5);
				const events = [createCashEvent("1", "Event", 1000, futureDate)];

				const predictions = yield* _(
					generatePredictions({
						events,
						dateVarianceDays: 0,
						runCount: 10,
						valueVariancePct: 20, // 20% variance
					}),
				);

				const values = predictions.map((p) => p.value);
				const uniqueValues = new Set(values);

				// With 20% variance and 10 runs, we should get varied values
				expect(uniqueValues.size).toBeGreaterThan(1);

				// All values should be within reasonable bounds (roughly 800-1200)
				expect(values.every((v) => v >= 600 && v <= 1400)).toBe(true);
			}).pipe(
				Effect.withRandom(Random.make("variance-seed")),
				Effect.provide(TestEnvironmentLayer),
			),
		);

		it.effect("should apply date variance when specified", () =>
			Effect.gen(function* (_) {
				const generatePredictions = yield* _(GeneratePredictionsFn);
				const targetDate = yield* createFutureDate(10);
				const events = [createCashEvent("1", "Event", 1000, targetDate)];

				const predictions = yield* _(
					generatePredictions({
						events,
						dateVarianceDays: 5, // 5 day variance
						runCount: 10,
						valueVariancePct: 0,
					}),
				);

				const dates = predictions.map((p) => p.occursOn.getTime());
				const uniqueDates = new Set(dates);

				// With date variance, we should get varied dates
				expect(uniqueDates.size).toBeGreaterThan(1);
			}).pipe(
				Effect.withRandom(Random.make("date-variance-seed")),
				Effect.provide(TestEnvironmentLayer),
			),
		);
	});

	describe("GroupPredictionsByRunIndexFn", () => {
		it.effect("should group predictions by run index", () =>
			Effect.gen(function* (_) {
				const groupByRunIndex = yield* _(GroupPredictionsByRunIndexFn);

				const predictions = [
					{ run: 0, occursOn: new Date(), value: 100 },
					{ run: 1, occursOn: new Date(), value: 200 },
					{ run: 0, occursOn: new Date(), value: 300 },
					{ run: 2, occursOn: new Date(), value: 400 },
					{ run: 1, occursOn: new Date(), value: 500 },
				];

				const grouped = groupByRunIndex(predictions);

				expect(grouped.size).toBe(3);
				expect(grouped.get(0)).toHaveLength(2);
				expect(grouped.get(1)).toHaveLength(2);
				expect(grouped.get(2)).toHaveLength(1);

				expect(grouped.get(0)?.[0].value).toBe(100);
				expect(grouped.get(0)?.[1].value).toBe(300);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle empty predictions array", () =>
			Effect.gen(function* (_) {
				const groupByRunIndex = yield* _(GroupPredictionsByRunIndexFn);
				const grouped = groupByRunIndex([]);

				expect(grouped.size).toBe(0);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);
	});

	describe("ComputeBalanceForRunFn", () => {
		it.effect("should compute cumulative balance series", () =>
			Effect.gen(function* (_) {
				const computeBalance = yield* _(ComputeBalanceForRunFn);
				const today = yield* DateTime.nowAsDate;

				const predictions = [
					{ run: 0, occursOn: today, value: 100 }, // day 0
					{
						run: 0,
						occursOn: new Date(today.getTime() + 24 * 60 * 60 * 1000),
						value: 50,
					}, // day 1
				];

				const byRun = new Map();
				byRun.set(0, predictions);

				const balanceSeriesList = yield* _(
					computeBalance({
						runCount: 1,
						runLength: 5,
						byRun,
					}),
				);

				expect(balanceSeriesList).toHaveLength(1);
				expect(balanceSeriesList[0]).toEqual([100, 150, 150, 150, 150]);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle predictions outside run length", () =>
			Effect.gen(function* (_) {
				const computeBalance = yield* _(ComputeBalanceForRunFn);
				const today = yield* DateTime.nowAsDate;

				const predictions = [
					{ run: 0, occursOn: today, value: 100 }, // day 0 - included
					{
						run: 0,
						occursOn: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000),
						value: 200,
					}, // day 10 - excluded
				];

				const byRun = new Map();
				byRun.set(0, predictions);

				const balanceSeriesList = yield* _(
					computeBalance({
						runCount: 1,
						runLength: 5,
						byRun,
					}),
				);

				// Should only include the first prediction (day 0), second is outside runLength
				expect(balanceSeriesList[0]).toEqual([100, 100, 100, 100, 100]);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle multiple runs", () =>
			Effect.gen(function* (_) {
				const computeBalance = yield* _(ComputeBalanceForRunFn);
				const today = yield* DateTime.nowAsDate;

				const run0Predictions = [{ run: 0, occursOn: today, value: 100 }];
				const run1Predictions = [{ run: 1, occursOn: today, value: 200 }];

				const byRun = new Map();
				byRun.set(0, run0Predictions);
				byRun.set(1, run1Predictions);

				const balanceSeriesList = yield* _(
					computeBalance({
						runCount: 2,
						runLength: 3,
						byRun,
					}),
				);

				expect(balanceSeriesList).toHaveLength(2);
				expect(balanceSeriesList[0]).toEqual([100, 100, 100]);
				expect(balanceSeriesList[1]).toEqual([200, 200, 200]);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);
	});

	describe("PredictionsService Integration", () => {
		it.effect("should generate complete simulation with default options", () =>
			Effect.gen(function* (_) {
				const service = yield* _(PredictionsService);
				const defaultConfig = yield* _(DefaultSimulationConfig);

				const futureDate1 = yield* createFutureDate(1);
				const futureDate2 = yield* createFutureDate(5);
				const events = [
					createCashEvent("1", "Salary", 5000, futureDate1),
					createCashEvent("2", "Rent", -2000, futureDate2),
				];

				const result = yield* _(service.generate(events, {}));

				expect(result.runCount).toBe(defaultConfig.runCount);
				expect(result.runLength).toBe(defaultConfig.runLength);
				expect(result.runs).toHaveLength(defaultConfig.runCount);

				// Each run should have correct structure
				result.runs.forEach((run) => {
					expect(run.balanceSeries).toHaveLength(defaultConfig.runLength);
					expect(typeof run.runIndex).toBe("number");
					expect(Array.isArray(run.predictions)).toBe(true);
				});
			}).pipe(
				Effect.withRandom(Random.make("integration-seed")),
				Effect.provide(TestEnvironmentLayer),
			),
		);

		it.effect("should respect custom simulation options", () =>
			Effect.gen(function* (_) {
				const service = yield* _(PredictionsService);

				const futureDate = yield* createFutureDate(2);
				const events = [createCashEvent("1", "Payment", 1000, futureDate)];

				const customOptions: SimulationOptions = {
					runCount: 5,
					runLength: 10,
					dateVarianceDays: 2,
					valueVariancePct: 15,
				};

				const result = yield* _(service.generate(events, customOptions));

				expect(result.runCount).toBe(5);
				expect(result.runLength).toBe(10);
				expect(result.runs).toHaveLength(5);
				expect(result.runs[0].balanceSeries).toHaveLength(10);
			}).pipe(
				Effect.withRandom(Random.make("custom-options-seed")),
				Effect.provide(TestEnvironmentLayer),
			),
		);

		it.effect("should handle empty events gracefully", () =>
			Effect.gen(function* (_) {
				const service = yield* _(PredictionsService);

				const result = yield* _(
					service.generate([], { runCount: 3, runLength: 5 }),
				);

				expect(result.runs).toHaveLength(3);
				result.runs.forEach((run) => {
					expect(run.balanceSeries).toEqual([0, 0, 0, 0, 0]);
					expect(run.predictions).toHaveLength(0);
				});
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should produce deterministic results with same seed", () =>
			Effect.gen(function* (_) {
				const service = yield* _(PredictionsService);

				const futureDate = yield* createFutureDate(3);
				const events = [createCashEvent("1", "Test", 1000, futureDate)];

				const options: SimulationOptions = {
					runCount: 3,
					runLength: 5,
					dateVarianceDays: 2,
					valueVariancePct: 10,
				};

				const result1 = yield* _(service.generate(events, options));
				const result2 = yield* _(service.generate(events, options));

				// Results should be identical with same seed
				expect(result1.runs[0].balanceSeries).toEqual(
					result2.runs[0].balanceSeries,
				);
				expect(result1.runs[1].balanceSeries).toEqual(
					result2.runs[1].balanceSeries,
				);
				expect(result1.runs[2].balanceSeries).toEqual(
					result2.runs[2].balanceSeries,
				);
			}).pipe(
				Effect.withRandom(Random.make("deterministic-seed")),
				Effect.provide(TestEnvironmentLayer),
			),
		);
	});
});
