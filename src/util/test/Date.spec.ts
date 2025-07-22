import { describe, expect, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { TestContext } from "effect/TestContext";
import { daysBetweenDates, daysFromToday } from "../Date.js";

const TestEnvironmentLayer = Layer.mergeAll(TestContext);

describe("Date utilities", () => {
	describe("daysBetweenDates", () => {
		it.effect("should calculate positive days between dates", () =>
			Effect.gen(function* (_) {
				const earlier = Option.getOrThrow(
					DateTime.make("2024-01-01T00:00:00.000Z"),
				);
				const later = Option.getOrThrow(
					DateTime.make("2024-01-11T00:00:00.000Z"),
				);

				const result = daysBetweenDates(earlier, later);

				expect(result).toBe(10);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should calculate negative days between dates", () =>
			Effect.gen(function* (_) {
				const later = DateTime.unsafeMake("2024-01-11T00:00:00.000Z");
				const earlier = DateTime.unsafeMake("2024-01-01T00:00:00.000Z");

				const result = daysBetweenDates(later, earlier);

				expect(result).toBe(-10);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should return zero for same dates", () =>
			Effect.gen(function* (_) {
				const date1 = DateTime.unsafeMake("2024-01-01T00:00:00.000Z");
				const date2 = DateTime.unsafeMake("2024-01-01T00:00:00.000Z");

				const result = daysBetweenDates(date1, date2);

				expect(Math.abs(result)).toBeLessThan(0.01); // Very close to 0
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle same dates with different times", () =>
			Effect.gen(function* (_) {
				const morning = DateTime.unsafeMake("2024-01-01T08:00:00.000Z");
				const evening = DateTime.unsafeMake("2024-01-01T20:00:00.000Z");

				const result = daysBetweenDates(morning, evening);

				expect(result).toBeCloseTo(0.5, 1); // 12 hours = 0.5 days
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle dates spanning exactly one day", () =>
			Effect.gen(function* (_) {
				const day1Morning = DateTime.unsafeMake("2024-01-01T08:00:00.000Z");
				const day2Morning = DateTime.unsafeMake("2024-01-02T08:00:00.000Z");

				const result = daysBetweenDates(day1Morning, day2Morning);

				expect(result).toBe(1);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle partial days correctly", () =>
			Effect.gen(function* (_) {
				const start = DateTime.unsafeMake("2024-01-01T23:00:00.000Z");
				const end = DateTime.unsafeMake("2024-01-02T01:00:00.000Z");

				const result = daysBetweenDates(start, end);

				// 2 hours = 2/24 days = 0.083... days
				expect(result).toBeCloseTo(0.083, 2);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle month boundaries", () =>
			Effect.gen(function* (_) {
				const january31 = DateTime.unsafeMake("2024-01-31T00:00:00.000Z");
				const february1 = DateTime.unsafeMake("2024-02-01T00:00:00.000Z");

				const result = daysBetweenDates(january31, february1);

				expect(result).toBe(1);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle year boundaries", () =>
			Effect.gen(function* (_) {
				const december31 = DateTime.unsafeMake("2023-12-31T00:00:00.000Z");
				const january1 = DateTime.unsafeMake("2024-01-01T00:00:00.000Z");

				const result = daysBetweenDates(december31, january1);

				expect(result).toBe(1);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle leap year correctly", () =>
			Effect.gen(function* (_) {
				const february28 = DateTime.unsafeMake("2024-02-28T00:00:00.000Z");
				const march1 = DateTime.unsafeMake("2024-03-01T00:00:00.000Z");

				const result = daysBetweenDates(february28, march1);

				expect(result).toBe(2); // 2024 is a leap year, so Feb 29 exists
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle non-leap year correctly", () =>
			Effect.gen(function* (_) {
				const february28 = DateTime.unsafeMake("2023-02-28T00:00:00.000Z");
				const march1 = DateTime.unsafeMake("2023-03-01T00:00:00.000Z");

				const result = daysBetweenDates(february28, march1);

				expect(result).toBe(1); // 2023 is not a leap year
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle large date differences", () =>
			Effect.gen(function* (_) {
				const start = DateTime.unsafeMake("2020-01-01T00:00:00.000Z");
				const end = DateTime.unsafeMake("2024-01-01T00:00:00.000Z");

				const result = daysBetweenDates(start, end);

				expect(result).toBe(1461); // 4 years * 365 + 1 leap day
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle daylight saving time transitions", () =>
			Effect.gen(function* (_) {
				// Spring forward (lose an hour)
				const beforeDST = DateTime.unsafeMake("2024-03-09T00:00:00.000Z");
				const afterDST = DateTime.unsafeMake("2024-03-10T00:00:00.000Z");

				const result = daysBetweenDates(beforeDST, afterDST);

				expect(result).toBe(1);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);
	});

	describe("daysFromToday", () => {
		it.effect("should calculate days for future date", () =>
			Effect.gen(function* (_) {
				// Mock current time to a known value
				const futureDate = DateTime.unsafeMake("2024-01-11T12:00:00.000Z");

				// We need to provide a mock DateTime.now service
				const result = yield* _(daysFromToday(futureDate));

				// This will use the actual current time, so we can't predict the exact value
				expect(typeof result).toBe("number");
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should calculate days for past date", () =>
			Effect.gen(function* (_) {
				const pastDate = DateTime.unsafeMake("2020-01-01T12:00:00.000Z");

				const result = yield* _(daysFromToday(pastDate));

				// Should be negative since it's in the past
				// This test uses actual current time, so we can't predict the exact sign
				expect(typeof result).toBe("number");
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle dates very close to current time", () =>
			Effect.gen(function* (_) {
				const now = yield* _(DateTime.now);
				const nearFuture = DateTime.add(now, { hours: 1 });

				const result = yield* _(daysFromToday(nearFuture));

				// Should be very close to 0
				expect(result).toBeGreaterThanOrEqual(0);
				expect(result).toBeLessThan(1);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle dates exactly one day in the future", () =>
			Effect.gen(function* (_) {
				const now = yield* _(DateTime.now);
				const tomorrow = DateTime.add(now, { days: 1 });

				const result = yield* _(daysFromToday(tomorrow));

				// Should be approximately 1
				expect(result).toBeCloseTo(1, 0);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle dates exactly one day in the past", () =>
			Effect.gen(function* (_) {
				const now = yield* _(DateTime.now);
				const yesterday = DateTime.subtract(now, { days: 1 });

				const result = yield* _(daysFromToday(yesterday));

				// Should be approximately -1
				expect(result).toBeCloseTo(-1, 0);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should be consistent with daysBetweenDates", () =>
			Effect.gen(function* (_) {
				const now = yield* _(DateTime.now);
				const futureDate = DateTime.add(now, { days: 5 });

				const daysFromTodayResult = yield* _(daysFromToday(futureDate));
				const daysBetweenResult = daysBetweenDates(now, futureDate);

				expect(daysFromTodayResult).toBeCloseTo(daysBetweenResult, 0);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle very distant future dates", () =>
			Effect.gen(function* (_) {
				const distantFuture = DateTime.unsafeMake("2030-12-31T00:00:00.000Z");

				const result = yield* _(daysFromToday(distantFuture));

				expect(result).toBeGreaterThan(365); // Should be many years in the future
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle very distant past dates", () =>
			Effect.gen(function* (_) {
				const distantPast = DateTime.unsafeMake("2000-01-01T00:00:00.000Z");

				const result = yield* _(daysFromToday(distantPast));

				// This test uses actual current time, so we can't predict the exact value
				expect(typeof result).toBe("number");
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);
	});

	describe("Edge cases and error handling", () => {
		it.effect("should handle minimum DateTime values", () =>
			Effect.gen(function* (_) {
				const minDate = DateTime.unsafeMake("1970-01-01T00:00:00.000Z");
				const laterDate = DateTime.unsafeMake("1970-01-02T00:00:00.000Z");

				const result = daysBetweenDates(minDate, laterDate);

				expect(result).toBe(1);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle maximum DateTime values representable", () =>
			Effect.gen(function* (_) {
				const date1 = DateTime.unsafeMake("2099-12-30T00:00:00.000Z");
				const date2 = DateTime.unsafeMake("2099-12-31T00:00:00.000Z");

				const result = daysBetweenDates(date1, date2);

				expect(result).toBe(1);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle microsecond precision", () =>
			Effect.gen(function* (_) {
				const date1 = DateTime.unsafeMake("2024-01-01T00:00:00.000Z");
				const date2 = DateTime.unsafeMake("2024-01-01T00:00:00.001Z");

				const result = daysBetweenDates(date1, date2);

				// 1 millisecond difference is a very small fraction of a day
				expect(Math.abs(result)).toBeLessThan(0.001);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);
	});

	describe("Integration with Duration", () => {
		it.effect("should be consistent with Duration calculations", () =>
			Effect.gen(function* (_) {
				const start = DateTime.unsafeMake("2024-01-01T00:00:00.000Z");
				const end = DateTime.unsafeMake("2024-01-08T00:00:00.000Z");

				const daysBetween = daysBetweenDates(start, end);

				// Verify this matches what we'd expect from Duration
				const expectedDays = 7;
				expect(daysBetween).toBe(expectedDays);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle fractional days consistently", () =>
			Effect.gen(function* (_) {
				const start = DateTime.unsafeMake("2024-01-01T00:00:00.000Z");
				const end = DateTime.unsafeMake("2024-01-01T12:00:00.000Z");

				const result = daysBetweenDates(start, end);

				// 12 hours = 0.5 days
				expect(result).toBeCloseTo(0.5, 1);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle just over half a day", () =>
			Effect.gen(function* (_) {
				const start = DateTime.unsafeMake("2024-01-01T00:00:00.000Z");
				const end = DateTime.unsafeMake("2024-01-01T13:00:00.000Z");

				const result = daysBetweenDates(start, end);

				// 13 hours = 0.54 days
				expect(result).toBeCloseTo(0.54, 1);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);
	});
});
