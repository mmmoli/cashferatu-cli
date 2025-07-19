import * as E from "effect";

export const applyValueJitter = E.Effect.fn("applyValueJitter")(function* <
  A extends number,
>(v: A, maxVariancePercent: number) {
  const randomFactor = yield* E.Random.next.pipe(
    E.Effect.map(
      (r) => 2 * (maxVariancePercent / 100) * r - maxVariancePercent / 100,
    ),
  );
  const jitterAmount = v * randomFactor;
  return (v + jitterAmount) as A;
});

export const applyDateJitter = E.Effect.fn("applyDateJitter")(function* <
  A extends E.DateTime.Utc,
>(v: A, maxDayVariance: number) {
  const randomDays = yield* E.Random.next.pipe(
    E.Effect.map((r) => 2 * maxDayVariance * r - maxDayVariance),
    E.Effect.map(Math.round),
  );

  return E.DateTime.add(v, {
    days: randomDays,
  });
});

export const daysBetweenDates = (
  a: E.DateTime.DateTime,
  b: E.DateTime.DateTime,
): number => {
  const dist = E.DateTime.distanceDurationEither(a, b);
  return E.Either.match(dist, {
    onLeft: (negV) => -E.Duration.toDays(negV),
    onRight: (posV) => E.Duration.toDays(posV),
  });
};

export const daysFromToday = E.Effect.fn("daysFromToday")(function* (
  when: E.DateTime.DateTime,
) {
  const now = yield* E.DateTime.now;
  const days = daysBetweenDates(now, when);

  return days;
});
