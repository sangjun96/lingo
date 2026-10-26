import { useCallback, useEffect, useRef, useState } from 'react';

export function useAudioPlayer(base: string) {
	const active = useRef<{ audio?: HTMLAudioElement; url?: string; controller: AbortController } | null>(null);
	const [playingId, setPlayingId] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const stop = useCallback(() => {
		active.current?.controller.abort();
		active.current?.audio?.pause();
		if (active.current?.url) URL.revokeObjectURL(active.current.url);
		active.current = null;
		setPlayingId(null);
		setLoading(false);
	}, []);

	const play = useCallback(
		async (id: string) => {
			stop();
			setError(null);
			setPlayingId(id);
			setLoading(true);
			const playback = {
				controller: new AbortController(),
				audio: undefined as HTMLAudioElement | undefined,
				url: undefined as string | undefined,
			};
			active.current = playback;
			try {
				const response = await fetch(`${base}/audio/${encodeURIComponent(id)}`, { signal: playback.controller.signal });
				if (!response.ok) {
					const data = (await response.json()) as { error?: string };
					throw new Error(data.error || '음성을 불러오지 못했어요.');
				}
				const blob = await response.blob();
				if (playback.controller.signal.aborted) return;
				playback.url = URL.createObjectURL(blob);
				playback.audio = new Audio(playback.url);
				playback.audio.onended = stop;
				playback.audio.onerror = () => {
					if (active.current === playback) {
						stop();
						setError('음성을 재생하지 못했어요. 다시 듣기를 눌러 주세요.');
					}
				};
				await playback.audio.play();
				if (active.current === playback) setLoading(false);
			} catch (cause) {
				if (!playback.controller.signal.aborted && active.current === playback) {
					stop();
					setError(
						cause instanceof Error && cause.name !== 'NotAllowedError'
							? cause.message
							: '브라우저가 자동 재생을 막았어요. 듣기 버튼을 눌러 주세요.',
					);
				}
			}
		},
		[base, stop],
	);

	useEffect(() => stop, [stop]);
	return { playingId, loading, error, play, stop, clearError: () => setError(null) };
}

export type AudioPlayer = ReturnType<typeof useAudioPlayer>;
