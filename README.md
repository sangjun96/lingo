# Lingo

React + Vite 프런트엔드와 Cloudflare Agents를 하나의 Cloudflare Worker에서 실행합니다.
Node.js 24 이상과 Bun을 사용합니다.

## 로컬 실행

```sh
bun install --frozen-lockfile
cp .dev.vars.example .dev.vars
bun run dev
```

`.dev.vars`의 `GEMINI_API_KEY`에 Google AI Studio에서 발급한 키를 입력합니다.
터미널에 표시된 주소에서 Lingo 화면을 엽니다. 키가 없어도 화면은 열리며, 대화를 요청하면 설정 안내를 표시합니다.
모든 Gemini 호출은 서버의 공식 `@google/genai` SDK를 사용합니다. 기본 모델은 `gemini-3.8-flash`,
TTS는 `gemini-3.8-flash-lite-tts`이며 `.dev.vars`에서 모델을 변경할 수 있습니다.

## 대화와 학습

- 마이크를 한 번 눌러 녹음을 시작하고 다시 누르면 전송합니다. 최대 60초 / 1 MiB이며 취소할 수 있습니다.
- 음성을 Gemini로 전사한 뒤 AI 답변을 생성합니다. 답변은 TTS로 재생하고, 브라우저가 자동 재생을 막으면 듣기 버튼을 사용합니다.
- `AI 문장 / 답변 추천 / 내 표현` 탭을 자유롭게 전환합니다. 세 추천 답변은 같은 목록에서 비교하고 각각 해설과 음성을 확인합니다.
- 학습 자료는 답변과 별도로 생성합니다. 학습 자료가 실패해도 대화를 계속하고 해당 자료만 다시 요청할 수 있습니다.
- 녹음과 재생은 겹치지 않습니다. 해설을 읽는 동안 자동 녹음하거나 다음 턴으로 넘어가지 않습니다.
- 대화 기록에서 이전 턴을 선택해 복습합니다. 탭 선택은 유지되고, 해설과 스크롤은 같은 턴의 탭을 오갈 때 유지됩니다.
- 세션당 최대 40턴입니다. 새 대화는 새 Agent 인스턴스를 만들며 이전 세션의 데이터를 삭제하지 않습니다.

## 구성

- `src/client/`: React UI 진입점과 공용 UI 컴포넌트.
- `src/client/features/conversation/`: 학습 탭, 문장 카드, 대화 기록, 입력 UI와 녹음·재생·Agent 연결 훅.
- `src/shared/conversation.ts`: 클라이언트와 서버가 공유하는 대화 타입과 제한.
- `src/worker/index.ts`: Agents 라우팅과 404 응답.
- `src/worker/agents/lingo.ts`: Cloudflare Agents SDK의 `LingoAgent` 클래스.
- `src/worker/services/`: Gen AI SDK 클라이언트, 전사·응답, 학습 자료 검증, TTS 서비스.
- `src/worker/conversation/requests.ts`: 대화 시작 요청과 음성 입력 검증, 크기 제한.
- `vite.config.ts`: React, Tailwind CSS, Cloudflare Vite 플러그인.
- `components.json`: shadcn/ui 설정. `@/`는 `src/client/`를 가리킵니다.
- `src/client/components/ui/`: shadcn/ui 컴포넌트 소스.
- `src/client/style.css`: Tailwind CSS 4와 shadcn/ui 테마.
- `cloudflare.config.ts`: `cf` CLI용 Worker, SPA, Agents 바인딩 및 관측 설정.
- `.cloudflare/types/index.d.ts`: `npm run cf-typegen` 또는 `cf dev`/`cf build`가 생성하는 Workers 타입.

| API | 동작 |
| --- | --- |
| `GET /agents/lingo-agent/{instance}/health` | Agent 인스턴스 연결 확인, `{ "status": "ok" }` 반환 |
| `GET /agents/lingo-agent/{instance}/state` | 저장된 세션 상태 읽기 |
| `POST /agents/lingo-agent/{instance}/turns` | 턴 접수 후 202 반환. `X-Request-Id` 필수, 후속 턴은 `X-Reply-To`에 최신 턴 ID 전달 |
| `POST /agents/lingo-agent/{instance}/retry/turn/{turnId}` | 실패한 답변 또는 저장된 녹음 처리 재시도 |
| `POST /agents/lingo-agent/{instance}/retry/learning/{turnId}` | 실패한 학습 자료만 다시 생성 |
| `GET /agents/lingo-agent/{instance}/audio/{expressionId}` | 서버에 저장된 문장만 TTS로 생성하고 R2에서 다시 재생 |

