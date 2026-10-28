# Telegram companion

**Status: implemented.** This document once described a future phase; the
grammY adapter now lives in the same Node process (`apps/server/src/telegram.ts`)
and is configured via `TELEGRAM_*` env keys (see `.env.example`). It supports
quick entry, today reports, forwarding of new transactions, scheduled
18:00/20:00 summaries, and an allowlisted user/chat model.

Still open: `notification_outbox` (created in migration 001) has no retry
worker yet — Telegram forward retries are handled ad hoc inside `telegram.ts`,
and the `background_jobs` table is unused.
