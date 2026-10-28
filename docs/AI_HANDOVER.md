# AI handoff

Payment Desk is a private local payment ledger. Treat financial data as user-owned and preserve it.

## Start here

1. Read `README.md` and `docs/PROJECT_OVERVIEW.md`.
2. Read `docs/PRODUCTION_SETUP.md` before changing deployment scripts.
3. Inspect `git status` and the current migrations before editing database code.
4. Run `pnpm check` after TypeScript changes.
5. Run `pnpm test` and `pnpm build` before reporting completion.

## Non-negotiable boundaries

- Production binds only to `127.0.0.1:4782`.
- Do not introduce authentication, Docker, PostgreSQL, Redis, or a second production service.
- Never store money as a floating-point value.
- Never delete or rewrite a financial transaction silently; corrections and voids need audit records.
- Do not seed demo data into the production database.
- Do not expose Telegram tokens in source, logs, screenshots, or documentation.

## Runtime model

The Hono server serves the compiled React SPA and API from one Node process. SQLite is local. Telegram is an optional companion inside the same process and writes no separate business state. The frontend calls APIs through the same origin.

## Performance model

Keep Today fast and small. Use server pagination for transaction history, SQL aggregates for reports, one-minute query caching, and on-demand Activity/Reports/System queries. Any new timer must have a clear interval, a stop path, and a reason to exist while idle.

## Safe change workflow

```bash
pnpm check
pnpm test
pnpm build
pnpm smoke
```

When changing migrations, make a verified backup first and test migration against a disposable `PAYMENT_LEDGER_DATA_DIR`.
