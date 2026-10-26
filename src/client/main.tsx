import { StrictMode, useState } from 'react';
import type { FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
    <main className="mx-auto my-16 max-w-160 px-6">
      <h1 className="text-3xl font-bold">Lingo</h1>
      <p className="mt-2 mb-6 text-muted-foreground">Gemini 연결 테스트</p>
      <form className="grid gap-3" onSubmit={submit}>
        <label className="text-sm font-medium" htmlFor="prompt">프롬프트</label>
        <Textarea id="prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} required maxLength={4000} rows={5} />
        <Button type="submit" disabled={pending || !prompt.trim()}>{pending ? '응답 기다리는 중…' : '보내기'}</Button>
      </form>
      <output className="mt-6 block whitespace-pre-wrap" aria-live="polite">{result}</output>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
