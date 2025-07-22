import { describe, expect, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { TestContext } from "effect/TestContext";
import { applyDateJitter, applyValueJitter } from "../Jitter.js";

const TestEnvironmentLayer = Layer.mergeAll(TestContext);

describe("Jitter utilities", () => {
	describe("applyDateJitter", () => {
		it.effect("should apply date jitter within expected range", () =>
			Effect.gen(function* (_) {
				const baseDate = DateTime.unsafeMake("2024-01-15T12:00:00.000Z");
				const maxDayVariance = 5;

				// Run multiple times to test the randomness
				const results: DateTime.DateTime[] = [];
				for (let i = 0; i < 100; i++) {
					const jitteredDate = yield* _(
						applyDateJitter(baseDate, maxDayVariance),
					);
					results.push(jitteredDate);
				}

				// All results should be within the expected range
				for (const result of results) {
					const timeDiff = Math.abs(
						DateTime.toEpochMillis(result) - DateTime.toEpochMillis(baseDate),
					);
					const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
					expect(daysDiff).toBeLessThanOrEqual(maxDayVariance + 0.1); // Small tolerance for rounding
				}

				// Should have some variation (not all the same)
				const uniqueDates = new Set(results.map((d) => d.toString()));
				expect(uniqueDates.size).toBeGreaterThan(10);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle zero variance", () =>
			Effect.gen(function* (_) {
				const baseDate = DateTime.unsafeMake("2024-01-15T12:00:00.000Z");
				const maxDayVariance = 0;

				const result = yield* _(applyDateJitter(baseDate, maxDayVariance));

				// With zero variance, result should be very close to input (may not be exact due to rounding)
				const timeDiff = Math.abs(
					DateTime.toEpochMillis(result) - DateTime.toEpochMillis(baseDate),
				);
				expect(timeDiff).toBeLessThan(1000 * 60 * 60); // Within an hour
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle small variance values", () =>
			Effect.gen(function* (_) {
				const baseDate = DateTime.unsafeMake("2024-01-15T12:00:00.000Z");
				const maxDayVariance = 0.5; // Half day variance

				const results: DateTime.DateTime[] = [];
				for (let i = 0; i < 50; i++) {
					const jitteredDate = yield* _(
						applyDateJitter(baseDate, maxDayVariance),
					);
					results.push(jitteredDate);
				}

				// All results should be within half a day of the original
				for (const result of results) {
					const timeDiff = Math.abs(
						DateTime.toEpochMillis(result) - DateTime.toEpochMillis(baseDate),
					);
					const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
					expect(daysDiff).toBeLessThanOrEqual(0.6); // Small tolerance
				}
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle large variance values", () =>
			Effect.gen(function* (_) {
				const baseDate = DateTime.unsafeMake("2024-01-15T12:00:00.000Z");
				const maxDayVariance = 10; // 10 day variance (reduced for stability)

				const results: DateTime.DateTime[] = [];
				for (let i = 0; i < 20; i++) {
					const jitteredDate = yield* _(
						applyDateJitter(baseDate, maxDayVariance),
					);
					results.push(jitteredDate);
				}

				// All results should be within 10 days of the original
				for (const result of results) {
					const timeDiff = Math.abs(
						DateTime.toEpochMillis(result) - DateTime.toEpochMillis(baseDate),
					);
					const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
					expect(daysDiff).toBeLessThanOrEqual(11); // Small tolerance
				}

				// Should have some variation
				const uniqueDates = new Set(results.map((d) => d.toString()));
				expect(uniqueDates.size).toBeGreaterThan(5);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect(
			"should handle negative variance (should be treated as absolute)",
			() =>
				Effect.gen(function* (_) {
					const baseDate = DateTime.unsafeMake("2024-01-15T12:00:00.000Z");
					const maxDayVariance = -5; // Negative variance

					const results: DateTime.DateTime[] = [];
					for (let i = 0; i < 50; i++) {
						const jitteredDate = yield* _(
							applyDateJitter(baseDate, maxDayVariance),
						);
						results.push(jitteredDate);
					}

					// Should still apply jitter based on absolute value
					for (const result of results) {
						const timeDiff = Math.abs(
							DateTime.toEpochMillis(result) - DateTime.toEpochMillis(baseDate),
						);
						const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
						expect(daysDiff).toBeLessThanOrEqual(6); // Should use absolute value of -5
					}
				}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle different time zones", () =>
			Effect.gen(function* (_) {
				const utcDate = DateTime.unsafeMake("2024-01-15T12:00:00.000Z");
				const maxDayVariance = 3;

				const result = yield* _(applyDateJitter(utcDate, maxDayVariance));

				// Result should still be a valid DateTime
				expect(result).toBeDefined();
				expect(typeof result.toString()).toBe("string");

				// Should be within expected range
				const timeDiff = Math.abs(
					DateTime.toEpochMillis(result) - DateTime.toEpochMillis(utcDate),
				);
				const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
				expect(daysDiff).toBeLessThanOrEqual(4);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle leap year dates", () =>
			Effect.gen(function* (_) {
				const leapYearDate = DateTime.unsafeMake("2024-02-29T12:00:00.000Z");
				const maxDayVariance = 10;

				const result = yield* _(applyDateJitter(leapYearDate, maxDayVariance));

				// Should handle leap year date without errors
				expect(result).toBeDefined();
				expect(typeof result.toString()).toBe("string");

				// Should be within expected range
				const timeDiff = Math.abs(
					DateTime.toEpochMillis(result) - DateTime.toEpochMillis(leapYearDate),
				);
				const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
				expect(daysDiff).toBeLessThanOrEqual(11);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);
	});

	describe("applyValueJitter", () => {
		it.effect("should apply value jitter within expected range", () =>
			Effect.gen(function* (_) {
				const baseValue = 1000;
				const maxVariancePercent = 20; // 20% variance

				const results: number[] = [];
				for (let i = 0; i < 100; i++) {
					const jitteredValue = yield* _(
						applyValueJitter(baseValue, maxVariancePercent),
					);
					results.push(jitteredValue);
				}

				// All results should be within the expected range
				const minExpected = baseValue * 0.8; // -20%
				const maxExpected = baseValue * 1.2; // +20%

				for (const result of results) {
					expect(result).toBeGreaterThanOrEqual(minExpected - 0.01); // Small tolerance
					expect(result).toBeLessThanOrEqual(maxExpected + 0.01);
				}

				// Should have some variation (not all the same)
				const uniqueValues = new Set(results);
				expect(uniqueValues.size).toBeGreaterThan(10);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle zero variance", () =>
			Effect.gen(function* (_) {
				const baseValue = 500;
				const maxVariancePercent = 0;

				const result = yield* _(
					applyValueJitter(baseValue, maxVariancePercent),
				);

				// With zero variance, result should be the same as input
				expect(result).toBe(baseValue);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle negative base values", () =>
			Effect.gen(function* (_) {
				const baseValue = -1000;
				const maxVariancePercent = 10; // 10% variance

				const results: number[] = [];
				for (let i = 0; i < 50; i++) {
					const jitteredValue = yield* _(
						applyValueJitter(baseValue, maxVariancePercent),
					);
					results.push(jitteredValue);
				}

				// For negative values, the range calculation should still work
				// -1000 with 10% variance should be between -1100 and -900
				const minExpected = baseValue * 1.1; // More negative
				const maxExpected = baseValue * 0.9; // Less negative

				for (const result of results) {
					expect(result).toBeGreaterThanOrEqual(minExpected - 0.01);
					expect(result).toBeLessThanOrEqual(maxExpected + 0.01);
				}
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle zero base value", () =>
			Effect.gen(function* (_) {
				const baseValue = 0;
				const maxVariancePercent = 50;

				const result = yield* _(
					applyValueJitter(baseValue, maxVariancePercent),
				);

				// Zero times any variance should still be zero
				expect(result).toBe(0);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle small base values", () =>
			Effect.gen(function* (_) {
				const baseValue = 0.01;
				const maxVariancePercent = 20;

				const results: number[] = [];
				for (let i = 0; i < 50; i++) {
					const jitteredValue = yield* _(
						applyValueJitter(baseValue, maxVariancePercent),
					);
					results.push(jitteredValue);
				}

				// Should work with very small values
				const minExpected = baseValue * 0.8;
				const maxExpected = baseValue * 1.2;

				for (const result of results) {
					expect(result).toBeGreaterThanOrEqual(minExpected - 0.0001);
					expect(result).toBeLessThanOrEqual(maxExpected + 0.0001);
				}
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle large base values", () =>
			Effect.gen(function* (_) {
				const baseValue = 1000000;
				const maxVariancePercent = 15;

				const results: number[] = [];
				for (let i = 0; i < 30; i++) {
					const jitteredValue = yield* _(
						applyValueJitter(baseValue, maxVariancePercent),
					);
					results.push(jitteredValue);
				}

				// Should work with large values
				const minExpected = baseValue * 0.85;
				const maxExpected = baseValue * 1.15;

				for (const result of results) {
					expect(result).toBeGreaterThanOrEqual(minExpected - 1);
					expect(result).toBeLessThanOrEqual(maxExpected + 1);
				}
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle high variance percentages", () =>
			Effect.gen(function* (_) {
				const baseValue = 100;
				const maxVariancePercent = 90; // 90% variance

				const results: number[] = [];
				for (let i = 0; i < 50; i++) {
					const jitteredValue = yield* _(
						applyValueJitter(baseValue, maxVariancePercent),
					);
					results.push(jitteredValue);
				}

				// With 90% variance, values should range from 10 to 190
				const minExpected = baseValue * 0.1;
				const maxExpected = baseValue * 1.9;

				for (const result of results) {
					expect(result).toBeGreaterThanOrEqual(minExpected - 0.1);
					expect(result).toBeLessThanOrEqual(maxExpected + 0.1);
				}

				// Should have significant variation
				const uniqueValues = new Set(
					results.map((v) => Math.round(v * 100) / 100),
				);
				expect(uniqueValues.size).toBeGreaterThan(20);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle fractional variance percentages", () =>
			Effect.gen(function* (_) {
				const baseValue = 1000;
				const maxVariancePercent = 2.5; // 2.5% variance

				const results: number[] = [];
				for (let i = 0; i < 50; i++) {
					const jitteredValue = yield* _(
						applyValueJitter(baseValue, maxVariancePercent),
					);
					results.push(jitteredValue);
				}

				// With 2.5% variance, values should range from 975 to 1025
				const minExpected = baseValue * 0.975;
				const maxExpected = baseValue * 1.025;

				for (const result of results) {
					expect(result).toBeGreaterThanOrEqual(minExpected - 0.01);
					expect(result).toBeLessThanOrEqual(maxExpected + 0.01);
				}
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should preserve type information", () =>
			Effect.gen(function* (_) {
				const baseValue = 42 as const;
				const maxVariancePercent = 10;

				const result = yield* _(
					applyValueJitter(baseValue, maxVariancePercent),
				);

				// Result should be a number
				expect(typeof result).toBe("number");
				expect(result).not.toBe(baseValue); // Should be different due to jitter
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle negative variance percentages", () =>
			Effect.gen(function* (_) {
				const baseValue = 1000;
				const maxVariancePercent = -20; // Negative variance

				const results: number[] = [];
				for (let i = 0; i < 50; i++) {
					const jitteredValue = yield* _(
						applyValueJitter(baseValue, maxVariancePercent),
					);
					results.push(jitteredValue);
				}

				// Should treat negative variance as absolute value
				const minExpected = baseValue * 0.8;
				const maxExpected = baseValue * 1.2;

				for (const result of results) {
					expect(result).toBeGreaterThanOrEqual(minExpected - 0.01);
					expect(result).toBeLessThanOrEqual(maxExpected + 0.01);
				}
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect("should handle extreme variance values", () =>
			Effect.gen(function* (_) {
				const baseValue = 100;
				const maxVariancePercent = 200; // 200% variance - extreme case

				const results: number[] = [];
				for (let i = 0; i < 30; i++) {
					const jitteredValue = yield* _(
						applyValueJitter(baseValue, maxVariancePercent),
					);
					results.push(jitteredValue);
				}

				// With 200% variance, values could range from -100 to 300
				const minExpected = baseValue * -1;
				const maxExpected = baseValue * 3;

				for (const result of results) {
					expect(result).toBeGreaterThanOrEqual(minExpected - 1);
					expect(result).toBeLessThanOrEqual(maxExpected + 1);
				}
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);
	});

	describe("Integration between date and value jitter", () => {
		it.effect("should work together in realistic scenarios", () =>
			Effect.gen(function* (_) {
				const baseDate = DateTime.unsafeMake("2024-06-15T12:00:00.000Z");
				const baseValue = 2500;
				const dateVariance = 7; // 7 days
				const valueVariance = 15; // 15%

				// Apply both jitters together
				const jitteredDate = yield* _(applyDateJitter(baseDate, dateVariance));
				const jitteredValue = yield* _(
					applyValueJitter(baseValue, valueVariance),
				);

				// Both should be valid and within expected ranges
				expect(jitteredDate).toBeDefined();
				expect(typeof jitteredDate.toString()).toBe("string");

				expect(jitteredValue).toBeGreaterThanOrEqual(baseValue * 0.85 - 0.01);
				expect(jitteredValue).toBeLessThanOrEqual(baseValue * 1.15 + 0.01);

				// Date should be within 7 days
				const timeDiff = Math.abs(
					DateTime.toEpochMillis(jitteredDate) -
						DateTime.toEpochMillis(baseDate),
				);
				const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
				expect(daysDiff).toBeLessThanOrEqual(7.5);
			}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect(
			"should maintain independence between date and value jitter",
			() =>
				Effect.gen(function* (_) {
					const baseDate = DateTime.unsafeMake("2024-01-01T00:00:00.000Z");
					const baseValue = 1000;

					const results: Array<{ date: DateTime.DateTime; value: number }> = [];
					for (let i = 0; i < 50; i++) {
						const jitteredDate = yield* _(applyDateJitter(baseDate, 5));
						const jitteredValue = yield* _(applyValueJitter(baseValue, 10));
						results.push({ date: jitteredDate, value: jitteredValue });
					}

					// Date jitter should not correlate with value jitter
					const dates = results.map((r) => DateTime.toEpochMillis(r.date));
					const values = results.map((r) => r.value);

					// Both should have variation
					expect(new Set(dates).size).toBeGreaterThan(10);
					expect(
						new Set(values.map((v) => Math.round(v))).size,
					).toBeGreaterThan(10);
				}).pipe(Effect.provide(TestEnvironmentLayer)),
		);
	});

	describe("Statistical properties", () => {
		it.effect(
			"should have approximately uniform distribution for date jitter",
			() =>
				Effect.gen(function* (_) {
					const baseDate = DateTime.unsafeMake("2024-01-15T12:00:00.000Z");
					const maxDayVariance = 10;
					const sampleSize = 1000;

					const results: number[] = [];
					for (let i = 0; i < sampleSize; i++) {
						const jitteredDate = yield* _(
							applyDateJitter(baseDate, maxDayVariance),
						);
						const daysDiff =
							(DateTime.toEpochMillis(jitteredDate) -
								DateTime.toEpochMillis(baseDate)) /
							(1000 * 60 * 60 * 24);
						results.push(daysDiff);
					}

					// Should be roughly centered around 0
					const mean =
						results.reduce((sum, val) => sum + val, 0) / results.length;
					expect(Math.abs(mean)).toBeLessThan(1); // Should be close to 0

					// Should have both positive and negative values
					const positiveCount = results.filter((v) => v > 0).length;
					const negativeCount = results.filter((v) => v < 0).length;

					expect(positiveCount).toBeGreaterThan(sampleSize * 0.3);
					expect(negativeCount).toBeGreaterThan(sampleSize * 0.3);
				}).pipe(Effect.provide(TestEnvironmentLayer)),
		);

		it.effect(
			"should have approximately uniform distribution for value jitter",
			() =>
				Effect.gen(function* (_) {
					const baseValue = 1000;
					const maxVariancePercent = 20;
					const sampleSize = 1000;

					const results: number[] = [];
					for (let i = 0; i < sampleSize; i++) {
						const jitteredValue = yield* _(
							applyValueJitter(baseValue, maxVariancePercent),
						);
						results.push(jitteredValue);
					}

					// Should be roughly centered around the base value
					const mean =
						results.reduce((sum, val) => sum + val, 0) / results.length;
					expect(Math.abs(mean - baseValue)).toBeLessThan(50); // Should be close to base value

					// Should have both values above and below base
					const aboveCount = results.filter((v) => v > baseValue).length;
					const belowCount = results.filter((v) => v < baseValue).length;

					expect(aboveCount).toBeGreaterThan(sampleSize * 0.3);
					expect(belowCount).toBeGreaterThan(sampleSize * 0.3);
				}).pipe(Effect.provide(TestEnvironmentLayer)),
		);
	});
});
