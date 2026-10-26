import { useEffect, useRef, useState } from 'react';
import { MAX_AUDIO_BYTES, MAX_RECORDING_SECONDS } from '../../../shared/conversation';

export function useRecorder(onRecorded: (blob: Blob) => void) {
	const [status, setStatus] = useState<'idle' | 'requesting' | 'recording'>('idle');
	const [seconds, setSeconds] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const recorder = useRef<MediaRecorder | null>(null);
	const stream = useRef<MediaStream | null>(null);
	const timer = useRef<ReturnType<typeof setInterval> | null>(null);
	const cancelled = useRef(false);
	const requesting = useRef(false);
	const callback = useRef(onRecorded);
	callback.current = onRecorded;

	const release = () => {
		if (timer.current) clearInterval(timer.current);
		timer.current = null;
		stream.current?.getTracks().forEach((track) => track.stop());
		stream.current = null;
	};
	const stop = (discard = false) => {
		cancelled.current = discard;
		if (recorder.current?.state === 'recording') recorder.current.stop();
		else release();
	};

	const start = async () => {
		if (requesting.current || recorder.current?.state === 'recording') return;
		if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
			setError('이 브라우저에서는 녹음을 지원하지 않아요.');
			return;
		}
		requesting.current = true;
		cancelled.current = false;
		setError(null);
		setSeconds(0);
		setStatus('requesting');
		try {
			const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
			if (cancelled.current) {
				media.getTracks().forEach((track) => track.stop());
				return;
			}
			stream.current = media;
			const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find((type) => MediaRecorder.isTypeSupported(type));
			if (!mimeType) throw new Error('지원하는 녹음 형식을 찾지 못했어요.');
			const instance = new MediaRecorder(media, { mimeType, audioBitsPerSecond: 64_000 });
			recorder.current = instance;
			const chunks: Blob[] = [];
			let bytes = 0;
			instance.ondataavailable = (event) => {
				chunks.push(event.data);
				bytes += event.data.size;
				if (bytes > MAX_AUDIO_BYTES) {
					cancelled.current = true;
					setError('녹음이 너무 커요. 더 짧게 말해 주세요.');
					if (instance.state === 'recording') instance.stop();
				}
			};
			instance.onerror = () => {
				cancelled.current = true;
				setError('녹음이 중단됐어요. 마이크 연결을 확인해 주세요.');
				release();
				setStatus('idle');
			};
			instance.onstop = () => {
				release();
				setStatus('idle');
				const blob = new Blob(chunks, { type: mimeType });
				if (!cancelled.current && blob.size > 0) callback.current(blob);
			};
			instance.start(1000);
			setStatus('recording');
			const started = Date.now();
			timer.current = setInterval(() => {
				const elapsed = Math.floor((Date.now() - started) / 1000);
				setSeconds(elapsed);
				if (elapsed >= MAX_RECORDING_SECONDS) stop();
			}, 250);
		} catch (cause) {
			release();
			setStatus('idle');
			setError(
				cause instanceof DOMException && cause.name === 'NotAllowedError'
					? '마이크 사용을 허용해 주세요.'
					: cause instanceof Error
						? cause.message
						: '마이크를 시작하지 못했어요.',
			);
		} finally {
			requesting.current = false;
		}
	};

	useEffect(
		() => () => {
			cancelled.current = true;
			if (recorder.current?.state === 'recording') recorder.current.stop();
			release();
		},
		[],
	);
	return { status, seconds, error, start, stop, clearError: () => setError(null) };
}
