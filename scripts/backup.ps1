param(
  [ValidateSet('daily', 'weekly', 'monthly')]
  [string]$Tier = 'daily'
)
$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))
$env:PAYMENT_LEDGER_DATA_DIR = Join-Path $env:LOCALAPPDATA 'PaymentLedger'
pnpm db:backup -- --tier=$Tier

