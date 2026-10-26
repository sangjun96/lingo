export const PCM_SAMPLE_RATE = 24_000;
export const MAX_GENERATED_AUDIO_BYTES = 2_000_000;

// Gemini streaming L16 is signed little-endian, mono PCM, not network-order L16.
export function pcmSamples(bytes: Uint8Array): Float32Array<ArrayBuffer> {
	if (bytes.length % 2) throw new Error('Incomplete PCM sample');
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	return Float32Array.from({ length: bytes.length / 2 }, (_, i) => view.getInt16(i * 2, true) / 32768);
}

export async function* readPcm(body: ReadableStream<Uint8Array>) {
	const reader = body.getReader();
	let tail: number | undefined;
	let total = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.length;
			if (total > MAX_GENERATED_AUDIO_BYTES) throw new Error('Audio is too large');
			let bytes = value;
			if (tail !== undefined) {
				bytes = new Uint8Array(value.length + 1);
				bytes[0] = tail;
				bytes.set(value, 1);
			}
			tail = bytes.length % 2 ? bytes[bytes.length - 1] : undefined;
			const length = bytes.length - bytes.length % 2;
			if (length) yield pcmSamples(bytes.subarray(0, length));
		}
		if (!total || tail !== undefined) throw new Error('Incomplete audio stream');
	} finally {
		await reader.cancel().catch(() => {});
		reader.releaseLock();
	}
}

export function pcmToWav(chunks: Uint8Array[]): Uint8Array {
	const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
	if (!size || size % 2 || size > MAX_GENERATED_AUDIO_BYTES) throw new Error('Invalid PCM length');
	const wav = new Uint8Array(44 + size);
	const view = new DataView(wav.buffer);
	const text = (offset: number, value: string) => wav.set(new TextEncoder().encode(value), offset);
	text(0, 'RIFF');
	view.setUint32(4, size + 36, true);
	text(8, 'WAVE');
	text(12, 'fmt ');
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, PCM_SAMPLE_RATE, true);
	view.setUint32(28, PCM_SAMPLE_RATE * 2, true);
	view.setUint16(32, 2, true);
	view.setUint16(34, 16, true);
	text(36, 'data');
	view.setUint32(40, size, true);
	let offset = 44;
	for (const chunk of chunks) {
		wav.set(chunk, offset);
		offset += chunk.length;
	}
	return wav;
}
