import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		cloudflareTest({
			main: './src/worker/index.ts',
			miniflare: {
				compatibilityDate: '2026-10-26',
				compatibilityFlags: ['nodejs_compat'],
				bindings: { GEMINI_API_KEY: 'test-only-key' },
				durableObjects: { LingoAgent: { className: 'LingoAgent', useSQLite: true } },
				r2Buckets: { AUDIO_BUCKET: 'lingo-audio' },
			},
		}),
	],
});
