import * as Platform from "@effect/platform";
import type { SimulationReport } from "../domain/Simulation.js";
import * as Effect from "effect/Effect";
import * as Data from "effect/Data";
import * as Schema from "effect/Schema";

export const SimulationReportHTMLSchema = Schema.String.pipe(
  Schema.brand("SimulationReportHTML"),
);
export type SimulationReportHTML = typeof SimulationReportHTMLSchema.Type;

export const renderReportToHTML = Effect.fn("renderReportToHTML")(function* (
  report: SimulationReport,
) {
  return yield* Schema.decodeUnknown(SimulationReportHTMLSchema)(`
    <html>
      <head>
        <title>Simulation Report</title>
      </head>
      <body>
        <h1>Simulation Report</h1>
        <pre>${JSON.stringify(report, null, 2)}</pre>
      </body>
    </html>
  `);
});

export class SaveHTMLReportError extends Data.TaggedError(
  "infra/Http/SaveHTMLReportError",
)<{
  location: string;
  originalError: Error;
}> {}

export const saveHtmlReportToFS = Effect.fn("saveHtmlReportToFS")(function* (
  report: SimulationReportHTML,
  filePath: string,
) {
  const fs = yield* Platform.FileSystem.FileSystem;
  const path = yield* Platform.Path.Path;
  yield* fs.writeFileString(filePath, report).pipe(
    Effect.catchTag("SystemError", (err) => {
      if (err.reason === "NotFound") {
        const dir = path.dirname(filePath);
        fs.makeDirectory(dir, { recursive: true }).pipe(
          Effect.flatMap(() => fs.writeFileString(filePath, report)),
        );
        return Effect.succeed(void 0);
      }
      return Effect.fail(
        new SaveHTMLReportError({
          location: filePath,
          originalError: err,
        }),
      );
    }),
    Effect.catchAll((err) =>
      Effect.fail(
        new SaveHTMLReportError({
          location: filePath,
          originalError: err as Error,
        }),
      ),
    ),
  );
  return filePath;
});
