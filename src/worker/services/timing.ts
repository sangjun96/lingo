export async function measure<T>(stage: string, task: () => Promise<T>, context: Record<string, string> = {}): Promise<T> {
	const start = performance.now();
	let ok = false;
	try {
		const result = await task();
		ok = true;
		return result;
	} finally {
		console.info(JSON.stringify({ event: 'latency', stage, ms: Math.round(performance.now() - start), ok, ...context }));
	}
}
