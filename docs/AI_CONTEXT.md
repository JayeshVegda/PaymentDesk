# AI development context

This is the concise context file for another engineering assistant.

## Goal

Maintain a reliable single-user local payment ledger for an Indian business. Optimize for fast keyboard capture, correct paise arithmetic, auditability, and a modest Windows computer.

## Technology

React 19 + Vite + TypeScript + Tailwind, React Router, TanStack Query, Lucide, Sonner, and lazy LayerChart/ECharts reporting on the frontend. Hono + TypeScript on the backend. SQLite through better-sqlite3 with plain SQL migrations and repository/service boundaries.

## Where to change things

- Payment capture UI: `apps/web-react/src/pages/TodayPage.tsx` and `components/payment-entry`.
- Transaction list and review: `apps/web-react/src/pages/LedgerPage.tsx`.
- Business rules: `packages/core` and `packages/database/src/ledger.ts`.
- Parser: `packages/parser/src/index.ts`.
- API: `apps/server/src/api.ts`.
- Process/static serving: `apps/server/src/index.ts` and `apps/server/src/app.ts`.
- Database changes: add a numbered SQL file under `migrations/`.

## Before editing

Inspect `git status`, existing migrations, `.env.example`, and the relevant tests. Do not assume a clean worktree. Do not touch the live data directory for UI work.

## Before handoff

Run `pnpm check`, `pnpm test`, `pnpm build`, and `pnpm smoke`. Explain any warnings. For UI work, inspect the production route at 1920×1080 and check keyboard focus, empty states, and error boundaries.
