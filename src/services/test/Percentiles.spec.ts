import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { TestContext } from "effect/TestContext";
import type { SimulationRun } from "../../domain/Simulation.js";
import { GetPercentile, ReduceToPercentiles } from "../Percentiles.js";

const TestEnvironmentLayer = Layer.mergeAll(
	ReduceToPercentiles.Default,
	GetPercentile.Default,
	TestContext,
);

describe("Percentiles", () => {
	it.effect("should handle single run", () =>
		Effect.gen(function* (_) {
			const runs: SimulationRun[] = [
				{
					runIndex: 0,
					predictions: [],
					balanceSeries: [100, 150, 200],
				},
			];
			const reduceToPercentiles = yield* _(ReduceToPercentiles);
			const result = yield* _(reduceToPercentiles(runs));
			expect(result).toHaveLength(3);
			expect(result[0]).toEqual({
				day: 0,
				p10: 100,
				p25: 100,
				p50: 100,
				p75: 100,
				p90: 100,
			});
		}).pipe(Effect.provide(TestEnvironmentLayer)),
	);
});
