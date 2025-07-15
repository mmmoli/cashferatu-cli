import * as cli from "@effect/cli";
import * as E from "effect";
import { readCsv } from "./Parse.js";

// const command = cli.Command.make("hello")

// export const run = cli.Command.run(command, {
//   name: "Hello World",
//   version: "0.0.0"
// })
//

// const cashEventsCsvPath = cli.Args.text({
//   name: "Path to Cash Event CSV",
// }).pipe(
//   cli.Args.withDescription("The path to the CSV file containing cash events"),
// );
//

const cashEventsCsvPathOption = cli.Options.file("pathToCashEventsCsv").pipe(
  cli.Options.withDescription(
    "The path to the CSV file containing cash events [default: ./var/cashevent-template.csv]",
  ),
  cli.Options.withDefault("./var/cashevent-template.csv"),
);

const listCommand = cli.Command.make(
  "list",
  {
    csvPath: cashEventsCsvPathOption,
  },
  ({ csvPath }) =>
    E.Effect.gen(function* (_) {
      yield* E.Console.log("Listing cash events in", csvPath);
      const cashEvents = yield* _(readCsv(csvPath));
      yield* E.Console.log("cash Events", cashEvents);
    }),
).pipe(cli.Command.withDescription("List all cash events"));
// .pipe(
//   cli.Command.withSubcommands([setMineCommand, removeMineCommand]),
// );

const command = cli.Command.make("cashferatu").pipe(
  cli.Command.withDescription("Devilishly smart financial forecasting."),
  cli.Command.withSubcommands([listCommand]),
);

export const run = cli.Command.run(command, {
  name: "Cashferatu",
  version: "0.1.0",
});
