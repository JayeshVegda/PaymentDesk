$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))
$env:PAYMENT_LEDGER_DATA_DIR = Join-Path $env:LOCALAPPDATA 'PaymentLedger'
$env:NODE_ENV = 'production'
$env:NODE_OPTIONS = if ($env:NODE_OPTIONS) { $env:NODE_OPTIONS } else { '--max-old-space-size=512' }
pnpm start
