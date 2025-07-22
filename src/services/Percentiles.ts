import * as Effect from "effect/Effect";
import type { PercentileDay, SimulationRun } from "../domain/Simulation.js";

export class GetPercentile extends Effect.Service<GetPercentile>()(
	"services/percentiles/GetPercentile",
	{
		sync: () => (sorted: number[], percentile: number) => {
			const idx = (percentile / 100) * (sorted.length - 1);
			const lower = Math.floor(idx);
			const upper = Math.ceil(idx);
			if (lower === upper) return sorted[lower];
			const weight = idx - lower;
			const result = sorted[lower] * (1 - weight) + sorted[upper] * weight;
			return parseFloat(result.toFixed(3));
		},
	},
) {}

export class ReduceToPercentiles extends Effect.Service<ReduceToPercentiles>()(
	"services/percentiles/ReduceToPercentiles",
	{
		dependencies: [GetPercentile.Default],
		effect: Effect.gen(function* () {
			return Effect.fn(function* (runs: SimulationRun[]) {
				const getPercentile = yield* GetPercentile;
				const runLength = runs[0]?.balanceSeries.length ?? 0;

				return Array.from({ length: runLength }, (_, dayIndex) => {
					const balancesAtDay = runs
						.map((run) => run.balanceSeries[dayIndex])
						.slice() // clone to avoid mutating original
						.sort((a, b) => a - b);

					return {
						day: dayIndex,
						p10: getPercentile(balancesAtDay, 10),
						p25: getPercentile(balancesAtDay, 25),
						p50: getPercentile(balancesAtDay, 50),
						p75: getPercentile(balancesAtDay, 75),
						p90: getPercentile(balancesAtDay, 90),
					} satisfies PercentileDay;
				});
			});
		}),
	},
) {}
