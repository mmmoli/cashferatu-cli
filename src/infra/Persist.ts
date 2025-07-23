import * as Platform from "@effect/platform";
import { Path } from "@effect/platform";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import {
	type SimulationReport,
	SimulationReportSchema,
} from "../domain/Simulation.js";

export class DirectoryDoesNotExistError extends Data.TaggedError(
	"DirectoryDoesNotExistError",
)<{
	location: string;
	originalError: Error;
}> {}

export class SaveReportError extends Data.TaggedError(
	"infra/Persist/SaveReportError",
)<{
	location: string;
	originalError: Error;
}> {}

/**
 * Saves a simulation report to a file system location.
 *
 * @param report - Simulation report to save
 * @param location - Path to the file system location
 * @returns Effect that resolves to the saved report
 */
export const saveSimulationReportToFS = Effect.fn("saveSimulationReportToFS")(
	function* (report: SimulationReport, location: string) {
		const path = yield* Path.Path;
		const fs = yield* Platform.FileSystem.FileSystem;
		const json = JSON.stringify(report, null, 2);
		yield* fs.writeFileString(location, json).pipe(
			Effect.catchTag("SystemError", (err) => {
				if (err.reason === "NotFound") {
					const dir = path.dirname(location);
					fs.makeDirectory(dir, { recursive: true }).pipe(
						Effect.flatMap(() => fs.writeFileString(location, json)),
					);
					return Effect.succeed(void 0);
				}
				return Effect.fail(
					new SaveReportError({
						location,
						originalError: err,
					}),
				);
			}),
			Effect.catchAll((err) =>
				Effect.fail(
					new SaveReportError({
						location,
						originalError: err as Error,
					}),
				),
			),
		);
		return location;
	},
);

export class ReportFilenameGenerationService extends Effect.Service<ReportFilenameGenerationService>()(
	"infra/Persist/ReportFilenameGenerationService",
	{
		sync:
			() =>
			({ id }: SimulationReport) =>
				`simulation-${id}.json`,
	},
) {}

export class ReadReportsError extends Data.TaggedError(
	"infra/Persist/ReadReportsError",
)<{
	readonly filename: string;
	readonly originalError: Error;
}> {}

export const listReportsFromFS = Effect.fn("listReportsFromFS")(function* (
	directory: string,
) {
	const fs = yield* Platform.FileSystem.FileSystem;
	const path = yield* Platform.Path.Path;
	const decoder = Schema.decodeUnknownSync(SimulationReportSchema);

	const files = yield* fs
		.readDirectory(directory)
		.pipe(Effect.map((files) => files.filter((f) => f.endsWith(".json"))));

	const decodedReports = yield* Effect.forEach(
		files,
		(filename) => {
			const fullPath = path.join(directory, filename);
			return fs.readFileString(fullPath).pipe(
				Effect.map((contents) => decoder(contents)),
				Effect.catchAll((err) =>
					// Catch both file system errors and schema parsing errors
					Effect.fail(
						new ReadReportsError({
							filename,
							originalError: err as Error,
						}),
					),
				),
			);
		},
		{ concurrency: "unbounded" }, // Consider concurrency for file reads
	);

	return decodedReports;
});
