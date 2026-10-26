import { bindings, defineConfig, exports } from "cf/config";
import * as entrypoint from "./src/worker/index.ts" with { type: "cf-worker" };

export default defineConfig({
	worker: {
		name: "lingo",
		compatibilityDate: "2026-10-26",
		compatibilityFlags: [
			"nodejs_compat",
		],
		entrypoint,
		observability: {
			enabled: true,
			traces: {
				enabled: true,
				headSamplingRate: 0.01,
			},
		},
		assets: {
			notFoundHandling: "single-page-application",
			runWorkerFirst: [
				"/api",
				"/api/*",
				"/agents",
				"/agents/*",
			],
		},
		exports: {
			LingoAgent: exports.durableObject({ storage: "sqlite" }),
		},
		env: {
			GEMINI_API_KEY: bindings.secret(),
			AUDIO_BUCKET: bindings.r2({
				name: "lingo-audio",
			}),
			LingoAgent: bindings.durableObject({
				worker: "lingo",
				exportName: "LingoAgent",
			}),
		},
	},
});
