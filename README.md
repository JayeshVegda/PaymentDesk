# Payment Desk

Private, single-user INR payment tracking for a local Windows workstation. The production app is one Node.js process serving the React frontend and Hono API at:

`http://127.0.0.1:4782`

It stores data locally in SQLite. It does not require Docker, PostgreSQL, Redis, a cloud service, or a separate frontend server.

## Production setup on Windows

Requirements: Node.js 24 LTS x64 and pnpm 11.18.0.

From the project directory in PowerShell:

```powershell
.\scripts\setup-windows.ps1
.\scripts\start-production.ps1
```

Then open `http://127.0.0.1:4782`. To start it automatically when Windows logs in:

```powershell
.\scripts\setup-windows-task.ps1
```

Verify the running instance with:

```powershell
.\scripts\verify-production.ps1
```

The database and backups are stored under `%LOCALAPPDATA%\PaymentLedger`. Never delete that directory during an upgrade.

## Development commands

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm check
pnpm test
pnpm build
pnpm smoke
pnpm db:backup
```

Use `pnpm dev` only on the development computer. Use the compiled production build on the 4 GB workstation.

## Architecture

- `apps/web-react`: React SPA, routing, keyboard-first payment desk, reports and system views.
- `apps/server`: Hono API, static-file serving, Telegram companion, and process lifecycle.
- `packages/core`: transaction services and business rules.
- `packages/database`: better-sqlite3, Kysely types, migrations, repositories, backups.
- `packages/parser`: deterministic Indian amount/payee/payment parser.
- `packages/shared`: shared contracts and utility types.
- `migrations`: plain SQL migrations applied in order.

The backend remains the authority for payment writes, audit history, review state, and money calculations. All amounts are integer paise.

## Production reliability defaults

The browser caches ordinary queries for one minute; the Ledger refreshes every 30 seconds while open. Reports, Activity, and System are on-demand. Telegram checks for new transactions every 15 seconds and scheduled summaries every 30 seconds. Request logging is quiet unless `PAYMENT_LEDGER_LOG_LEVEL=info` or `debug` is selected.

Read [docs/PRODUCTION_SETUP.md](docs/PRODUCTION_SETUP.md), [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md), and [docs/AI_CONTEXT.md](docs/AI_CONTEXT.md) before operating or extending the project.
