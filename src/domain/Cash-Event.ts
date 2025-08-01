import * as Schema from "effect/Schema";

export const CashEventId = Schema.NonEmptyTrimmedString.pipe(
  Schema.brand("CashEventId"),
);

export const CashEventSchema = Schema.Struct({
  ID: CashEventId,
  label: Schema.NonEmptyTrimmedString,
  value: Schema.Union(Schema.Number, Schema.NumberFromString),
  date: Schema.DateFromString,
});

export type CashEvent = typeof CashEventSchema.Type;