첫 질문은 `application/json`의 `{ "text": null }`로 생성하고, 이후 사용자 답변은 오디오 바이너리로 전송합니다.
같은 요청 ID는 중복 처리하지 않으며 진행 중인 턴과 오래된 응답 대상은 409로 거부합니다.
React `useAgent`가 WebSocket으로 상태를 동기화합니다. 입력과 재시도는 Agent의 HTTP 명령으로 요청하며,
Agent가 처리 결과를 저장하고 연결된 화면에 알립니다. 탭 전환과 해설 펼침은 클라이언트 상태로만 관리합니다.

Cloudflare Agents는 [기존 프로젝트 추가 가이드](https://developers.cloudflare.com/agents/getting-started/add-to-existing-project/)에 따라
`LingoAgent` Durable Object 바인딩과 SQLite migration을 설정했습니다.
`{instance}`는 브라우저가 생성하고 로컬 저장소에 보관하는 임의 세션 UUID입니다. 한 세션을 한 Agent가 관리합니다.
`setState`로 대화 상태를 저장·동기화하고, 사용자 녹음 원본과 생성된 TTS 음성은 `AUDIO_BUCKET` R2 바인딩에 저장합니다.
파일 키는 `sessions/{Durable Object ID}/recordings/{turnId}`와 `sessions/{Durable Object ID}/generated/{expressionId}`입니다.
녹음은 전사 전에 저장하고, 턴에는 R2 키와 MIME 타입만 보관합니다. 전사가 실패하면 저장된 원본으로 다시 시도할 수 있습니다.
TTS는 처음 재생할 때 생성·저장하며 이후에는 R2 파일을 재사용합니다. 기존 SQLite 음성 캐시는 재생 시 R2로 복사하고 기존 데이터는 유지합니다.
클라이언트의 직접 상태 변경은 거부합니다. `runFiber`에 작업과 체크포인트를 기록하고,
중단된 작업은 `onFiberRecovered`에서 다시 시작합니다. R2 저장 후에는 체크포인트에서 원본 음성을 제거하고, 복구 시 턴에 저장된 키로 읽습니다.
외부 모델 요청이 완료된 직후 프로세스가 중단되면 해당 단계의 API가 재호출될 수 있습니다.

로컬 개발과 테스트는 로컬 R2 저장소를 사용합니다. 실제 배포에는 `cloudflare.config.ts`의 `AUDIO_BUCKET`에
지정한 이름의 비공개 R2 버킷(`lingo-audio`)이 필요합니다. 버킷 생성과 배포는 별도로 진행합니다.
녹음과 TTS 파일은 자동 삭제하지 않으며, 새 대화를 시작해도 이전 세션의 파일을 보관합니다.

현재 사용자 인증은 없으며 세션 ID를 아는 사람이 그 세션에 접근할 수 있습니다. 개인 로컬 사용 범위이며,
공개 배포 전 인증·사용량 제한·대화 및 음성 보관 정책을 정해야 합니다.

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
npm run build
npm run deploy -- --dry-run
```

환경 변수나 바인딩을 변경하면 타입을 다시 생성합니다.
dry run은 빌드와 패키징만 검증하며 실제 배포를 수행하지 않습니다.
테스트는 SDK의 네트워크 요청을 모킹하며 실제 Gemini 호출은 하지 않습니다.
대화·학습 자료 생성, 중복 및 동시 요청, 전사 실패 복구, SQLite 상태 저장, R2 원본·TTS 보관 및 재사용, 입력 검증을 확인합니다.

## Cloudflare 계정 연결 및 배포

브라우저 로그인이 필요한 명령은 직접 실행합니다.

```sh
cf auth login
cf auth whoami
```

실제 배포는 배포 대상 및 시점을 확정한 뒤 진행합니다.

## 의존성 점검

초기 설치의 `npm audit`에서 개발 도구의 간접 의존성(`undici`, `zod`)으로 인한 6건
(높음 3, 보통 3)이 보고됐습니다. 자동 수정은 Cloudflare 도구의 다운그레이드를 제안해 적용하지 않았습니다.
`npm audit --omit=dev` 검사에서 배포용 런타임 의존성의 취약점은 0건이었습니다.

## 참고

- [Wrangler 프로젝트를 Cloudflare CLI로 마이그레이션](https://developers.cloudflare.com/cf/wrangler/migrate/)
- [Cloudflare CLI 설정](https://developers.cloudflare.com/cf/projects/cloudflare-config/)
- [Cloudflare React + Vite](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/)
