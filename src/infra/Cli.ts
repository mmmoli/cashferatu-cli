import * as cli from "@effect/cli";
import { Path } from "@effect/platform";
import * as Console from "effect/Console";
import * as Option from "effect/Option";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import { SimulationService } from "../services/Simulation-Service.js";
import { parseCashEventsFromCsv } from "./Parse.js";
import {
  listReportsFromFS,
  ReportFilenameGenerationService,
  saveSimulationReportToFS,
} from "./Persist.js";
import { renderReportToHTML, saveHtmlReportToFS } from "./Http.js";

const DEFAULT_CASH_EVENTS_CSV_PATH = "./var/cashevent-template.csv" as const;
const cashEventsCsvPathOption = cli.Options.file("pathToCashEventsCsv").pipe(
  cli.Options.withDescription(
    `The path to the CSV file containing cash events [default: ${DEFAULT_CASH_EVENTS_CSV_PATH}]`,
  ),
  cli.Options.withDefault(DEFAULT_CASH_EVENTS_CSV_PATH),
);

const DEFAULT_DATA_POINTS = 200;
const runCount = cli.Options.integer("runCount").pipe(
  cli.Options.withDescription(
    `The number of runs to simulate [default: ${DEFAULT_DATA_POINTS}]`,
  ),
  cli.Options.withDefault(DEFAULT_DATA_POINTS),
);

const DEFAULT_RUN_LENGTH = 120;
const runLength = cli.Options.integer("runLength").pipe(
  cli.Options.withDescription(
    `The number of days to project into the future [default: ${DEFAULT_RUN_LENGTH}]`,
  ),
  cli.Options.withDefault(DEFAULT_RUN_LENGTH),
);

const startingBalance = cli.Options.optional(
  cli.Options.integer("startingBalance").pipe(
    cli.Options.withDescription(`The number to start the balance [default: 0]`),
  ),
);

const DEFAULT_RUN_OUTPUT_PATH = "./simulations/" as const;
const runOutputDir = cli.Options.file("outputDir").pipe(
  cli.Options.withDescription(
    `The directory to output runs [default: ${DEFAULT_RUN_OUTPUT_PATH}]`,
  ),
  cli.Options.withDefault(DEFAULT_RUN_OUTPUT_PATH),
);

const simulationsCommand = cli.Command.make("simulations", {
  csvPath: cashEventsCsvPathOption,
  outputDir: runOutputDir,
}).pipe(cli.Command.withDescription("Manages simulation runs."));

const newSimulationCommand = cli.Command.make(
  "new",
  {
    runCount,
    runLength,
    startingBalance,
  },
  ({ runCount, runLength, startingBalance }) =>
    Effect.gen(function* (_) {
      const { outputDir } = yield* _(simulationsCommand);
      const { csvPath } = yield* _(simulationsCommand);
      const path = yield* Path.Path;
      const Simulation = yield* _(SimulationService);
      const generateFilename = yield* _(ReportFilenameGenerationService);
      const report = yield* _(
        parseCashEventsFromCsv(csvPath).pipe(
          Effect.andThen((events) =>
            Simulation.generate(events, {
              runCount,
              runLength,
              startingBalance: Option.getOrUndefined(startingBalance),
            }),
          ),
        ),
      );

      yield* pipe(
        Effect.succeed(generateFilename(report)),
        Effect.map((filename) => path.join(outputDir, filename)),
        Effect.tap((filePath) => saveSimulationReportToFS(report, filePath)),
        Effect.tap((filePath) =>
          Console.log(`done! Report saved as ${filePath}`),
        ),
      );

      yield* pipe(
        Effect.succeed(report),
        Effect.flatMap((report) => renderReportToHTML(report)),
        Effect.flatMap((html) =>
          saveHtmlReportToFS(html, `./html/${report.id}.html`),
        ),
        Effect.tap(() =>
          Console.log(`HTML here http://127.0.0.1:8080/${report.id}.html`),
        ),
      );
    }),
).pipe(cli.Command.withDescription("Runs a new simulation."));

const listSimulationCommand = cli.Command.make("list", {}, () =>
  Effect.gen(function* (_) {
    const { outputDir } = yield* _(simulationsCommand);
    const reports = yield* _(listReportsFromFS(outputDir));

    const metaDataForTable = reports.map((report) => ({
      id: report.id,
      runCount: report.meta.runCount,
      runLength: report.meta.runLength,
      runDate: report.meta.runDate.toString(),
    }));

    yield* _(Console.table(metaDataForTable));

    yield* _(Console.log(`Found ${reports.length} simulation reports.`));
  }),
).pipe(cli.Command.withDescription("Lists known Simulation reports."));

const command = cli.Command.make("cashferatu").pipe(
  cli.Command.withDescription("Devilishly smart financial forecasting."),
  cli.Command.withSubcommands([
    simulationsCommand.pipe(
      cli.Command.withSubcommands([
        newSimulationCommand,
        listSimulationCommand,
      ]),
    ),
  ]),
);

export const run = cli.Command.run(command, {
  name: "Cashferatu",
  version: "0.1.0",
});
