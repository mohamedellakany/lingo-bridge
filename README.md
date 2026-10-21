# LingoBridge

A real-time voice translation app that lets a speaker broadcast live translated subtitles and audio to listeners in 10+ languages.

## Tech Stack

- **Monorepo:** pnpm workspaces, Node.js, TypeScript 5.9
- **Mobile/Web:** Expo (React Native) with Expo Router — runs on iOS, Android, and web
- **API:** Express 5
- **Real-time:** WebSockets (`ws`) for live translation delivery to listeners
- **Database:** PostgreSQL + Drizzle ORM (optional; falls back to in-memory/JSON)
- **Auth:** bcrypt password hashing, expiring access tokens, rate limiting
- **Validation:** Zod
- **AI:** Groq (default) or OpenAI for speech-to-text + translation
- **Build:** esbuild

## Project Structure

```
artifacts/
  api-server/      Express API (translation, sessions, auth, health)
  mobile/          Expo app (speaker, listener, history screens)
  mockup-sandbox/  Vite design sandbox for UI mockups
lib/
  db/              Drizzle schema and client
  integrations/    OpenAI integration helpers
scripts/           Workspace utility scripts
```

## Prerequisites

- Node.js 20+ (Node 23 tested)
- pnpm 9+
- An OpenAI API key

## Setup

1. Install dependencies from the repo root:

   ```bash
   pnpm install
   ```

2. Create `artifacts/api-server/.env`:

   ```
   OPENAI_API_KEY=your_openai_key_here
   PORT=8080

   # Email for signup OTP verification (optional in dev — see note below)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=you@example.com
   SMTP_PASS=your_app_password
   SMTP_FROM=LingoBridge <you@example.com>
   ```

   > **Email in development:** if the `SMTP_*` vars are left unset, the server
   > does not send real emails — it prints the 6-digit OTP to the server console
   > instead. That lets you test the full signup flow locally without a mail
   > provider. For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833), not your normal password.

## Running Locally

Run the backend and the app in two terminals.

**Terminal 1 — API server:**

```bash
cd artifacts/api-server
pnpm run build && pnpm run start
```

The API listens on the port from `.env` (default `8080`). Health check: `http://localhost:8080/api/healthz`

**Terminal 2 — Mobile/Web app:**

```bash
cd artifacts/mobile
pnpm run web      # open in the browser
# or
pnpm run dev      # Expo dev server + QR code for iOS/Android
```

The web app runs at `http://localhost:8081`.

> The app calls the API at `http://localhost:8080` by default. To point it at a deployed backend, set `EXPO_PUBLIC_DOMAIN` to the backend host.

## Scripts

- `pnpm run build` — typecheck + build all packages
- `pnpm run typecheck` — typecheck across all packages

## Accounts

- **Listeners** need no account — they join a session with a speaker's code.
- **Speakers** sign up with username, email, and password. Signup is verified
  by a 6-digit one-time code sent to the email address (OTP). The account is
  created only after the code is confirmed.

## Features

- **Speaker mode:** pick source/target languages, start a session, broadcast live translated text and audio, and share a session code.
- **Listener mode:** join with a session code and receive translated subtitles in large, readable text — delivered instantly over WebSockets.
- **History:** browse past sessions with duration, phrase count, and translation snippets; delete individual sessions or clear all.
- **Transcripts:** reopen any past session and read the full conversation in the original language, with RTL support for Arabic.
- **Legal:** built-in Privacy Policy and Terms of Service screens (required for app store publishing).

## Database (optional)

By default the server runs with no database — sessions, transcripts, users, and
tokens live in memory plus a local JSON file. This is fine for local development.

To enable **persistent, multi-device** storage, provision a PostgreSQL database
(local, or a free one from [Neon](https://neon.tech) / [Supabase](https://supabase.com)),
set `DATABASE_URL` in `artifacts/api-server/.env`, then push the schema:

```bash
pnpm --filter @workspace/db run push
```

The server logs which mode it's in on startup (`database: "postgres"` or
`"in-memory/json"`).

## Security notes

- Passwords are hashed with **bcrypt** (never stored in plain text).
- Access tokens **expire** after 30 days and are purged periodically.
- Auth endpoints (login, register, OTP) are **rate limited** per IP.
- Set `app.set("trust proxy", 1)` is enabled for correct client IPs behind a proxy.
