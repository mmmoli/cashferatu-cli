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
  const labels = report.forecast.map((f) => `Day ${f.day}`);
  const p10 = report.forecast.map((f) => f.p10);
  const p25 = report.forecast.map((f) => f.p25);
  const p50 = report.forecast.map((f) => f.p50);
  const p75 = report.forecast.map((f) => f.p75);
  const p90 = report.forecast.map((f) => f.p90);

  const chartData = {
    labels,
    datasets: [
      {
        label: "P10",
        data: p10,
        borderColor: "rgba(255, 99, 132, 1)",
        fill: false,
        tension: 0.1,
      },
      {
        label: "P25",
        data: p25,
        borderColor: "rgba(255, 159, 64, 1)",
        fill: false,
        tension: 0.1,
      },
      {
        label: "P50",
        data: p50,
        borderColor: "rgba(255, 205, 86, 1)",
        fill: false,
        tension: 0.1,
      },
      {
        label: "P75",
        data: p75,
        borderColor: "rgba(75, 192, 192, 1)",
        fill: false,
        tension: 0.1,
      },
      {
        label: "P90",
        data: p90,
        borderColor: "rgba(54, 162, 235, 1)",
        fill: false,
        tension: 0.1,
      },
    ],
  };

  const html = `
  <html>
    <head>
      <title>Simulation Report</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <style>
        body { font-family: sans-serif; padding: 1rem; }
        pre { background: #f0f0f0; padding: 1rem; border-radius: 8px; }
        canvas { max-width: 100%; height: 400px; }
      </style>
    </head>
    <body>
      <h1>Simulation Report</h1>
      <canvas id="forecastChart"></canvas>
      <script>
        const ctx = document.getElementById('forecastChart').getContext('2d');
        const chart = new Chart(ctx, {
          type: 'line',
          data: ${JSON.stringify(chartData)},
          options: {
            responsive: true,
            scales: {
              y: { beginAtZero: true }
            }
          }
        });
      </script>
      <h2>Raw Report</h2>
      <pre>${JSON.stringify(report, null, 2)}</pre>
    </body>
  </html>
  `;

  return yield* Effect.succeed(html).pipe(
    Effect.flatMap((html) =>
      Schema.decodeUnknown(SimulationReportHTMLSchema)(html),
    ),
  );
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
