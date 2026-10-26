import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ConversationPage } from './features/conversation/conversation-page';
import { loadSessionId, newSessionId } from './features/conversation/api';
import { getAuthSession, signOut } from './lib/auth-api';
import { SignInPage } from './features/auth/sign-in-page';
import './style.css';

function App() {
	const [userId, setUserId] = useState<string | null>();
	const [sessionId, setSessionId] = useState<string | null>(null);

	useEffect(() => {
		getAuthSession()
			.then((session) => setUserId(session?.user.id ?? null))
			.catch(() => setUserId(null));
	}, []);

	useEffect(() => {
		setSessionId(userId ? loadSessionId(userId) : null);
	}, [userId]);

	if (userId === undefined || (userId && !sessionId))
		return <main className="grid min-h-dvh place-items-center text-sm text-muted-foreground">불러오는 중…</main>;
	if (!userId)
		return (
			<SignInPage
				onSignedIn={async () => {
					const session = await getAuthSession();
					if (!session) throw new Error('로그인 정보를 확인하지 못했어요. 다시 시도해 주세요.');
					setUserId(session.user.id);
				}}
			/>
		);

	return (
		<ConversationPage
			key={sessionId}
			sessionId={sessionId!}
			onNew={() => setSessionId(newSessionId(userId))}
			onSignOut={async () => {
				await signOut();
				setUserId(null);
			}}
		/>
	);
}

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
