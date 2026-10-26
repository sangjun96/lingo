# Lingo

React + Vite 프런트엔드를 Cloudflare Worker에서 실행합니다.
Node.js 24 이상과 Bun을 사용합니다.

## 로컬 실행

```sh
bun install --frozen-lockfile
bun run dev
```

터미널에 표시된 주소에서 Lingo 화면을 엽니다. 현재 필수 환경 변수는 없습니다.

## 구성

- `src/client/`: React UI 진입점과 공용 UI 컴포넌트.
- `src/index.ts`: Worker의 404 응답.
- `vite.config.ts`: React, Tailwind CSS, Cloudflare Vite 플러그인.
- `components.json`: shadcn/ui 설정. `@/`는 `src/client/`를 가리킵니다.
- `src/client/components/ui/`: shadcn/ui 컴포넌트 소스.
- `src/client/style.css`: Tailwind CSS 4와 shadcn/ui 테마.
- `wrangler.jsonc`: Worker, SPA 및 관측 설정.
- `worker-configuration.d.ts`: `npm run cf-typegen`으로 생성한 Workers 타입.
- `test/index.spec.ts`: 제거된 API의 404 응답을 검증하는 Workers 런타임 테스트.

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
dry run은 빌드와 패키징만 검증하며 실제 배포를 수행하지 않습니다.

## Cloudflare 계정 연결 및 배포

브라우저 로그인이 필요한 명령은 직접 실행합니다.

```sh
npx wrangler login
npx wrangler whoami
```

실제 배포는 배포 대상 및 시점을 확정한 뒤 진행합니다.

## 의존성 점검

초기 설치의 `npm audit`에서 개발 도구의 간접 의존성(`undici`, `zod`)으로 인한 6건
(높음 3, 보통 3)이 보고됐습니다. 자동 수정은 Cloudflare 도구의 다운그레이드를 제안해 적용하지 않았습니다.
`npm audit --omit=dev` 검사에서 배포용 런타임 의존성의 취약점은 0건이었습니다.

## 참고

- [Cloudflare React + Vite](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/)
