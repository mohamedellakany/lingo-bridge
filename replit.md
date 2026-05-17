# LingoBridge

A real-time voice translation mobile app that lets a speaker broadcast live translated subtitles and audio to listeners in 10+ languages.

## Run & Operate

- `pnpm --filter @workspace/mobile run dev` — run the Expo dev server
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo (React Native) with Expo Router
- State: React Context + AsyncStorage (local persistence)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/mobile/` — Expo mobile app
  - `app/(tabs)/` — all screens (index, speaker, listener, history)
  - `context/SessionContext.tsx` — session state (AsyncStorage-backed)
  - `components/WaveformAnimation.tsx` — animated recording waveform
  - `components/LanguagePickerModal.tsx` — language selector + LANGUAGES list
  - `constants/colors.ts` — dark navy/blue/purple design tokens (light + dark)

## Architecture decisions

- Frontend-only MVP: uses AsyncStorage for session persistence; no backend required for first build
- Session simulation: speaker screen cycles demo phrases (Arabic source) every 3.8s to showcase the translation UX without needing STT/translation APIs
- Listener polling: polls AsyncStorage every 600ms to "receive" translations from the speaker — works as a local demo of the real-time concept
- Session codes: format `LB-XXXX` (4 random digits), stored in AsyncStorage for cross-screen sharing
- Dark navy (#09101F) primary theme with electric blue (#5B8AF5) + purple (#9B6DFF) accents matching the futuristic brand spec

## Product

- **Speaker Mode**: choose from/to language → start session → animated waveform shows recording → live original text + AI translation preview → share session code
- **Listener Mode**: enter session code → receive translated subtitles in large, readable text with history
- **Session History**: browse past sessions with duration, phrase count, and translation snippets
- **Home**: one-tap access to both modes, recent sessions, use-case showcase

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The translation loop in `speaker.tsx` uses demo phrases cycling every 3.8s — to wire real STT/translation, replace the `startDemoLoop` function with actual API calls
- Listener polling uses a 600ms AsyncStorage poll — replace with WebSocket for production real-time
- Fonts must fully load before any screen renders (handled by SplashScreen gate in `_layout.tsx`)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
