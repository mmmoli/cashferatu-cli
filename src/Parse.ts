import * as Platform from "@effect/platform";
import * as csv from "csv-parse/sync";
import * as E from "effect";
import * as Schema from "effect/Schema";

export class CsvFileNotFoundError extends E.Data.TaggedError(
  "CsvFileNotFoundError",
)<{
  filename: string;
}> {}

export class CashEventDecodeError extends E.Data.TaggedError(
  "CashEventDecodeError",
)<{
  data: unknown;
}> {}

export type CsvError = CsvFileNotFoundError;

export class CashEvent extends Schema.Class<CashEvent>("CashEvent")({
  ID: Schema.NonEmptyTrimmedString,
  label: Schema.NonEmptyTrimmedString,
  value: Schema.NumberFromString,
  date: Schema.DateFromString,
}) {}

/**
 * Parse a CSV file and decode its contents using Effect Schema
 *
 * @param filename - Path to the CSV file
 * @param schema - Effect Schema for decoding rows
 * @param options - CSV parsing options
 * @returns Effect that resolves to an array of decoded objects
 */

export const readCsv = (filename: string) =>
  E.Effect.gen(function* (_) {
    const fs = yield* Platform.FileSystem.FileSystem;

    return yield* _(
      fs.readFileString(filename).pipe(
        E.Effect.catchAll(() =>
          E.Effect.fail(new CsvFileNotFoundError({ filename })),
        ),
        E.Effect.map((csvStr) =>
          csv.parse(csvStr, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
          }),
        ),
        E.Effect.tap((v) => console.log("Parsed CSV:", v)),
        E.Effect.flatMap((rows) =>
          E.Effect.forEach(rows, (row) =>
            E.Effect.try({
              try: () => Schema.decodeUnknownSync(CashEvent)(row),
              catch: () =>
                new CashEventDecodeError({
                  data: row,
                }),
            }),
          ),
        ),
      ),
    );
  });
