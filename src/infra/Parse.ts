import * as Platform from "@effect/platform";
import * as csv from "csv-parse/sync";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { CashEventSchema } from "../domain/Cash-Event.js";

export class CsvFileNotFoundError extends Data.TaggedError(
	"CsvFileNotFoundError",
)<{
	filename: string;
}> {}

export class CashEventDecodeError extends Data.TaggedError(
	"CashEventDecodeError",
)<{
	data: unknown;
}> {}

export type CsvError = CsvFileNotFoundError;

/**
 * Parse a CSV file and decode its contents using Effect Schema
 *
 * @param filename - Path to the CSV file
 * @param schema - Effect Schema for decoding rows
 * @param options - CSV parsing options
 * @returns Effect that resolves to an array of decoded objects
 */
export const parseCashEventsFromCsv = Effect.fn(function* (filename: string) {
	const fs = yield* Platform.FileSystem.FileSystem;

	return yield* fs.readFileString(filename).pipe(
		Effect.catchAll(() => Effect.fail(new CsvFileNotFoundError({ filename }))),
		Effect.map((csvStr) =>
			csv.parse(csvStr, {
				columns: true,
				skip_empty_lines: true,
				trim: true,
			}),
		),
		Effect.flatMap((rows) =>
			Effect.forEach(rows, (row) =>
				Effect.try({
					try: () => Schema.decodeUnknownSync(CashEventSchema)(row),
					catch: () =>
						new CashEventDecodeError({
							data: row,
						}),
				}),
			),
		),
	);
});
