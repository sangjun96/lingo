import { bindings, defineConfig, exports } from "cf/config";
import * as entrypoint from "./src/worker/index.ts" with { type: "cf-worker" };

const localAuthDbId = "00000000-0000-0000-0000-000000000001";

export default defineConfig(({ mode }) => ({
	worker: {
		name: "lingo",
		compatibilityDate: "2026-10-26",
		compatibilityFlags: [
			"nodejs_compat",
		],
		entrypoint,
		domains: ["lingo.promptpointer.dev"],
		observability: {
			enabled: true,
			traces: {
				enabled: true,
				headSamplingRate: 0.01,
			},
		},
		assets: {
			notFoundHandling: "single-page-application",
			runWorkerFirst: true,
		},
		exports: {
			LingoAgent: exports.durableObject({ storage: "sqlite" }),
		},
		env: {
			GEMINI_API_KEY: bindings.secret(),
			BETTER_AUTH_SECRET: bindings.secret(),
			AUTH_DB: bindings.d1({
				name: "lingo-auth",
				id: process.env.AUTH_DB_ID || (mode === "development" ? localAuthDbId : undefined),
			}),
			ASSETS: bindings.assets(),
			AUDIO_BUCKET: bindings.r2({
				name: "lingo-audio",
			}),
			LingoAgent: bindings.durableObject({
				worker: "lingo",
				exportName: "LingoAgent",
			}),
		},
	},
}));
