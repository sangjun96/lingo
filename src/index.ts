import { GoogleGenAI } from '@google/genai';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { validator } from 'hono/validator';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/health', (c) => c.json({ status: 'ok' }));

app.post(
  '/api/generate',
  bodyLimit({ maxSize: 16 * 1024 }),
  validator('json', (value, c) => {
    if (typeof value?.prompt !== 'string' || !value.prompt.trim() || value.prompt.length > 4000) {
      return c.json({ error: '프롬프트는 1~4000자의 문자열이어야 합니다.' }, 400);
    }
    return { prompt: value.prompt.trim() };
  }),
  async (c) => {
    const { GEMINI_API_KEY, GEMINI_MODEL } = c.env;
    if (!GEMINI_API_KEY) {
      return c.json({ error: '서버의 GEMINI_API_KEY를 설정해주세요.' }, 503);
    }
    const ai = new GoogleGenAI({
      apiKey: GEMINI_API_KEY,
      httpOptions: {
        timeout: 30_000,
      },
    });
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: c.req.valid('json').prompt,
        config: { maxOutputTokens: 1024 },
      });
      return c.json({ text: response.text ?? '' });
    } catch {
      console.error(JSON.stringify({ message: 'Gemini request failed' }));
      return c.json({ error: 'AI 응답을 가져오지 못했습니다. 잠시 후 다시 시도해주세요.' }, 502);
    }
  },
);

app.notFound((c) => c.json({ error: 'Not found' }, 404));
export default app;
