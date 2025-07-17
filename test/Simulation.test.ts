import { describe, expect, it } from "@effect/vitest";
import * as E from "effect";
import * as DateTime from "effect/DateTime";
import {
  runSimulation,
  reduceToPercentiles,
  type SimulationOptions,
} from "../src/Simulation.js";
import { CashEvent } from "../src/Parse.js";

describe("Simulation", () => {
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

  describe("runSimulation", () => {
    it.effect("should handle empty events array", () =>
      E.Effect.gen(function* (_) {
        const events: CashEvent[] = [];
        const opts: SimulationOptions = { runCount: 3 };
        const result = yield* _(runSimulation(events, opts));
        expect(result).toHaveLength(3);
        expect(result[0]).toHaveLength(120);
        expect(result[0]).toEqual(new Array(120).fill(0));
      }),
    );

    it.effect("should create correct number of runs", () =>
      E.Effect.gen(function* (_) {
        const today = yield* E.DateTime.nowAsDate;
        const events = [createCashEvent("1", "Salary", 5000, today)];
        const opts: SimulationOptions = { runCount: 5 };

        const result = yield* _(runSimulation(events, opts));

        expect(result).toHaveLength(5);
        expect(result.every((run) => run.length === 120)).toBe(true);
      }),
    );

    it.effect("should correctly place events on future dates", () =>
      E.Effect.gen(function* (_) {
        const futureDate = yield* _(
          DateTime.now.pipe(
            E.Effect.map((t) => DateTime.add(t, { days: 10 })),
            E.Effect.map((t) => DateTime.toDate(t)),
          ),
        );

        const events = [
          createCashEvent("1", "Future Payment", 2000, futureDate),
        ];
        const opts: SimulationOptions = { runCount: 1 };

        const result = yield* _(runSimulation(events, opts));

        // Day 10 should have the event value (cumulative balance)
        expect(result[0][10]).toBe(2000);
        // Days before event should be 0
        expect(result[0][0]).toBe(0);
        expect(result[0][9]).toBe(0);
        // Days after event should maintain the cumulative balance
        expect(result[0][11]).toBe(2000);
      }),
    );

    it.effect("should ignore events beyond forecast length", () =>
      E.Effect.gen(function* (_) {
        const futureDate = yield* _(
          DateTime.now.pipe(
            E.Effect.map((t) => DateTime.add(t, { days: 150 })),
            E.Effect.map((t) => DateTime.toDate(t)),
          ),
        );

        const events = [
          createCashEvent("1", "Far Future Payment", 1000, futureDate),
        ];
        const opts: SimulationOptions = { runCount: 1 };

        const result = yield* _(runSimulation(events, opts));

        // All days should remain 0
        expect(result[0].every((value) => value === 0)).toBe(true);
      }),
    );

    it.effect("should ignore events in the past", () =>
      E.Effect.gen(function* (_) {
        const pastDate = yield* _(
          DateTime.now.pipe(
            E.Effect.map((t) => DateTime.subtract(t, { days: 5 })),
            E.Effect.map((t) => DateTime.toDate(t)),
          ),
        );

        const events = [createCashEvent("1", "Past Payment", 1000, pastDate)];
        const opts: SimulationOptions = { runCount: 1 };

        const result = yield* _(runSimulation(events, opts));

        // All days should remain 0
        expect(result[0].every((value) => value === 0)).toBe(true);
      }),
    );

    it.effect("should accumulate multiple events on the same day", () =>
      E.Effect.gen(function* (_) {
        const today = yield* _(DateTime.nowAsDate);

        const events = [
          createCashEvent("1", "Income", 1000, today),
          createCashEvent("2", "Expense", -500, today),
          createCashEvent("3", "Bonus", 300, today),
        ];
        const opts: SimulationOptions = { runCount: 1 };

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
        const opts: SimulationOptions = { runCount: 1 };

        const result = yield* _(runSimulation(events, opts));

        expect(result[0][0]).toBe(1000); // Day 0: 1000
        expect(result[0][1]).toBe(1500); // Day 1: 1000 + 500
        expect(result[0][2]).toBe(1300); // Day 2: 1500 - 200
        expect(result[0][3]).toBe(1300); // Day 3: no change
      }),
    );

    it.effect("should handle multiple runs independently", () =>
      E.Effect.gen(function* (_) {
        const today = yield* _(DateTime.nowAsDate);

        const events = [createCashEvent("1", "Payment", 1000, today)];
        const opts: SimulationOptions = { runCount: 3 };

        const result = yield* _(runSimulation(events, opts));

        // All runs should have the same values since we're using the same events
        expect(result[0][0]).toBe(1000);
        expect(result[1][0]).toBe(1000);
        expect(result[2][0]).toBe(1000);
      }),
    );
  });

  describe("reduceToPercentiles", () => {
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
  });

  describe("integration test", () => {
    it.effect("should work end-to-end with realistic data", () =>
      E.Effect.gen(function* (_) {
        const today = yield* _(DateTime.nowAsDate);

        const nextWeek = yield* _(
          DateTime.now.pipe(
            E.Effect.map((dt) => DateTime.add(dt, { weeks: 1 })),
            E.Effect.map((dt) => DateTime.toDate(dt)),
          ),
        );

        const nextMonth = yield* _(
          DateTime.now.pipe(
            E.Effect.map((dt) => DateTime.add(dt, { days: 30 })),
            E.Effect.map((dt) => DateTime.toDate(dt)),
          ),
        );

        const events = [
          createCashEvent("1", "Initial Balance", 10000, today),
          createCashEvent("2", "Rent", -2000, nextWeek),
          createCashEvent("3", "Salary", 5000, nextMonth),
        ];
        const opts: SimulationOptions = { runCount: 10 };

        const runs = yield* _(runSimulation(events, opts));
        const percentiles = reduceToPercentiles(runs);

        // Should have 120 days of data
        expect(percentiles).toHaveLength(120);

        // Day 0 should show initial balance
        expect(percentiles[0].p50).toBe(10000);

        // Day 7 should show balance after rent
        expect(percentiles[7].p50).toBe(8000);

        // Day 30 should show balance after salary
        expect(percentiles[30].p50).toBe(13000);

        // All percentiles should be the same since all runs are identical
        expect(percentiles[0].p10).toBe(percentiles[0].p90);
      }),
    );
  });
});
