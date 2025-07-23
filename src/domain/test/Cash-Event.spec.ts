import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { TestContext } from "effect/TestContext";
import { CashEventSchema } from "../Cash-Event.js";

const TestEnvironmentLayer = Layer.mergeAll(TestContext);

describe("CashEvent", () => {
  describe("Schema validation", () => {
    it.effect("should convert strings -> number for value", () =>
      Effect.gen(function* (_) {
        const data = {
          ID: "EVENT-001",
          label: "Salary Payment",
          value: "100",
          date: "2024-01-15",
        };

        // DateFromString will create an Invalid Date object rather than failing
        const result = yield* _(Schema.decodeUnknown(CashEventSchema)(data));

        expect(result.value).toBe(100);
      }).pipe(Effect.provide(TestEnvironmentLayer)),
    );

    it.effect("should decode valid CashEvent data", () =>
      Effect.gen(function* (_) {
        const validData = {
          ID: "EVENT-001",
          label: "Salary Payment",
          value: 5000.5,
          date: "2024-01-15",
        };

        const result = yield* _(
          Schema.decodeUnknown(CashEventSchema)(validData),
        );

        expect(result.ID).toBe("EVENT-001");
        expect(result.label).toBe("Salary Payment");
        expect(result.value).toBe(5000.5);
        expect(result.date).toBeInstanceOf(Date);
        expect(result.date.toISOString()).toBe("2024-01-15T00:00:00.000Z");
      }).pipe(Effect.provide(TestEnvironmentLayer)),
    );

    it.effect("should handle negative values", () =>
      Effect.gen(function* (_) {
        const validData = {
          ID: "EVENT-002",
          label: "Rent Payment",
          value: -1500.0,
          date: "2024-01-01",
        };

        const result = yield* _(
          Schema.decodeUnknown(CashEventSchema)(validData),
        );

        expect(result.value).toBe(-1500.0);
        expect(result.label).toBe("Rent Payment");
      }).pipe(Effect.provide(TestEnvironmentLayer)),
    );

    it.effect("should fail on untrimmed strings", () =>
      Effect.gen(function* (_) {
        const invalidData = {
          ID: "  EVENT-003  ",
          label: "  Bonus Payment  ",
          value: 2000,
          date: "2024-02-01",
        };

        const result = yield* _(
          Schema.decodeUnknown(CashEventSchema)(invalidData).pipe(Effect.flip),
        );

        expect(result).toBeDefined();
      }).pipe(Effect.provide(TestEnvironmentLayer)),
    );

    it.effect("should handle various date formats", () =>
      Effect.gen(function* (_) {
        const testCases = [
          { date: "2024-01-15", expected: "2024-01-15T00:00:00.000Z" },
          {
            date: "2024-01-15T10:30:00.000Z",
            expected: "2024-01-15T10:30:00.000Z",
          },
          { date: "2024-12-31", expected: "2024-12-31T00:00:00.000Z" },
        ];

        for (const testCase of testCases) {
          const validData = {
            ID: "EVENT-DATE",
            label: "Date Test",
            value: 100,
            date: testCase.date,
          };

          const result = yield* _(
            Schema.decodeUnknown(CashEventSchema)(validData),
          );
          expect(result.date.toISOString()).toBe(testCase.expected);
        }
      }).pipe(Effect.provide(TestEnvironmentLayer)),
    );
  });

  describe("Schema validation errors", () => {
    it.effect("should fail with empty ID", () =>
      Effect.gen(function* (_) {
        const invalidData = {
          ID: "",
          label: "Test Event",
          value: 100,
          date: "2024-01-01T00:00:00.000Z",
        };

        const result = yield* _(
          Schema.decodeUnknown(CashEventSchema)(invalidData).pipe(Effect.flip),
        );

        expect(result).toBeDefined();
      }).pipe(Effect.provide(TestEnvironmentLayer)),
    );

    it.effect("should fail with whitespace-only ID", () =>
      Effect.gen(function* (_) {
        const invalidData = {
          ID: "   ",
          label: "Test Event",
          value: 100,
          date: "2024-01-01T00:00:00.000Z",
        };

        const result = yield* _(
          Schema.decodeUnknown(CashEventSchema)(invalidData).pipe(Effect.flip),
        );

        expect(result).toBeDefined();
      }).pipe(Effect.provide(TestEnvironmentLayer)),
    );

    it.effect("should fail with empty label", () =>
      Effect.gen(function* (_) {
        const invalidData = {
          ID: "EVENT-005",
          label: "",
          value: 200,
          date: "2024-05-01",
        };

        const result = yield* _(
          Schema.decodeUnknown(CashEventSchema)(invalidData).pipe(Effect.flip),
        );

        expect(result).toBeDefined();
      }).pipe(Effect.provide(TestEnvironmentLayer)),
    );

    it.effect("should fail with non-numeric value", () =>
      Effect.gen(function* (_) {
        const invalidData = {
          ID: "EVENT-001",
          label: "Test Event",
          value: "not-a-number",
          date: "2024-01-01",
        };

        const result = yield* _(
          Schema.decodeUnknown(CashEventSchema)(invalidData).pipe(Effect.flip),
        );

        expect(result).toBeDefined();
      }).pipe(Effect.provide(TestEnvironmentLayer)),
    );

    it.effect(
      "should create CashEvent with Invalid Date for invalid date strings",
      () =>
        Effect.gen(function* (_) {
          const invalidData = {
            ID: "EVENT-001",
            label: "Test Event",
            value: 100,
            date: "Not a date",
          };

          // DateFromString will create an Invalid Date object rather than failing
          const result = yield* _(
            Schema.decodeUnknown(CashEventSchema)(invalidData),
          );

          expect(Number.isNaN(result.date.getTime())).toBe(true);
        }).pipe(Effect.provide(TestEnvironmentLayer)),
    );

    it.effect("should fail with missing required fields", () =>
      Effect.gen(function* (_) {
        const invalidData = {
          ID: "EVENT-001",
          // missing label, value, date
        };

        const result = yield* _(
          Schema.decodeUnknown(CashEventSchema)(invalidData).pipe(Effect.flip),
        );

        expect(result).toBeDefined();
      }).pipe(Effect.provide(TestEnvironmentLayer)),
    );
  });

  describe("Instance methods", () => {
    it.effect("should be JSON serializable", () =>
      Effect.gen(function* (_) {
        const cashEvent = Schema.decodeUnknownSync(CashEventSchema)({
          ID: "EVENT-JSON",
          label: "JSON Test",
          value: 250.75,
          date: new Date("2024-04-01").toISOString(),
        });

        const jsonString = JSON.stringify(cashEvent);
        const parsed = JSON.parse(jsonString);

        expect(parsed.ID).toBe("EVENT-JSON");
        expect(parsed.label).toBe("JSON Test");
        expect(parsed.value).toBe(250.75);
        expect(new Date(parsed.date)).toEqual(cashEvent.date);
      }).pipe(Effect.provide(TestEnvironmentLayer)),
    );
  });

  describe("Edge cases", () => {
    it.effect("should handle very large numbers", () =>
      Effect.gen(function* (_) {
        const validData = {
          ID: "EVENT-LARGE",
          label: "Large Value",
          value: 999999999.99,
          date: "2024-01-01",
        };

        const result = yield* _(
          Schema.decodeUnknown(CashEventSchema)(validData),
        );
        expect(result.value).toBe(999999999.99);
      }).pipe(Effect.provide(TestEnvironmentLayer)),
    );

    it.effect("should handle very small decimal numbers", () =>
      Effect.gen(function* (_) {
        const validData = {
          ID: "EVENT-SMALL",
          label: "Small Value",
          value: 0.01,
          date: "2024-01-01",
        };

        const result = yield* _(
          Schema.decodeUnknown(CashEventSchema)(validData),
        );
        expect(result.value).toBe(0.01);
      }).pipe(Effect.provide(TestEnvironmentLayer)),
    );

    it.effect("should handle zero value", () =>
      Effect.gen(function* (_) {
        const validData = {
          ID: "EVENT-ZERO",
          label: "Zero Value Test",
          value: 0,
          date: "2024-08-01",
        };

        const result = yield* _(
          Schema.decodeUnknown(CashEventSchema)(validData),
        );
        expect(result.value).toBe(0);
      }).pipe(Effect.provide(TestEnvironmentLayer)),
    );

    it.effect("should handle leap year dates", () =>
      Effect.gen(function* (_) {
        const validData = {
          ID: "EVENT-LEAP",
          label: "Leap Year",
          value: 100,
          date: "2024-02-29",
        };

        const result = yield* _(
          Schema.decodeUnknown(CashEventSchema)(validData),
        );
        expect(result.date.toISOString()).toBe("2024-02-29T00:00:00.000Z");
      }).pipe(Effect.provide(TestEnvironmentLayer)),
    );
  });
});
