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
	const sending = useRef(false);
	const pending = useRef<{ id: string; replyTo: string | null; input: Blob | null } | null>(null);
	const apply = useCallback((next: ConversationState) => {
		setState((current) => (next.revision >= current.revision ? next : current));
		setLoaded(true);
	}, []);
	useAgent<ConversationState>({
		agent: 'LingoAgent',
		name: sessionId,
		onStateUpdate: apply,
		onOpen: () => setConnected(true),
		onClose: () => setConnected(false),
	});

	useEffect(() => {
		const controller = new AbortController();
		fetch(`${base}/state`, { signal: controller.signal })
			.then(readResponse<ConversationState>)
			.then(apply)
			.catch((cause: unknown) => {
				if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '대화를 불러오지 못했어요.');
			});
		return () => controller.abort();
	}, [base, apply]);

	const send = async (input: Blob | null, id = crypto.randomUUID()) => {
		if (sending.current) return;
		sending.current = true;
		setSubmitting(true);
		setError(null);
		const request = { id, input, replyTo: state.turns.at(-1)?.id ?? null };
		pending.current = request;
		try {
			const next = await submitTurn(base, request.id, request.replyTo, request.input);
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
			apply(await submitTurn(base, request.id, request.replyTo, request.input));
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
