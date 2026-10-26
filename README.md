# Lingo

React + Vite 프런트엔드와 Hono API를 하나의 Cloudflare Worker에서 실행합니다.
서버의 공식 Gemini SDK(`@google/genai`)가 Gemini API 키로 Google API를 직접 호출합니다.
Node.js 24 이상과 npm을 사용합니다.

## 로컬 실행

```sh
npm ci
cp .dev.vars.example .dev.vars
```

`.dev.vars`에 다음 값을 직접 입력합니다. API 키는 채팅이나 Git에 올리지 않습니다.

| 변수 | 값 |
| --- | --- |
| `GEMINI_API_KEY` | Google AI Studio에서 발급한 Gemini API 키 |

Gemini API 키는 [Google AI Studio](https://aistudio.google.com/apikey)에서 발급합니다.

```sh
npm run dev
```

터미널에 표시된 주소에서 Gemini 연결 테스트 화면을 엽니다.
키가 없어도 화면과 `/api/health`는 동작하며, 생성 API는 503을 반환합니다.
기본 모델은 `wrangler.jsonc`의 `GEMINI_MODEL`(`gemini-3.8-flash`)로 지정합니다.
로컬에서는 `.dev.vars`에 `GEMINI_MODEL`을 추가해 변경할 수 있습니다.

## 구성

- `src/client/`: React UI. 서버와 같은 출처의 `/api/generate`를 호출합니다.
- `src/index.ts`: Hono API와 Gemini SDK. 키는 서버 환경 변수에서만 읽습니다.
- `vite.config.ts`: React, Tailwind CSS, Cloudflare Vite 플러그인.
- `components.json`: shadcn/ui 설정. `@/`는 `src/client/`를 가리킵니다.
- `src/client/components/ui/`: shadcn/ui 컴포넌트 소스.
- `src/client/style.css`: Tailwind CSS 4와 shadcn/ui 테마.
- `wrangler.jsonc`: Worker, SPA, API 라우팅, 모델 및 관측 설정.
- `worker-configuration.d.ts`: `npm run cf-typegen`으로 생성한 Workers 타입.
- `test/index.spec.ts`: Workers 런타임 테스트. 외부 Gemini 호출은 모킹합니다.

| API | 동작 |
| --- | --- |
| `GET /api/health` | `{ "status": "ok" }` 반환 |
| `POST /api/generate` | `{ "prompt": "안녕" }` 입력 → `{ "text": "..." }` 반환 |

입력은 1~4000자이며 요청 본문은 16 KiB로 제한합니다.
현재 연결 확인용 API에는 사용자 인증이 없습니다. 공개 배포 전 서비스의 인증과 호출 제한 정책을 정해야 합니다.

## UI 컴포넌트

shadcn/ui 컴포넌트를 추가하려면:

```sh
bunx shadcn@latest add dialog
```

추가한 컴포넌트는 `@/components/ui/dialog`처럼 가져옵니다.
테마 색상은 `src/client/style.css`의 CSS 변수로 변경합니다.
설정은 [shadcn/ui Vite 가이드](https://ui.shadcn.com/docs/installation/vite)와
[Tailwind CSS Vite 가이드](https://tailwindcss.com/docs/installation/using-vite)를 따릅니다.

## 검증

```sh
npm run cf-typegen
npm test
npm run build
npx wrangler deploy --dry-run
```

환경 변수나 바인딩을 변경하면 타입을 다시 생성합니다.
빌드와 dry run은 실제 Gemini 호출 성공을 검증하지 않습니다.
초기 설정 시 실제 API 호출 및 배포는 수행하지 않았습니다.

## Cloudflare 계정 연결 및 배포

브라우저 로그인이 필요한 명령은 직접 실행합니다.

```sh
npx wrangler login
npx wrangler whoami
```

배포할 Worker의 secret(`GEMINI_API_KEY`)을 별도로 등록해야 합니다.
`.dev.vars`의 비밀값은 배포 시 자동 업로드되지 않습니다.
[Workers secrets 안내](https://developers.cloudflare.com/workers/configuration/secrets/)를 따릅니다.
실제 배포와 secret 등록은 배포 대상 및 시점을 확정한 뒤 진행합니다.

## 의존성 점검

초기 설치의 `npm audit`에서 개발 도구의 간접 의존성(`undici`, `zod`)으로 인한 6건
(높음 3, 보통 3)이 보고됐습니다. 자동 수정은 Cloudflare 도구의 다운그레이드를 제안해 적용하지 않았습니다.
`npm audit --omit=dev` 검사에서 배포용 런타임 의존성의 취약점은 0건이었습니다.

## 참고

- [Cloudflare React + Vite](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/)
