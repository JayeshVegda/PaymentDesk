# Windows Deployment

## One-time setup

Install the official Node.js `24.18.1` x64 MSI, then open PowerShell as the normal application user:

```powershell
npm install --global pnpm@11.18.0
node --version
pnpm --version
cd C:\PaymentLedger\app
pnpm install --frozen-lockfile
pnpm build
$env:PAYMENT_LEDGER_DATA_DIR = Join-Path $env:LOCALAPPDATA 'PaymentLedger'
pnpm db:migrate
pnpm start
```

Open only `http://127.0.0.1:4782`. Install dependencies fresh on Windows; never copy Linux `node_modules` because `better-sqlite3` is native. Playwright and build tools are development dependencies and can be omitted from a future production-only release bundle.

## Service supervision

Startup is owned by **NSSM** (service name `PaymentDesk`) — not Task Scheduler. Do not create new scheduled tasks or supervisors for this app; to manage the process, place a backup file in the data directory or use the NSSM service (`nssm start PaymentDesk` / `nssm stop PaymentDesk`). Separate daily/weekly/monthly `backup.ps1` retention stays configured via `app_settings.backup_retention`.

## Upgrade

Stop the task, make and verify a backup, replace application files without touching `%LOCALAPPDATA%\PaymentLedger`, run `pnpm install --frozen-lockfile`, build, migrate, restart, and verify health/listener. Never replace or delete the data directory during an upgrade.
