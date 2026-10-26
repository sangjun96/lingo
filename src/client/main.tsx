import { StrictMode, useState } from 'react';
import type { FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

function App() {
  const [prompt, setPrompt] = useState('안녕! 한국어로 간단히 자기소개해줘.');
  const [result, setResult] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setResult('');
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json() as { text?: string; error?: string };
      setResult(response.ok ? data.text ?? '' : data.error ?? '요청에 실패했습니다.');
    } catch {
      setResult('서버에 연결하지 못했습니다.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main>
      <h1>Lingo</h1>
      <p>Gemini 연결 테스트</p>
      <form onSubmit={submit}>
        <label htmlFor="prompt">프롬프트</label>
        <textarea id="prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} required maxLength={4000} rows={5} />
        <button disabled={pending || !prompt.trim()}>{pending ? '응답 기다리는 중…' : '보내기'}</button>
      </form>
      <output aria-live="polite">{result}</output>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
