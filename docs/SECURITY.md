# Security

## Local access boundary

Production host and port are constants: `127.0.0.1:4782`. There is no `HOST` override, no CORS middleware, and no listener on `0.0.0.0` or IPv6 wildcard. Requests with an unexpected Host are rejected. State-changing requests with a supplied foreign Origin are rejected to reduce DNS-rebinding and malicious-webpage risk.

No authentication is added because this is a localhost-only, single-user application. Anyone with access to the Windows account and data directory can access the ledger; Windows account and disk security therefore remain important.

## Data and secrets

The database, WAL, backups, logs, and `.env` are excluded from Git. Future Telegram tokens belong in environment configuration, never SQLite audit payloads, source, logs, or repository history. API errors do not return stack traces in production.

## Host controls

Keep Windows Firewall enabled, do not create inbound port rules, run Task Scheduler as the owning non-administrator user, and restrict `%LOCALAPPDATA%\PaymentLedger` to that account. Verify the listener after every deployment.

Windows 10 Home/Pro standard support ended on 14 October 2025. An ESU-covered installation or supported Windows upgrade is strongly recommended for a computer that remains online continuously.
