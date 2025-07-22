import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Random from "effect/Random";

export const applyDateJitter = Effect.fn("applyDateJitter")(function* <
	A extends DateTime.Utc,
>(v: A, maxDayVariance: number) {
	const randomDays = yield* Random.next.pipe(
		Effect.map((r) => 2 * maxDayVariance * r - maxDayVariance),
		Effect.map(Math.round),
	);

	return DateTime.add(v, {
		days: randomDays,
	});
});

export const applyValueJitter = Effect.fn("applyValueJitter")(function* <
	A extends number,
>(v: A, maxVariancePercent: number) {
	const randomFactor = yield* Random.next.pipe(
		Effect.map(
			(r) => 2 * (maxVariancePercent / 100) * r - maxVariancePercent / 100,
		),
	);
	const jitterAmount = v * randomFactor;
	return (v + jitterAmount) as A;
});
