import { describe, expect, it } from "@effect/vitest";
import * as E from "effect";
import * as DateTime from "effect/DateTime";
import {
  runSimulation,
  reduceToPercentiles,
  type SimulationOptions,
} from "../src/Simulation.js";
import { CashEvent } from "../src/Parse.js";

// Helper function to create a CashEvent
const createCashEvent = (
  id: string,
  label: string,
  value: number,
  date: Date,
): CashEvent => {
  // Normalize date to start of day to avoid time-based issues
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);
  return new CashEvent({
    ID: id,
    label,
    value,
    date: normalizedDate,
  });
};

// Helper function to get expected value range with variance
const getValueRange = (baseValue: number, variancePct: number = 30) => {
  const variance = (baseValue * variancePct) / 100;
  return {
    min: Math.round(baseValue - variance),
    max: Math.round(baseValue + variance),
  };
};

// Helper function to check if a value is within expected range
const expectValueInRange = (
  actual: number,
  expected: number,
  variancePct: number = 30,
) => {
  const range = getValueRange(expected, variancePct);
  expect(actual).toBeGreaterThanOrEqual(range.min);
  expect(actual).toBeLessThanOrEqual(range.max);
};

describe("Simulation", () => {
  it.effect("should handle empty events array", () =>
    E.Effect.gen(function* (_) {
      const events: CashEvent[] = [];
      const opts: SimulationOptions = { runCount: 3 };
      const result = yield* _(runSimulation(events, opts));
      expect(result).toHaveLength(3);
      expect(result[0]).toHaveLength(30); // Default run length is now 30
      expect(result[0]).toEqual(new Array(30).fill(0));
    }),
  );

  it.effect("should create correct number of runs", () =>
    E.Effect.gen(function* (_) {
      const today = yield* E.DateTime.nowAsDate;
      const events = [createCashEvent("1", "Salary", 5000, today)];
      const opts: SimulationOptions = { runCount: 5, runLength: 60 };

      const result = yield* _(runSimulation(events, opts));

      expect(result).toHaveLength(5);
      expect(result.every((run) => run.length === 60)).toBe(true);
    }),
  );

  it.effect("should correctly place events with no variance", () =>
    E.Effect.gen(function* (_) {
      const today = yield* E.DateTime.nowAsDate;
      const events = [createCashEvent("1", "Payment", 1000, today)];
      const opts: SimulationOptions = {
        runCount: 1,
        dateVarianceDays: 0,
        valueVariancePct: 0,
      };

      const result = yield* _(runSimulation(events, opts));

      // With no variance, should be exact
      expect(result[0][0]).toBe(1000);
    }),
  );

  it.effect("should handle events with variance", () =>
    E.Effect.gen(function* (_) {
      const today = yield* E.DateTime.nowAsDate;
      const events = [
        createCashEvent("1", "Payment 1", 1000, today),
        createCashEvent("2", "Payment 2", 3333, today),
      ];
      const opts: SimulationOptions = {
        runCount: 10,
        runLength: 5,
        dateVarianceDays: 3,
        valueVariancePct: 10,
      };
      const result = yield* _(runSimulation(events, opts));

      // Check that we have variation across runs
      const runsAsFlatStrings = result.map((run) => run.join(","));
      const uniquePatterns = new Set(runsAsFlatStrings);
      expect(uniquePatterns.size).toBeGreaterThan(1);
    }),
  );

  it.effect("should ignore events beyond forecast length", () =>
    E.Effect.gen(function* (_) {
      const futureDate = yield* _(
        DateTime.now.pipe(
          E.Effect.map((t) => DateTime.add(t, { days: 50 })),
          E.Effect.map((t) => DateTime.toDate(t)),
        ),
      );

      const events = [
        createCashEvent("1", "Far Future Payment", 1000, futureDate),
      ];
      const opts: SimulationOptions = { runCount: 1, runLength: 30 };

      const result = yield* _(runSimulation(events, opts));

      // All days should remain 0
      expect(result[0].every((value) => value === 0)).toBe(true);
    }),
  );

  it.effect("should ignore events in the past", () =>
    E.Effect.gen(function* (_) {
      yield* _(DateTime.now.pipe(E.Effect.map((t) => DateTime.toDate(t))));

      const pastDate = yield* _(
        DateTime.now.pipe(
          E.Effect.map((t) => DateTime.subtract(t, { days: 1 })),
          E.Effect.map((t) => DateTime.toDate(t)),
        ),
      );

      const events = [createCashEvent("1", "Past Payment", 1000, pastDate)];
      const opts: SimulationOptions = {
        runCount: 20,
        runLength: 3,
        dateVarianceDays: 3,
      };

      const result = yield* _(runSimulation(events, opts));

      // All days should remain 0
      expect(result[0].every((value) => value === 0)).toBe(true);
    }).pipe(E.Effect.withRandom(E.Random.make("myseed"))),
  );

  it.effect("should accumulate multiple events on the same day", () =>
    E.Effect.gen(function* (_) {
      const today = yield* _(DateTime.nowAsDate);

      const events = [
        createCashEvent("1", "Income", 1000, today),
        createCashEvent("2", "Expense", -500, today),
        createCashEvent("3", "Bonus", 300, today),
      ];
      const opts: SimulationOptions = {
        runCount: 1,
        dateVarianceDays: 0,
        valueVariancePct: 0,
      };

      const total = events.reduce((acc, event) => acc + event.value, 0);

      const result = yield* _(runSimulation(events, opts));

      expect(result[0][0]).toBe(total);
    }),
  );

  it.effect("should create cumulative balances correctly", () =>
    E.Effect.gen(function* (_) {
      const today = yield* _(DateTime.nowAsDate);

      const tomorrow = yield* _(
        DateTime.now.pipe(
          E.Effect.map((dt) => DateTime.add(dt, { days: 1 })),
          E.Effect.map((dt) => DateTime.toDate(dt)),
        ),
      );

      const dayAfter = yield* _(
        DateTime.now.pipe(
          E.Effect.map((dt) => DateTime.add(dt, { days: 2 })),
          E.Effect.map((dt) => DateTime.toDate(dt)),
        ),
      );

      const events = [
        createCashEvent("1", "Day 0", 1000, today),
        createCashEvent("2", "Day 1", 500, tomorrow),
        createCashEvent("3", "Day 2", -200, dayAfter),
      ];
      const opts: SimulationOptions = {
        runCount: 1,
        dateVarianceDays: 0,
        valueVariancePct: 0,
      };

      const result = yield* _(runSimulation(events, opts));

      expect(result[0][0]).toBe(1000); // Day 0: 1000
      expect(result[0][1]).toBe(1500); // Day 1: 1000 + 500
      expect(result[0][2]).toBe(1300); // Day 2: 1500 - 200
      expect(result[0][3]).toBe(1300); // Day 3: no change
    }),
  );

  it.effect("should handle multiple runs with variance", () =>
    E.Effect.gen(function* (_) {
      const today = yield* _(DateTime.nowAsDate);

      const events = [createCashEvent("1", "Payment", 1000, today)];
      const opts: SimulationOptions = {
        runCount: 10,
        dateVarianceDays: 3,
        valueVariancePct: 15,
      };

      const result = yield* _(runSimulation(events, opts));

      const runStrings = result.map((run) => run.join(","));
      const unique = new Set(runStrings);
      expect(unique.size).toBeGreaterThan(1);

      result.flat().forEach((v) => {
        if (v !== 0) {
          expectValueInRange(v, 1000, 15);
        }
      });
    }).pipe(E.Effect.withRandom(E.Random.make("seed-string"))),
  );

  it.effect("should respect runLength parameter", () =>
    E.Effect.gen(function* (_) {
      const today = yield* _(DateTime.nowAsDate);
      const events = [createCashEvent("1", "Payment", 1000, today)];
      const opts: SimulationOptions = {
        runCount: 1,
        runLength: 90,
      };

      const result = yield* _(runSimulation(events, opts));

      expect(result[0]).toHaveLength(90);
    }),
  );

  it("should handle empty runs array", () => {
    const runs: number[][] = [];
    const result = reduceToPercentiles(runs);
    expect(result).toEqual([]);
  });

  it("should handle single run", () => {
    const runs = [[100, 150, 200]];
    const result = reduceToPercentiles(runs);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      day: 0,
      p10: 100,
      p25: 100,
      p50: 100,
      p75: 100,
      p90: 100,
    });
  });

  it("should calculate percentiles correctly for multiple runs", () => {
    const runs = [
      [100, 150, 200],
      [200, 250, 300],
      [300, 350, 400],
      [400, 450, 500],
      [500, 550, 600],
    ];
    const result = reduceToPercentiles(runs);

    expect(result).toHaveLength(3);

    // Day 0: values [100, 200, 300, 400, 500]
    expect(result[0].day).toBe(0);
    expect(result[0].p50).toBe(300); // median
    expect(result[0].p10).toBe(140); // 10th percentile
    expect(result[0].p90).toBe(460); // 90th percentile

    // Day 1: values [150, 250, 350, 450, 550]
    expect(result[1].day).toBe(1);
    expect(result[1].p50).toBe(350); // median

    // Day 2: values [200, 300, 400, 500, 600]
    expect(result[2].day).toBe(2);
    expect(result[2].p50).toBe(400); // median
  });

  it("should handle even number of runs", () => {
    const runs = [
      [100, 200],
      [200, 300],
      [300, 400],
      [400, 500],
    ];
    const result = reduceToPercentiles(runs);

    expect(result).toHaveLength(2);
    expect(result[0].p50).toBe(250); // median of [100, 200, 300, 400]
  });

  it("should handle identical values", () => {
    const runs = [
      [100, 100],
      [100, 100],
      [100, 100],
    ];
    const result = reduceToPercentiles(runs);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      day: 0,
      p10: 100,
      p25: 100,
      p50: 100,
      p75: 100,
      p90: 100,
    });
  });

  it("should handle negative values", () => {
    const runs = [
      [-100, -50],
      [-200, -150],
      [-300, -250],
    ];
    const result = reduceToPercentiles(runs);

    expect(result).toHaveLength(2);
    expect(result[0].p50).toBe(-200); // median of [-300, -200, -100]
    expect(result[1].p50).toBe(-150); // median of [-250, -150, -50]
  });

  it("should maintain day ordering", () => {
    const runs = [
      [1, 2, 3, 4, 5],
      [6, 7, 8, 9, 10],
    ];
    const result = reduceToPercentiles(runs);

    expect(result).toHaveLength(5);
    expect(result.map((r) => r.day)).toEqual([0, 1, 2, 3, 4]);
  });

  it.effect("should work end-to-end with variance", () =>
    E.Effect.gen(function* (_) {
      const today = yield* _(DateTime.nowAsDate);

      const nextWeek = yield* _(
        DateTime.now.pipe(
          E.Effect.map((dt) => DateTime.add(dt, { days: 7 })),
          E.Effect.map((dt) => DateTime.toDate(dt)),
        ),
      );

      const events = [
        createCashEvent("1", "Initial Balance", 10000, today),
        createCashEvent("2", "Rent", -2000, nextWeek),
      ];
      const opts: SimulationOptions = {
        runCount: 1000, // Increase run count for better statistical variance
        runLength: 20,
        dateVarianceDays: 2, // Allow events to move ±2 days
        valueVariancePct: 10, // Allow 10% value variance
      };

      const runs = yield* _(runSimulation(events, opts));
      const percentiles = reduceToPercentiles(runs);

      // Should have 20 days of data
      expect(percentiles).toHaveLength(20);

      // Test that variance is working by checking spread between percentiles
      // The initial balance should show variance across the first few days
      let totalVarianceFound = false;
      for (let day = 0; day < 5; day++) {
        const dayData = percentiles[day];
        if (dayData.p90 > dayData.p10) {
          totalVarianceFound = true;
          break;
        }
      }
      expect(totalVarianceFound).toBe(true);

      // Test that the total cash flow is preserved despite variance
      // Sum all events to get expected total impact
      const totalEventValue = events.reduce(
        (sum, event) => sum + event.value,
        0,
      );

      // Check that the final day's median is roughly what we expect
      // (accounting for variance but ensuring the math adds up)
      const finalDay = percentiles[percentiles.length - 1];
      expectValueInRange(finalDay.p50, totalEventValue, 15);

      // Test that percentiles are properly ordered
      for (const dayData of percentiles) {
        expect(dayData.p10).toBeLessThanOrEqual(dayData.p25);
        expect(dayData.p25).toBeLessThanOrEqual(dayData.p50);
        expect(dayData.p50).toBeLessThanOrEqual(dayData.p75);
        expect(dayData.p75).toBeLessThanOrEqual(dayData.p90);
      }

      // Test that we can find the rent payment effect around day 7
      // Due to variance, it might be on days 5-9
      let rentEffectFound = false;
      for (let day = 5; day <= 9; day++) {
        if (day < percentiles.length && day > 0) {
          const change = percentiles[day].p50 - percentiles[day - 1].p50;
          // Look for a significant negative change (rent payment)
          if (change < -1000) {
            rentEffectFound = true;
            break;
          }
        }
      }
      expect(rentEffectFound).toBe(true);
    }),
  );

  it.effect("should work end-to-end without variance", () =>
    E.Effect.gen(function* (_) {
      const today = yield* _(DateTime.nowAsDate);

      const nextWeek = yield* _(
        DateTime.now.pipe(
          E.Effect.map((dt) => DateTime.add(dt, { days: 7 })),
          E.Effect.map((dt) => DateTime.toDate(dt)),
        ),
      );

      const events = [
        createCashEvent("1", "Initial Balance", 10000, today),
        createCashEvent("2", "Rent", -2000, nextWeek),
      ];
      const opts: SimulationOptions = {
        runCount: 10,
        runLength: 15,
        dateVarianceDays: 0,
        valueVariancePct: 0,
      };

      const runs = yield* _(runSimulation(events, opts));
      const percentiles = reduceToPercentiles(runs);

      // Should have 15 days of data
      expect(percentiles).toHaveLength(15);

      // Day 0 should show initial balance
      expect(percentiles[0].p50).toBe(10000);

      // Day 7 should show balance after rent
      expect(percentiles[7].p50).toBe(8000);

      // All percentiles should be the same since all runs are identical
      expect(percentiles[0].p10).toBe(percentiles[0].p90);
    }),
  );
});
