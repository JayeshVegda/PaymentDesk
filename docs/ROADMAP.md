# Roadmap

## Phase 1 — Foundation — implemented

Workspace, pinned toolchain, migrations, SQLite adapters, auditable transaction service, health API, static SPA, loopback binding, structured logs, backup command, documentation, tests, and production smoke verification.

## Phase 2 — Master data — implemented

Payee directory, person/company distinction, aliases, categories, methods, defaults, activation, favorites, and frequency/recent ranking.

## Phase 3 — Fast capture — implemented

Complete resolver grammar, parsed preview, keyboard save, undo by voiding, favorites/recent shortcuts, review queue, and multi-worker batch entry.

## Phase 4 — Daily ledger — implemented

Today view, running totals, method splits, server-paginated TanStack table, edit/correction UI, audit history, duplicate warnings, search, sort, and filters.

## Phase 5 — Reports — implemented

Daily/weekly/monthly totals, payee/category/method ledgers, largest/repeated/unusual payments, lazy LayerChart 2 visualizations, CSV, and printable summary.

## Phase 6 — Reliability — implemented foundation

Online verified backup, tiered retention scripts, integrity checks, restore documentation, loopback smoke validation, and Windows Task Scheduler startup/backup instructions are implemented. A real Windows recovery drill and release archive should be performed on the target PC before treating deployment as final.

## Phase 7 — Telegram later

grammY long polling, strict user/chat allowlist, quick-entry confirmation, today/undo commands, and durable outbox retries. No Telegram implementation or dependency belongs in earlier phases.
