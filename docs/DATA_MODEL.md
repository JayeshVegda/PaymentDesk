# Data Model

All tables are SQLite `STRICT` tables. IDs are never reused. Foreign keys use restrictive deletion; master data is deactivated instead of deleted.

## Master data

- `payees`: person/company identity, normalized unique name, optional defaults, active state, notes, timestamps.
- `payee_aliases`: globally unique normalized aliases pointing to payees.
- `categories`: hierarchical optional parent, active state, ordering.
- `category_aliases`: deterministic parser keywords.
- `payment_methods`: stable codes; seeded with cash, UPI, bank, and cheque.

## Financial data

- `transactions`: local business date/time, required payee and positive `amount_paise`, optional category/method only when review is required, source, posted/voided status, timestamps, and concurrency version.
- `transaction_audit`: append-only created/corrected/voided JSON snapshots with source and UTC time.
  Hard deletion of transactions is blocked by a trigger. Transaction audit rows cannot be updated or deleted.

## Operations

- `app_settings`: JSON values for timezone, currency, and retention.
- `background_jobs`: durable in-process job state for later phases.
- `notification_outbox`: integration-neutral durable notification events.
- `schema_migrations`: immutable migration name, SHA-256 checksum, and application time.

## SQLite settings

Every writable connection enables foreign keys, WAL, `synchronous=NORMAL`, a 5-second busy timeout, 1,000-page automatic checkpoints, and a 64 MiB journal size limit. Live database files must never be copied directly; use the backup API.
