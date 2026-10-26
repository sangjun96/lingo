import { DEFAULT_LANGUAGE, type Language } from '../../../shared/languages';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAgent } from 'agents/react';
import { initialConversation, type ConversationState } from '../../../shared/conversation';
import { readResponse, submitTurn } from './api';

export function useConversation(sessionId: string) {
	const base = `/agents/lingo-agent/${sessionId}`;
	const [state, setState] = useState<ConversationState>(initialConversation);
	const [connected, setConnected] = useState(false);
	const [loaded, setLoaded] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [partial, setPartial] = useState<{ turnId: string; text: string } | null>(null);
	const sending = useRef(false);
	const pending = useRef<{ id: string; replyTo: string | null; input: Blob | null; language: Language } | null>(null);
	const apply = useCallback((next: ConversationState) => {
		setState((current) => (next.revision >= current.revision ? { ...next, language: next.language ?? DEFAULT_LANGUAGE } : current));
		setLoaded(true);
	}, []);
	useAgent<ConversationState>({
		agent: 'LingoAgent',
		name: sessionId,
		onStateUpdate: apply,
		onOpen: () => setConnected(true),
		onClose: () => { setConnected(false); setPartial(null); },
		onMessage: (event) => {
			if (typeof event.data !== 'string') return;
			try {
				const data = JSON.parse(event.data);
				if (data.type === 'reply_partial' && typeof data.turnId === 'string' && typeof data.text === 'string' && data.text.length <= 600)
					setPartial({ turnId: data.turnId, text: data.text });
			} catch { /* Ignore SDK control frames and non-JSON messages. */ }
		},
	});

	useEffect(() => {
		if (loaded) return;
		// The WebSocket normally supplies initial state; HTTP is only a delayed fallback.
		const controller = new AbortController();
		const timer = setTimeout(() => {
			fetch(`${base}/state`, { signal: controller.signal })
				.then(readResponse<ConversationState>)
				.then(apply)
				.catch((cause: unknown) => {
					if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '대화를 불러오지 못했어요.');
				});
		}, 1500);
		return () => { clearTimeout(timer); controller.abort(); };
	}, [base, apply, loaded]);

	useEffect(() => {
		if (state.phase !== 'thinking') setPartial(null);
	}, [state.phase, state.activeTurnId]);

	const send = async (input: Blob | null, id = crypto.randomUUID(), language: Language = state.language) => {
		if (sending.current) return;
		sending.current = true;
		setSubmitting(true);
		setError(null);
		const request = { id, input, language, replyTo: state.turns.at(-1)?.id ?? null };
		pending.current = request;
		try {
			const next = await submitTurn(base, request.id, request.replyTo, request.input, request.language);
			apply(next);
			pending.current = null;
			return id;
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : '전송하지 못했어요.');
		} finally {
			sending.current = false;
			setSubmitting(false);
		}
	};

	const retrySend = async () => {
		const request = pending.current;
		if (!request || sending.current) return;
		sending.current = true;
		setSubmitting(true);
		setError(null);
		try {
			apply(await submitTurn(base, request.id, request.replyTo, request.input, request.language));
			pending.current = null;
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : '전송하지 못했어요.');
		} finally {
			sending.current = false;
			setSubmitting(false);
		}
	};

	const retry = async (kind: 'turn' | 'learning', id: string) => {
		setError(null);
		try {
			apply(await readResponse<ConversationState>(await fetch(`${base}/retry/${kind}/${encodeURIComponent(id)}`, { method: 'POST' })));
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : '다시 시도하지 못했어요.');
		}
	};

	return {
		base,
		state,
		partial: partial?.turnId === state.activeTurnId && state.phase === 'thinking' && !state.turns.at(-1)?.assistant ? partial.text : null,
		connected,
		loaded,
		submitting,
		error,
		send,
		retry,
		retrySend,
		canRetrySend: !!pending.current,
		clearError: () => setError(null),
	};
}
