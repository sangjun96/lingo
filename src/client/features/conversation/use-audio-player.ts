import { useCallback, useEffect, useRef, useState } from 'react';
import { PCM_SAMPLE_RATE, readPcm } from '../../../shared/audio';

type Playback = {
	controller: AbortController;
	sources: Set<AudioBufferSourceNode>;
	done: boolean;
};

export function useAudioPlayer(base: string) {
	const context = useRef<AudioContext | null>(null);
	const active = useRef<Playback | null>(null);
	const [playingId, setPlayingId] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const stop = useCallback(() => {
		const playback = active.current;
		active.current = null;
		playback?.controller.abort();
		playback?.sources.forEach((source) => source.stop());
		setPlayingId(null);
		setLoading(false);
	}, []);

	// Called from the record/start/listen gesture, before asynchronous network work.
	const unlock = useCallback(() => {
		context.current ??= new AudioContext();
		return context.current.resume();
	}, []);

	const play = useCallback(async (id: string) => {
		stop();
		setError(null);
		setPlayingId(id);
		setLoading(true);
		const playback: Playback = { controller: new AbortController(), sources: new Set(), done: false };
		active.current = playback;
		try {
			await unlock();
			if (active.current !== playback) return;
			const audio = context.current!;
			if (audio.state !== 'running') throw new Error('브라우저가 자동 재생을 막았어요. 듣기 버튼을 눌러 주세요.');
			const started = performance.now();
			let nextTime = audio.currentTime + 0.03;
			let first = true;
			const schedule = (buffer: AudioBuffer) => {
				if (active.current !== playback) return;
				const source = audio.createBufferSource();
				source.buffer = buffer;
				source.connect(audio.destination);
				playback.sources.add(source);
				source.onended = () => {
					source.disconnect();
					playback.sources.delete(source);
					if (active.current === playback && playback.done && !playback.sources.size) stop();
				};
				nextTime = Math.max(nextTime, audio.currentTime + 0.03);
				source.start(nextTime);
				nextTime += buffer.duration;
				if (first) {
					console.info(JSON.stringify({ event: 'latency', stage: 'audio_first_playback', expressionId: id, ms: Math.round(performance.now() - started) }));
					setLoading(false);
					first = false;
				}
			};
			const response = await fetch(`${base}/audio/${encodeURIComponent(id)}`, { signal: playback.controller.signal });
			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error || '음성을 불러오지 못했어요.');
			}
			if (response.headers.get('Content-Type')?.startsWith('audio/pcm')) {
				if (!response.body) throw new Error('음성을 불러오지 못했어요.');
				for await (const samples of readPcm(response.body)) {
					if (playback.controller.signal.aborted) return;
					const buffer = audio.createBuffer(1, samples.length, PCM_SAMPLE_RATE);
					buffer.copyToChannel(samples, 0);
					schedule(buffer);
				}
			} else {
				// Existing R2/SQLite and HTTP-cached WAV files remain playable.
				const buffer = await audio.decodeAudioData(await response.arrayBuffer());
				schedule(buffer);
			}
			playback.done = true;
			if (active.current === playback && !playback.sources.size) stop();
		} catch (cause) {
			if (!playback.controller.signal.aborted && active.current === playback) {
				stop();
				setError(cause instanceof Error && cause.name !== 'NotAllowedError'
					? cause.message : '브라우저가 자동 재생을 막았어요. 듣기 버튼을 눌러 주세요.');
			}
		}
	}, [base, stop, unlock]);

	useEffect(() => () => {
		stop();
		void context.current?.close();
		context.current = null;
	}, [stop]);
	return { playingId, loading, error, play, stop, unlock, clearError: () => setError(null) };
}

export type AudioPlayer = ReturnType<typeof useAudioPlayer>;
