import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		cloudflareTest({
			main: './src/worker/index.ts',
			wrangler: { configPath: './wrangler.jsonc' },
			miniflare: { bindings: { GEMINI_API_KEY: 'test-only-key' } },
		}),
	],
});
