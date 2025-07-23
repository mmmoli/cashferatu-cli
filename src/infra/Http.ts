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

  const html = `
  <html>
    <head>
      <title>Cashferatu Forecast</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <style>
        body {
          font-family: 'Georgia', serif;
          background: #fffaf8;
          color: #1e1b18;
          padding: 2rem;
          line-height: 1.6;
        }
        h1 {
          font-family: 'Gothic A1', sans-serif;
          font-weight: 600;
          color: crimson;
        }
        canvas {
          max-width: 100%;
          height: 400px;
          margin-bottom: 2rem;
        }
        pre {
          background: #f7f2ef;
          padding: 1rem;
          border-radius: 8px;
          font-size: 0.85rem;
          overflow-x: auto;
        }
      </style>
    </head>
    <body>
      <h1>Cashferatu Forecast</h1>
      <canvas id="forecastChart"></canvas>
      <script>
        const ctx = document.getElementById('forecastChart').getContext('2d');
        const chart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: ${JSON.stringify(labels)},
            datasets: [
              {
                label: "Fog Start (P10)",
                data: ${JSON.stringify(p10)},
                borderColor: "transparent",
                backgroundColor: "rgba(100, 100, 100, 0.15)",
                fill: "+1",
                pointRadius: 0,
                tension: 0.3
              },
              {
                label: "Fog End (P90)",
                data: ${JSON.stringify(p90)},
                borderColor: "transparent",
                backgroundColor: "rgba(100, 100, 100, 0.15)",
                fill: false,
                pointRadius: 0,
                tension: 0.3
              },
              {
                label: "Candlelight Start (P25)",
                data: ${JSON.stringify(p25)},
                borderColor: "transparent",
                backgroundColor: "rgba(255, 205, 86, 0.2)",
                fill: "+1",
                pointRadius: 0,
                tension: 0.3
              },
              {
                label: "Candlelight End (P75)",
                data: ${JSON.stringify(p75)},
                borderColor: "transparent",
                backgroundColor: "rgba(255, 205, 86, 0.2)",
                fill: false,
                pointRadius: 0,
                tension: 0.3
              },
              {
                label: "🩸 Blood Median (P50)",
                data: ${JSON.stringify(p50)},
                borderColor: "crimson",
                backgroundColor: "transparent",
                borderWidth: 2,
                pointRadius: 3,
                fill: false,
                tension: 0.3
              }
            ]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { position: 'bottom' },
              tooltip: { mode: 'index', intersect: false },
            },
            interaction: {
              mode: 'nearest',
              axis: 'x',
              intersect: false
            },
            scales: {
              y: {
                beginAtZero: true,
                title: { display: true, text: 'Balance (£)' }
              },
              x: {
                title: { display: true, text: 'Day' }
              }
            }
          }
        });
      </script>
      <h2>Raw Simulation Report</h2>
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
