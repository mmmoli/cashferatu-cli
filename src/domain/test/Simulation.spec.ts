import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { TestContext } from "effect/TestContext";
import { CashEvent } from "../Cash-Event.js";
import {
	DefaultSimulationConfig,
	type PercentileDay,
	PercentileDaySchema,
	type Prediction,
	PredictionSchema,
	SimulationId,
	SimulationOptionsSchema,
	SimulationReportSchema,
	type SimulationRun,
	SimulationRunSchema,
} from "../Simulation.js";

const TestEnvironmentLayer = Layer.mergeAll(
	DefaultSimulationConfig.Default,
	TestContext,
);

describe("Simulation Domain", () => {
	describe("SimulationOptionsSchema", () => {
		it.effect("should decode valid simulation options", () =>
			Effect.gen(function* (_) {
				const validOptions = {
					runCount: 100,
					runLength: 30,
					dateVarianceDays: 5,
					valueVariancePct: 15,
				};

				const result = yield* _(
					Schema.decodeUnknown(SimulationOptionsSchema)(validOptions),
				);

				expect(result.runCount).toBe(100);
				expect(result.runLength).toBe(30);
				expect(result.dateVarianceDays).toBe(5);
				expect(result.valueVariancePct).toBe(15);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle optional fields", () =>
			Effect.gen(function* (_) {
				const partialOptions = {
					runCount: 50,
				};

				const result = yield* _(
					Schema.decodeUnknown(SimulationOptionsSchema)(partialOptions),
				);

				expect(result.runCount).toBe(50);
				expect(result.runLength).toBeUndefined();
				expect(result.dateVarianceDays).toBeUndefined();
				expect(result.valueVariancePct).toBeUndefined();
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle empty object", () =>
			Effect.gen(function* (_) {
				const emptyOptions = {};

				const result = yield* _(
					Schema.decodeUnknown(SimulationOptionsSchema)(emptyOptions),
				);

				expect(result.runCount).toBeUndefined();
				expect(result.runLength).toBeUndefined();
				expect(result.dateVarianceDays).toBeUndefined();
				expect(result.valueVariancePct).toBeUndefined();
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should fail with invalid types", () =>
			Effect.gen(function* (_) {
				const invalidOptions = {
					runCount: "not-a-number",
					runLength: null,
				};

				const result = yield* _(
					Schema.decodeUnknown(SimulationOptionsSchema)(invalidOptions).pipe(
						Effect.flip,
					),
				);

				expect(result).toBeDefined();
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);
	});

	describe("DefaultSimulationConfig", () => {
		it.effect("should provide default configuration", () =>
			Effect.gen(function* (_) {
				const config = yield* _(DefaultSimulationConfig);

				expect(config.runLength).toBe(60);
				expect(config.runCount).toBe(20);
				expect(config.dateVarianceDays).toBe(10);
				expect(config.valueVariancePct).toBe(20);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should always return the same configuration", () =>
			Effect.gen(function* (_) {
				const config1 = yield* _(DefaultSimulationConfig);
				const config2 = yield* _(DefaultSimulationConfig);

				expect(config1).toEqual(config2);
				expect(config1.runLength).toBe(config2.runLength);
				expect(config1.runCount).toBe(config2.runCount);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);
	});

	describe("PredictionSchema", () => {
		it.effect("should decode valid prediction", () =>
			Effect.gen(function* (_) {
				const validPrediction = {
					run: 1,
					occursOn: "2024-01-15T10:00:00.000Z",
					value: 1500.5,
				};

				const result = yield* _(
					Schema.decodeUnknown(PredictionSchema)(validPrediction),
				);

				expect(result.run).toBe(1);
				expect(result.occursOn).toBeInstanceOf(Date);
				expect(result.value).toBe(1500.5);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle negative values", () =>
			Effect.gen(function* (_) {
				const validPrediction = {
					run: 0,
					occursOn: "2024-01-01T00:00:00.000Z",
					value: -500.25,
				};

				const result = yield* _(
					Schema.decodeUnknown(PredictionSchema)(validPrediction),
				);

				expect(result.value).toBe(-500.25);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should fail with invalid data", () =>
			Effect.gen(function* (_) {
				const invalidPrediction = {
					run: "not-a-number",
					occursOn: "invalid-date",
					value: "not-a-number",
				};

				const result = yield* _(
					Schema.decodeUnknown(PredictionSchema)(invalidPrediction).pipe(
						Effect.flip,
					),
				);

				expect(result).toBeDefined();
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);
	});

	describe("SimulationRunSchema", () => {
		it.effect("should decode valid simulation run", () =>
			Effect.gen(function* (_) {
				const validRun = {
					runIndex: 0,
					predictions: [
						{
							run: 0,
							occursOn: "2024-01-15T10:00:00.000Z",
							value: 1000,
						},
						{
							run: 0,
							occursOn: "2024-02-15T10:00:00.000Z",
							value: -500,
						},
					],
					balanceSeries: [10000, 11000, 10500, 10000],
				};

				const result = yield* _(
					Schema.decodeUnknown(SimulationRunSchema)(validRun),
				);

				expect(result.runIndex).toBe(0);
				expect(result.predictions).toHaveLength(2);
				expect(result.balanceSeries).toEqual([10000, 11000, 10500, 10000]);
				expect(result.predictions[0].value).toBe(1000);
				expect(result.predictions[1].value).toBe(-500);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle empty predictions and balances", () =>
			Effect.gen(function* (_) {
				const validRun = {
					runIndex: 1,
					predictions: [],
					balanceSeries: [],
				};

				const result = yield* _(
					Schema.decodeUnknown(SimulationRunSchema)(validRun),
				);

				expect(result.runIndex).toBe(1);
				expect(result.predictions).toHaveLength(0);
				expect(result.balanceSeries).toHaveLength(0);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);
	});

	describe("PercentileDaySchema", () => {
		it.effect("should decode valid percentile day", () =>
			Effect.gen(function* (_) {
				const validPercentileDay = {
					day: 15,
					p10: 8500.5,
					p25: 9000.25,
					p50: 9500.0,
					p75: 10000.75,
					p90: 10500.9,
				};

				const result = yield* _(
					Schema.decodeUnknown(PercentileDaySchema)(validPercentileDay),
				);

				expect(result.day).toBe(15);
				expect(result.p10).toBe(8500.5);
				expect(result.p25).toBe(9000.25);
				expect(result.p50).toBe(9500.0);
				expect(result.p75).toBe(10000.75);
				expect(result.p90).toBe(10500.9);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle negative percentile values", () =>
			Effect.gen(function* (_) {
				const validPercentileDay = {
					day: 30,
					p10: -1000,
					p25: -500,
					p50: 0,
					p75: 500,
					p90: 1000,
				};

				const result = yield* _(
					Schema.decodeUnknown(PercentileDaySchema)(validPercentileDay),
				);

				expect(result.p10).toBe(-1000);
				expect(result.p25).toBe(-500);
				expect(result.p50).toBe(0);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);
	});

	describe("SimulationId", () => {
		it.effect("should create branded string", () =>
			Effect.gen(function* (_) {
				const id = "simulation-123";
				const result = yield* _(Schema.decodeUnknown(SimulationId)(id));

				expect(result).toBe(id);
				expect(typeof result).toBe("string");
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should fail with non-string values", () =>
			Effect.gen(function* (_) {
				const invalidId = 123;
				const result = yield* _(
					Schema.decodeUnknown(SimulationId)(invalidId).pipe(Effect.flip),
				);

				expect(result).toBeDefined();
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);
	});

	describe("SimulationReportSchema", () => {
		it.effect("should decode complete simulation report", () =>
			Effect.gen(function* (_) {
				const validReport = {
					id: "simulation-report-001",
					meta: {
						runCount: 20,
						runLength: 60,
						runDate: "2024-01-15T10:00:00.000Z",
					},
					cashEvents: [
						{
							ID: "EVENT-001",
							label: "Salary",
							value: "5000",
							date: "2024-01-01",
						},
						{
							ID: "EVENT-002",
							label: "Rent",
							value: "-1500",
							date: "2024-01-01",
						},
					],
					forecast: [
						{
							day: 0,
							p10: 8000,
							p25: 8500,
							p50: 9000,
							p75: 9500,
							p90: 10000,
						},
						{
							day: 1,
							p10: 7900,
							p25: 8400,
							p50: 8900,
							p75: 9400,
							p90: 9900,
						},
					],
					runs: [
						{
							runIndex: 0,
							predictions: [
								{
									run: 0,
									occursOn: "2024-01-01T00:00:00.000Z",
									value: 5000,
								},
							],
							balanceSeries: [10000, 15000, 13500],
						},
						{
							runIndex: 1,
							predictions: [
								{
									run: 1,
									occursOn: "2024-01-02T00:00:00.000Z",
									value: 4900,
								},
							],
							balanceSeries: [10000, 14900, 13400],
						},
					],
				};

				const result = yield* _(
					Schema.decodeUnknown(SimulationReportSchema)(validReport),
				);

				expect(result.id).toBe("simulation-report-001");
				expect(result.meta.runCount).toBe(20);
				expect(result.meta.runLength).toBe(60);
				expect(result.meta.runDate).toBeDefined();
				expect(result.cashEvents).toHaveLength(2);
				expect(result.forecast).toHaveLength(2);
				expect(result.runs).toHaveLength(2);

				// Verify cash events are properly decoded
				expect(result.cashEvents[0]).toBeInstanceOf(CashEvent);
				expect(result.cashEvents[0].value).toBe(5000);
				expect(result.cashEvents[1].value).toBe(-1500);

				// Verify forecast structure
				expect(result.forecast[0].day).toBe(0);
				expect(result.forecast[0].p50).toBe(9000);

				// Verify runs structure
				expect(result.runs[0].runIndex).toBe(0);
				expect(result.runs[0].predictions[0].value).toBe(5000);
				expect(result.runs[0].balanceSeries).toEqual([10000, 15000, 13500]);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle minimal report", () =>
			Effect.gen(function* (_) {
				const minimalReport = {
					id: "minimal-report",
					meta: {
						runCount: 1,
						runLength: 1,
						runDate: "2024-01-01T00:00:00.000Z",
					},
					cashEvents: [],
					forecast: [],
					runs: [],
				};

				const result = yield* _(
					Schema.decodeUnknown(SimulationReportSchema)(minimalReport),
				);

				expect(result.id).toBe("minimal-report");
				expect(result.cashEvents).toHaveLength(0);
				expect(result.forecast).toHaveLength(0);
				expect(result.runs).toHaveLength(0);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should fail with missing required fields", () =>
			Effect.gen(function* (_) {
				const invalidReport = {
					id: "invalid-report",
					meta: {
						runCount: 10,
						// missing runLength and runDate
					},
					// missing cashEvents, forecast, runs
				};

				const result = yield* _(
					Schema.decodeUnknown(SimulationReportSchema)(invalidReport).pipe(
						Effect.flip,
					),
				);

				expect(result).toBeDefined();
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should fail with invalid cash event in report", () =>
			Effect.gen(function* (_) {
				const reportWithInvalidCashEvent = {
					id: "report-with-invalid-event",
					meta: {
						runCount: 1,
						runLength: 1,
						runDate: "2024-01-01T00:00:00.000Z",
					},
					cashEvents: [
						{
							ID: "", // invalid empty ID
							label: "Invalid Event",
							value: "100",
							date: "2024-01-01",
						},
					],
					forecast: [],
					runs: [],
				};

				const result = yield* _(
					Schema.decodeUnknown(SimulationReportSchema)(
						reportWithInvalidCashEvent,
					).pipe(Effect.flip),
				);

				expect(result).toBeDefined();
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);
	});

	describe("Type consistency", () => {
		it.effect("should maintain type relationships", () =>
			Effect.gen(function* (_) {
				// Test that the types work together as expected
				const prediction: Prediction = {
					run: 1,
					occursOn: new Date("2024-01-01"),
					value: 1000,
				};

				const simulationRun: SimulationRun = {
					runIndex: 1,
					predictions: [prediction],
					balanceSeries: [10000, 11000],
				};

				const percentileDay: PercentileDay = {
					day: 1,
					p10: 9000,
					p25: 9500,
					p50: 10000,
					p75: 10500,
					p90: 11000,
				};

				const cashEvent = new CashEvent({
					ID: "TEST-EVENT",
					label: "Test",
					value: 1000,
					date: new Date("2024-01-01"),
				});

				// These should all compile and work together
				expect(prediction.run).toBe(simulationRun.runIndex);
				expect(simulationRun.predictions[0]).toEqual(prediction);
				expect(percentileDay.p50).toBe(10000);
				expect(cashEvent.value).toBe(1000);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);
	});
});
