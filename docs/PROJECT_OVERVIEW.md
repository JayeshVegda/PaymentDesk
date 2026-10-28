# Project overview

## Product

Payment Desk records outgoing payments to people, companies, suppliers, transport providers, and workers. The primary workflow is a command entry bar with deterministic parsing for Indian amounts such as `2.5k`, `1l`, `2.40lakh`, and `240 lakh`. Cash is the default method. Ambiguous payees, amounts, or categories enter the Review workflow.

## Main areas

- Today: quick capture, today totals, recent payments, and review count.
- Payment Inbox: paginated transaction history, filters, corrections, voiding, and review resolution.
- Payees: searchable directory with aliases, defaults, favourites, sorting, and pagination.
- Reports: date-range aggregates, category/method analysis, averages, repeated payments, and unusual payments.
- Activity: immutable audit history with pagination.
- Export: filtered CSV export.
- System: database integrity, storage, backup, and Telegram health.

## Data ownership

The live database is outside the repository in the configured data directory. Repository builds and upgrades must never overwrite it. Migrations are append-only SQL files and are applied by the database package.

## Financial rules

Money is integer paise. A transaction remains in history when voided. Corrections create audit records. Payee defaults are remembered but an explicit command value wins. The parser is local, deterministic, and does not call an AI service.

## Future integration boundary

Telegram uses the same transaction service and notification outbox concepts as the web UI. It must not duplicate payment rules or write directly around the service layer.
