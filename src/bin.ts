#!/usr/bin/env node

import * as NodeContext from "@effect/platform-node/NodeContext";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { run } from "./infra/Cli.js";
import { GetPercentile } from "./services/Percentiles.js";
import { SimulationService } from "./services/Simulation-Service.js";

run(process.argv).pipe(
	Effect.provide(
		Layer.mergeAll(
			NodeContext.layer,
			SimulationService.Default,
			GetPercentile.Default,
		),
	),
	NodeRuntime.runMain({ disableErrorReporting: true }),
);
