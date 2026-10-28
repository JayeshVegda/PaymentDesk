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

## Task Scheduler

Create a task for the owning user, trigger it at logon, set “Start in” to `C:\PaymentLedger\app`, and run:

```text
powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\PaymentLedger\app\scripts\start-production.ps1
```

Do not select “Run whether user is logged on or not” until file ownership and log handling have been tested. Configure restart on failure with a one-minute delay and avoid parallel instances. Add separate daily/weekly/monthly tasks for `backup.ps1` in Phase 7.

## Upgrade

Stop the task, make and verify a backup, replace application files without touching `%LOCALAPPDATA%\PaymentLedger`, run `pnpm install --frozen-lockfile`, build, migrate, restart, and verify health/listener. Never replace or delete the data directory during an upgrade.
