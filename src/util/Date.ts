import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Either from "effect/Either";

export const daysBetweenDates = (
	a: DateTime.DateTime,
	b: DateTime.DateTime,
): number => {
	const dist = DateTime.distanceDurationEither(a, b);
	return Either.match(dist, {
		onLeft: (negV) => -Duration.toDays(negV),
		onRight: (posV) => Duration.toDays(posV),
	});
};

export const daysFromToday = Effect.fn("daysFromToday")(function* (
	when: DateTime.DateTime,
) {
	const now = yield* DateTime.now;
	const days = daysBetweenDates(now, when);

	return days;
});
