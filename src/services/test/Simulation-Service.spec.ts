import { describe, expect, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Random from "effect/Random";
import * as Schema from "effect/Schema";
import { TestContext } from "effect/TestContext";
import {
  type CashEvent,
  CashEventId,
  CashEventSchema,
} from "../../domain/Cash-Event.js";
import {
  DefaultSimulationConfig,
  type SimulationOptions,
} from "../../domain/Simulation.js";
import { GetPercentile, ReduceToPercentiles } from "../Percentiles.js";
import { PredictionsService } from "../Prediction-Service.js";
import { SimulationService } from "../Simulation-Service.js";

// Helper function to create a CashEvent
const createCashEvent = (
  id: string,
  label: string,
  value: number,
  date: Date,
): CashEvent => {
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);
  return Schema.decodeUnknownSync(CashEventSchema)({
    ID: CashEventId.make(id),
    label,
    value,
    date: normalizedDate.toISOString(),
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

// Helper to create past date relative to test environment's "today"
const createPastDate = (daysAgo: number): Effect.Effect<Date> =>
  Effect.gen(function* () {
    const today = yield* DateTime.nowAsDate;
    const pastDate = new Date(today.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    pastDate.setHours(0, 0, 0, 0);
    return pastDate;
  });

// Now, compose the full test environment layer
const TestEnvironmentLayer = Layer.mergeAll(
  DefaultSimulationConfig.Default,
  PredictionsService.Default,
  ReduceToPercentiles.Default,
  GetPercentile.Default,
  SimulationService.Default,
  TestContext,
);

describe("Simulation Service", () => {
  describe("Basic Functionality", () => {
    it.effect("should handle empty events array", () =>
      Effect.gen(function* (_) {
        const service = yield* _(SimulationService);
        const { runLength } = yield* _(DefaultSimulationConfig);
        const events: CashEvent[] = [];
        const RUN_COUNT = 3;
        const opts: SimulationOptions = { runCount: RUN_COUNT };

        const result = yield* _(service.generate(events, opts));

        expect(result.runs).toHaveLength(RUN_COUNT);
        expect(result.runs[0].balanceSeries).toHaveLength(runLength);
        expect(result.runs[0].balanceSeries).toEqual(
          new Array(runLength).fill(0),
        );
        expect(result.cashEvents).toEqual([]);
        expect(result.meta.runCount).toBe(RUN_COUNT);
        expect(result.forecast).toHaveLength(runLength);
      }).pipe(
        Effect.withRandom(Random.make("empty-events-seed")),
        Effect.provide(TestEnvironmentLayer),
      ),
    );

    it.effect("should create simulation report with correct structure", () =>
      Effect.gen(function* (_) {
        const service = yield* _(SimulationService);
        const futureDate = yield* createFutureDate(1);
        const events = [createCashEvent("1", "Salary", 5000, futureDate)];
        const opts: SimulationOptions = { runCount: 2, runLength: 5 };

        const result = yield* _(service.generate(events, opts));

        // Check report structure
        expect(typeof result.id).toBe("string");
        expect(result.id).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
        expect(result.cashEvents).toEqual(events);
        expect(result.runs).toHaveLength(2);
        expect(result.forecast).toHaveLength(5);

        // Check meta information
        expect(result.meta.runCount).toBe(2);
        expect(result.meta.runLength).toBe(5);
        expect(result.meta.runDate).toBeDefined();

        // Check forecast structure
        result.forecast.forEach((day, index) => {
          expect(day.day).toBe(index);
          expect(typeof day.p10).toBe("number");
          expect(typeof day.p25).toBe("number");
          expect(typeof day.p50).toBe("number");
          expect(typeof day.p75).toBe("number");
          expect(typeof day.p90).toBe("number");
        });
      }).pipe(
        Effect.withRandom(Random.make("structure-seed")),
        Effect.provide(TestEnvironmentLayer),
      ),
    );

    it.effect("should create correct number of runs", () =>
      Effect.gen(function* (_) {
        const service = yield* _(SimulationService);
        const futureDate = yield* createFutureDate(1);
        const events = [createCashEvent("1", "Salary", 5000, futureDate)];
        const opts: SimulationOptions = { runCount: 5, runLength: 60 };

        const result = yield* _(service.generate(events, opts));

        expect(result.runs).toHaveLength(5);
        expect(
          result.runs.every((run) => run.balanceSeries.length === 60),
        ).toBe(true);
        expect(result.meta.runCount).toBe(5);
        expect(result.meta.runLength).toBe(60);
      }).pipe(
        Effect.withRandom(Random.make("run-count-seed")),
        Effect.provide(TestEnvironmentLayer),
      ),
    );
  });

  describe("Event Processing", () => {
    it.effect("should only process future events", () =>
      Effect.gen(function* (_) {
        const service = yield* _(SimulationService);
        const pastEvent = createCashEvent(
          "past",
          "Past Salary",
          3000,
          yield* createPastDate(5),
        );
        const futureEvent = createCashEvent(
          "future",
          "Future Salary",
          4000,
          yield* createFutureDate(5),
        );

        const events = [pastEvent, futureEvent];
        const opts: SimulationOptions = {
          runCount: 1,
          runLength: 10,
          dateVarianceDays: 0,
          valueVariancePct: 0,
        };

        const result = yield* _(service.generate(events, opts));

        // Should include both events in cashEvents but only process future ones
        expect(result.cashEvents).toHaveLength(2);
        expect(result.runs[0].predictions).toHaveLength(1);
        expect(result.runs[0].predictions[0].value).toBe(4000);
      }).pipe(
        Effect.withRandom(Random.make("future-events-seed")),
        Effect.provide(TestEnvironmentLayer),
      ),
    );

    it.effect("should handle mixed positive and negative cash flows", () =>
      Effect.gen(function* (_) {
        const service = yield* _(SimulationService);
        const income = createCashEvent(
          "income",
          "Salary",
          5000,
          yield* createFutureDate(1),
        );
        const expense = createCashEvent(
          "expense",
          "Rent",
          -2000,
          yield* createFutureDate(2),
        );

        const events = [income, expense];
        const opts: SimulationOptions = {
          runCount: 1,
          runLength: 5,
          dateVarianceDays: 0,
          valueVariancePct: 0,
        };

        const result = yield* _(service.generate(events, opts));

        // Check that both events are processed
        expect(result.runs[0].predictions).toHaveLength(2);

        // Check balance progression (cumulative)
        const balances = result.runs[0].balanceSeries;
        expect(balances[1]).toBe(5000); // Day 1: income
        expect(balances[2]).toBe(3000); // Day 2: income + expense
        expect(balances[3]).toBe(3000); // Day 3: same (cumulative)
      }).pipe(
        Effect.withRandom(Random.make("mixed-flows-seed")),
        Effect.provide(TestEnvironmentLayer),
      ),
    );

    it.effect("should handle multiple events on same day", () =>
      Effect.gen(function* (_) {
        const service = yield* _(SimulationService);
        const sameDate = yield* createFutureDate(3);

        const event1 = createCashEvent("1", "Salary", 3000, sameDate);
        const event2 = createCashEvent("2", "Bonus", 1000, sameDate);
        const event3 = createCashEvent("3", "Expense", -500, sameDate);

        const events = [event1, event2, event3];
        const opts: SimulationOptions = {
          runCount: 1,
          runLength: 10,
          dateVarianceDays: 0,
          valueVariancePct: 0,
        };

        const result = yield* _(service.generate(events, opts));

        // All events should be on day 3 (0-indexed from today)
        const balances = result.runs[0].balanceSeries;
        expect(balances[2]).toBe(0); // Day 2: nothing yet
        expect(balances[3]).toBe(3500); // Day 3: 3000 + 1000 - 500
        expect(balances[4]).toBe(3500); // Day 4: same (cumulative)
      }).pipe(
        Effect.withRandom(Random.make("same-day-seed")),
        Effect.provide(TestEnvironmentLayer),
      ),
    );
  });

  describe("Variance and Randomness", () => {
    it.effect("should produce varied results with variance enabled", () =>
      Effect.gen(function* (_) {
        const service = yield* _(SimulationService);
        const events = [
          createCashEvent("1", "Payment 1", 1000, yield* createFutureDate(1)),
          createCashEvent("2", "Payment 2", 2000, yield* createFutureDate(3)),
        ];
        const opts: SimulationOptions = {
          runCount: 10,
          runLength: 5,
          dateVarianceDays: 2,
          valueVariancePct: 15,
        };

        const result = yield* _(service.generate(events, opts));

        // Check that we have variation across runs
        const firstDayBalances = result.runs.map((run) => run.balanceSeries[0]);
        const uniqueFirstDayBalances = new Set(firstDayBalances);

        // With variance enabled, we should see different outcomes
        expect(uniqueFirstDayBalances.size).toBeGreaterThan(1);

        // Check forecast reflects this variance
        const firstDayForecast = result.forecast[0];
        expect(firstDayForecast.p10).toBeLessThan(firstDayForecast.p90);
      }).pipe(
        Effect.withRandom(Random.make("variance-seed")),
        Effect.provide(TestEnvironmentLayer),
      ),
    );

    it.effect("should produce consistent results with no variance", () =>
      Effect.gen(function* (_) {
        const service = yield* _(SimulationService);
        const events = [
          createCashEvent(
            "1",
            "Fixed Payment",
            1000,
            yield* createFutureDate(2),
          ),
        ];
        const opts: SimulationOptions = {
          runCount: 5,
          runLength: 5,
          dateVarianceDays: 0,
          valueVariancePct: 0,
        };

        const result = yield* _(service.generate(events, opts));

        // All runs should be identical
        const firstRunBalance = result.runs[0].balanceSeries;
        result.runs.forEach((run) => {
          expect(run.balanceSeries).toEqual(firstRunBalance);
        });

        // Forecast percentiles should be equal when no variance
        result.forecast.forEach((day) => {
          expect(day.p10).toBe(day.p50);
          expect(day.p50).toBe(day.p90);
        });
      }).pipe(
        Effect.withRandom(Random.make("no-variance-seed")),
        Effect.provide(TestEnvironmentLayer),
      ),
    );

    it.effect("should be deterministic with same seed", () =>
      Effect.gen(function* (_) {
        const service = yield* _(SimulationService);
        const events = [
          createCashEvent("1", "Test Event", 1500, yield* createFutureDate(3)),
        ];
        const opts: SimulationOptions = {
          runCount: 3,
          runLength: 5,
          dateVarianceDays: 3,
          valueVariancePct: 20,
        };

        const result1 = yield* _(service.generate(events, opts, "my-seed"));
        const result2 = yield* _(service.generate(events, opts, "my-seed"));

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
        expect(result1.forecast).toEqual(result2.forecast);
      }).pipe(
        Effect.withRandom(Random.make("deterministic-seed")),
        Effect.provide(TestEnvironmentLayer),
      ),
    );
  });

  describe("Configuration Options", () => {
    it.effect("should use default configuration when no options provided", () =>
      Effect.gen(function* (_) {
        const service = yield* _(SimulationService);
        const defaultConfig = yield* _(DefaultSimulationConfig);
        const events = [
          createCashEvent("1", "Test", 1000, yield* createFutureDate(5)),
        ];

        const result = yield* _(service.generate(events, {}));

        expect(result.meta.runCount).toBe(defaultConfig.runCount);
        expect(result.meta.runLength).toBe(defaultConfig.runLength);
        expect(result.runs).toHaveLength(defaultConfig.runCount);
        expect(result.runs[0].balanceSeries).toHaveLength(
          defaultConfig.runLength,
        );
      }).pipe(
        Effect.withRandom(Random.make("default-config-seed")),
        Effect.provide(TestEnvironmentLayer),
      ),
    );

    it.effect("should override defaults with provided options", () =>
      Effect.gen(function* (_) {
        const service = yield* _(SimulationService);
        const events = [
          createCashEvent("1", "Test", 1000, yield* createFutureDate(2)),
        ];

        const customOpts: SimulationOptions = {
          runCount: 7,
          runLength: 15,
          dateVarianceDays: 5,
          valueVariancePct: 25,
        };

        const result = yield* _(service.generate(events, customOpts));

        expect(result.meta.runCount).toBe(7);
        expect(result.meta.runLength).toBe(15);
        expect(result.runs).toHaveLength(7);
        expect(result.runs[0].balanceSeries).toHaveLength(15);
        expect(result.forecast).toHaveLength(15);
      }).pipe(
        Effect.withRandom(Random.make("custom-options-seed")),
        Effect.provide(TestEnvironmentLayer),
      ),
    );

    it.effect("should handle partial option overrides", () =>
      Effect.gen(function* (_) {
        const service = yield* _(SimulationService);
        const defaultConfig = yield* _(DefaultSimulationConfig);
        const events = [
          createCashEvent("1", "Test", 1000, yield* createFutureDate(1)),
        ];

        // Only override runCount, leaving other defaults
        const partialOpts: SimulationOptions = {
          runCount: 3,
        };

        const result = yield* _(service.generate(events, partialOpts));

        expect(result.meta.runCount).toBe(3); // overridden
        expect(result.meta.runLength).toBe(defaultConfig.runLength); // default
        expect(result.runs).toHaveLength(3);
        expect(result.runs[0].balanceSeries).toHaveLength(
          defaultConfig.runLength,
        );
      }).pipe(
        Effect.withRandom(Random.make("partial-options-seed")),
        Effect.provide(TestEnvironmentLayer),
      ),
    );
  });

  describe("Forecast Generation", () => {
    it.effect("should generate forecast covering full run length", () =>
      Effect.gen(function* (_) {
        const service = yield* _(SimulationService);
        const events = [
          createCashEvent("1", "Income", 2000, yield* createFutureDate(10)),
        ];
        const runLength = 30;
        const opts: SimulationOptions = { runLength, runCount: 5 };

        const result = yield* _(service.generate(events, opts));

        expect(result.forecast).toHaveLength(runLength);

        // Each forecast day should have proper day index
        result.forecast.forEach((day, index) => {
          expect(day.day).toBe(index);
        });
      }).pipe(
        Effect.withRandom(Random.make("forecast-length-seed")),
        Effect.provide(TestEnvironmentLayer),
      ),
    );

    it.effect("should show increasing balances for positive cash flow", () =>
      Effect.gen(function* (_) {
        const service = yield* _(SimulationService);
        const events = [
          createCashEvent(
            "1",
            "Weekly Income",
            1000,
            yield* createFutureDate(1),
          ),
          createCashEvent(
            "2",
            "Weekly Income",
            1000,
            yield* createFutureDate(8),
          ),
          createCashEvent(
            "3",
            "Weekly Income",
            1000,
            yield* createFutureDate(15),
          ),
        ];

        const opts: SimulationOptions = {
          runCount: 1,
          runLength: 20,
          dateVarianceDays: 0,
          valueVariancePct: 0,
        };

        const result = yield* _(service.generate(events, opts));

        // Balance should increase over time with regular income
        const forecast = result.forecast;
        expect(forecast[8].p50).toBeGreaterThan(forecast[1].p50);
        expect(forecast[15].p50).toBeGreaterThan(forecast[8].p50);
        // Day 19 should equal day 15 since there are no more events after day 15
        expect(forecast[19].p50).toBe(forecast[15].p50);
      }).pipe(
        Effect.withRandom(Random.make("increasing-balance-seed")),
        Effect.provide(TestEnvironmentLayer),
      ),
    );

    it.effect("should show realistic percentile spreads with variance", () =>
      Effect.gen(function* (_) {
        const service = yield* _(SimulationService);
        const events = [
          createCashEvent(
            "1",
            "Variable Income",
            3000,
            yield* createFutureDate(5),
          ),
        ];

        const opts: SimulationOptions = {
          runCount: 100, // More runs for better percentile accuracy
          runLength: 10,
          dateVarianceDays: 3,
          valueVariancePct: 30,
        };

        const result = yield* _(service.generate(events, opts));

        // Check that percentiles are properly ordered
        result.forecast.forEach((day) => {
          expect(day.p10).toBeLessThanOrEqual(day.p25);
          expect(day.p25).toBeLessThanOrEqual(day.p50);
          expect(day.p50).toBeLessThanOrEqual(day.p75);
          expect(day.p75).toBeLessThanOrEqual(day.p90);
        });

        // With high variance, there should be meaningful spread
        const dayWithEvent = result.forecast[5];
        expect(dayWithEvent.p90 - dayWithEvent.p10).toBeGreaterThan(1000);
      }).pipe(
        Effect.withRandom(Random.make("percentile-spread-seed")),
        Effect.provide(TestEnvironmentLayer),
      ),
    );
  });

  describe("Edge Cases", () => {
    it.effect("should handle single run simulation", () =>
      Effect.gen(function* (_) {
        const service = yield* _(SimulationService);
        const events = [
          createCashEvent(
            "1",
            "One Time Payment",
            5000,
            yield* createFutureDate(3),
          ),
        ];
        const opts: SimulationOptions = { runCount: 1, runLength: 10 };

        const result = yield* _(service.generate(events, opts));

        expect(result.runs).toHaveLength(1);
        expect(result.meta.runCount).toBe(1);

        // With single run, all percentiles should be equal
        result.forecast.forEach((day) => {
          expect(day.p10).toBe(day.p50);
          expect(day.p50).toBe(day.p90);
        });
      }).pipe(
        Effect.withRandom(Random.make("single-run-seed")),
        Effect.provide(TestEnvironmentLayer),
      ),
    );

    it.effect("should handle very short run length", () =>
      Effect.gen(function* (_) {
        const service = yield* _(SimulationService);
        const events = [
          createCashEvent(
            "1",
            "Quick Payment",
            1000,
            yield* createFutureDate(1),
          ),
        ];
        const opts: SimulationOptions = { runCount: 3, runLength: 1 };

        const result = yield* _(service.generate(events, opts));

        expect(result.runs).toHaveLength(3);
        expect(result.runs[0].balanceSeries).toHaveLength(1);
        expect(result.forecast).toHaveLength(1);
        expect(result.forecast[0].day).toBe(0);
      }).pipe(
        Effect.withRandom(Random.make("short-run-seed")),
        Effect.provide(TestEnvironmentLayer),
      ),
    );

    it.effect("should handle large numbers correctly", () =>
      Effect.gen(function* (_) {
        const service = yield* _(SimulationService);
        const largeAmount = 1_000_000;
        const events = [
          createCashEvent(
            "1",
            "Large Payment",
            largeAmount,
            yield* createFutureDate(1),
          ),
        ];
        const opts: SimulationOptions = {
          runCount: 2,
          runLength: 3,
          dateVarianceDays: 0,
          valueVariancePct: 0,
        };

        const result = yield* _(service.generate(events, opts));

        expect(result.runs[0].balanceSeries[1]).toBe(largeAmount);
        expect(result.forecast[1].p50).toBe(largeAmount);
      }).pipe(
        Effect.withRandom(Random.make("large-numbers-seed")),
        Effect.provide(TestEnvironmentLayer),
      ),
    );

    it.effect("should preserve event metadata correctly", () =>
      Effect.gen(function* (_) {
        const service = yield* _(SimulationService);
        const uniqueEvents = [
          createCashEvent(
            "abc-123",
            "Unique Label 1",
            1500,
            yield* createFutureDate(2),
          ),
          createCashEvent(
            "def-456",
            "Unique Label 2",
            -800,
            yield* createFutureDate(5),
          ),
        ];

        const result = yield* _(
          service.generate(uniqueEvents, { runCount: 1 }),
        );

        expect(result.cashEvents).toHaveLength(2);
        expect(result.cashEvents[0].ID).toBe("abc-123");
        expect(result.cashEvents[0].label).toBe("Unique Label 1");
        expect(result.cashEvents[1].ID).toBe("def-456");
        expect(result.cashEvents[1].label).toBe("Unique Label 2");
      }).pipe(
        Effect.withRandom(Random.make("metadata-seed")),
        Effect.provide(TestEnvironmentLayer),
      ),
    );
  });
});
