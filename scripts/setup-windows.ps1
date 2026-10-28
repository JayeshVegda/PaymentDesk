param(
  [string]$InstallDirectory = (Get-Location).Path,
  [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name was not found. Install Node.js 24 LTS and pnpm 11.18.0, then run this script again."
  }
}

Set-Location (Resolve-Path $InstallDirectory)
Require-Command 'node'

if (-not (Get-Command 'pnpm' -ErrorAction SilentlyContinue)) {
  if (Get-Command 'corepack' -ErrorAction SilentlyContinue) {
    corepack enable
    corepack prepare pnpm@11.18.0 --activate
  } elseif (Get-Command 'npm' -ErrorAction SilentlyContinue) {
    npm install --global pnpm@11.18.0
  } else {
    throw 'pnpm and corepack were not found. Install Node.js 24 LTS first.'
  }
}
Require-Command 'pnpm'

$nodeMajor = [int]((node --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 24) { throw "Node.js 24 LTS or newer is required. Detected: $(node --version)" }

$pnpmVersion = (pnpm --version).Trim()
if (-not $pnpmVersion.StartsWith('11.18.')) {
  Write-Warning "This project locks pnpm 11.18.0; detected $pnpmVersion. Use: corepack prepare pnpm@11.18.0 --activate"
}

if (-not (Test-Path '.env')) {
  Copy-Item '.env.example' '.env'
  Write-Warning 'Created .env from .env.example. Add Telegram settings only if you use Telegram.'
}

$dataDirectory = Join-Path $env:LOCALAPPDATA 'PaymentLedger'
New-Item -ItemType Directory -Force -Path $dataDirectory | Out-Null
$env:PAYMENT_LEDGER_DATA_DIR = $dataDirectory

if (-not $SkipInstall) { pnpm install --frozen-lockfile }
pnpm build
pnpm db:migrate

Write-Host ''
Write-Host 'Payment Desk is ready for production.' -ForegroundColor Green
Write-Host "Data directory: $dataDirectory"
Write-Host 'Start it with: .\scripts\start-production.ps1'
Write-Host 'Open: http://127.0.0.1:4782'
