import * as Schema from "effect/Schema";

export class CashEvent extends Schema.Class<CashEvent>("CashEvent")({
	ID: Schema.NonEmptyTrimmedString,
	label: Schema.NonEmptyTrimmedString,
	value: Schema.NumberFromString,
	date: Schema.DateFromString,
}) {}
