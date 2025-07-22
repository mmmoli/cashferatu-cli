import { Path } from "@effect/platform";
import * as Platform from "@effect/platform";
import * as Effect from "effect/Effect";
import * as Data from "effect/Data";
import type { SimulationReport } from "../domain/Simulation.js";

export class DirectoryDoesNotExistError extends Data.TaggedError(
  "DirectoryDoesNotExistError",
)<{
  location: string;
  originalError: Error;
}> {}

export class SaveReportError extends Data.TaggedError("SaveReportError")<{
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
export const saveSimulationReportToFS = Effect.fn(function* (
  report: SimulationReport,
  location: string,
) {
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
});

export class ReportFilenameGenerationService extends Effect.Service<ReportFilenameGenerationService>()(
  "infra/Persist/ReportFilenameGenerationService",
  {
    sync:
      () =>
      ({ id }: SimulationReport) =>
        `simulation-${id}.json`,
  },
) {}
