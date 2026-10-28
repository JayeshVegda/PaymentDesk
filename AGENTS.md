# AGENTS.md — PaymentDesk (C:\PaymentDesk)

This app runs as the Windows service **PaymentDesk** (:4782). It is part of
the unified system — read **C:\Site_imp\AGENTS.md** for the full architecture
and the rules agents must follow (ports table, backup design, NSSM usage).

Short facts:

- Server entry: `node scripts/start-production.mjs` (ports: 4782, health at
  `http://127.0.0.1:4782/api/health`).
- Data lives in `%LOCALAPPDATA%\PaymentLedger\data\ledger.sqlite3`. Backups
  via `node scripts/backup.ts` (live-safe, integrity-checked) run daily from
  the unified backup task; copies go to `H:\Web_Data\paymentdesk\`.
- Old supervision mechanisms (`scripts/supervise-production.ps1`, startup
  .vbs, the `PaymentDeskService` New-Service service) were retired on
  2026-10-28. Do NOT restart any of them — NSSM owns the process now.
- Never create new scheduled tasks or watchdog scripts for this app.

If a new agent is unsure how to add/change services, ports or backups:
follow the "How to add a new app" procedure in `C:\Site_imp\AGENTS.md` and
update both AGENTS.md files.
