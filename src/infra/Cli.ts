import * as cli from "@effect/cli";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { SimulationService } from "../services/Simulation-Service.js";
import { parseCashEventsFromCsv } from "./Parse.js";

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

const DEFAULT_RUN_OUTPUT_PATH = "./var/" as const;
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
	},
	({ runCount, runLength }) =>
		Effect.gen(function* (_) {
			const { csvPath } = yield* _(simulationsCommand);
			const Simulation = yield* _(SimulationService);
			yield* _(
				parseCashEventsFromCsv(csvPath).pipe(
					Effect.andThen((events) =>
						Simulation.generate(events, {
							runCount,
							runLength,
						}),
					),
					Effect.tap((report) => Console.log("report", report)),
				),
			);

			yield* Console.log("YO");
		}),
).pipe(cli.Command.withDescription("Runs a new simulation."));

const command = cli.Command.make("cashferatu").pipe(
	cli.Command.withDescription("Devilishly smart financial forecasting."),
	cli.Command.withSubcommands([
		simulationsCommand.pipe(
			cli.Command.withSubcommands([newSimulationCommand]),
		),
	]),
);

export const run = cli.Command.run(command, {
	name: "Cashferatu",
	version: "0.1.0",
});
