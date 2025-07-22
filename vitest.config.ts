import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["./{test,src}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
		exclude: [],
		globals: true,
		coverage: {
			provider: "v8",
		},
	},
});
