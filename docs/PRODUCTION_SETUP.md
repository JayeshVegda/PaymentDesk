# Production setup and operations

## Windows workstation setup

Install Node.js 24 LTS x64, then install or activate pnpm 11.18.0. Copy the project to a stable directory such as `C:\PaymentDesk` and open PowerShell there:

```powershell
.\scripts\setup-windows.ps1
```

The script installs the frozen lockfile, builds packages/server/frontend, creates `%LOCALAPPDATA%\PaymentLedger`, and applies migrations. It does not seed demo data and does not replace an existing `.env`.

Start manually:

```powershell
.\scripts\start-production.ps1
```

Startup is owned by **NSSM** (service name `PaymentDesk`) and must not be managed with Task Scheduler, `setup-windows-task.ps1`, or `supervise-production.ps1` — those mechanisms are retired. See the root `AGENTS.md` for the current ownership rules. The service starts at boot, restarts a failed process, and writes logs under `%LOCALAPPDATA%\PaymentLedger\logs`.

## Verification

```powershell
.\scripts\verify-production.ps1
Invoke-RestMethod http://127.0.0.1:4782/api/health
```

Confirm the listener is `127.0.0.1:4782`, never `0.0.0.0` or a LAN address.

## Upgrade

1. Stop the scheduled task/server.
2. Run a verified backup.
3. Replace application files only; preserve `%LOCALAPPDATA%\PaymentLedger`.
4. Run `pnpm install --frozen-lockfile`, `pnpm build`, and `pnpm db:migrate`.
5. Start the server and verify health.

## 4 GB RAM operating profile

Production startup applies a 512 MB V8 heap ceiling unless the operator already supplied `NODE_OPTIONS`. Browser queries cache for one minute, Ledger polls every 30 seconds, and heavier screens are on-demand. This keeps an idle process quiet for continuous workstation use.
