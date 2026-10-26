import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ConversationPage } from './features/conversation/conversation-page';
import { loadSessionId, newSessionId } from './features/conversation/api';
import './style.css';

function App() {
	const [sessionId, setSessionId] = useState(loadSessionId);
	return <ConversationPage key={sessionId} sessionId={sessionId} onNew={() => setSessionId(newSessionId())} />;
}

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
