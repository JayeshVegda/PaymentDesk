$ErrorActionPreference = 'Stop'

$ProjectDir = Split-Path -Parent $PSScriptRoot
$SmokeDir = Join-Path ([IO.Path]::GetTempPath()) ("payment-ledger-smoke-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $SmokeDir | Out-Null

$ServerLog = Join-Path $SmokeDir 'server.log'
$HealthJson = Join-Path $SmokeDir 'health.json'

$env:PAYMENT_LEDGER_DATA_DIR = $SmokeDir
$process = Start-Process -FilePath 'cmd.exe' `
  -ArgumentList '/c', 'pnpm start' `
  -WorkingDirectory $ProjectDir `
  -RedirectStandardOutput $ServerLog `
  -RedirectStandardError (Join-Path $SmokeDir 'server.err.log') `
  -WindowStyle Hidden `
  -PassThru

function Cleanup {
  if ($process -and -not $process.HasExited) {
    & taskkill /T /F /PID $process.Id | Out-Null
  }
  Remove-Item -Recurse -Force $SmokeDir -ErrorAction SilentlyContinue
}

try {
  $healthy = $false
  foreach ($attempt in 1..80) {
# Abort if something is already listening on the port
$existing = Get-NetTCPConnection -LocalPort 4782 -State Listen -ErrorAction SilentlyContinue
if ($existing) { throw 'Smoke failed: port 4782 is already in use (is the production app running?)' }

try {
      $response = Invoke-WebRequest -Uri 'http://127.0.0.1:4782/api/health' `
        -Headers @{ Host = '127.0.0.1:4782' } `
        -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200) {
        Set-Content -Path $HealthJson -Value $response.Content
        if ($response.Content -match '"status"\s*:\s*"ok"') { $healthy = $true; break }
      }
    } catch { Start-Sleep -Milliseconds 250 }
    Start-Sleep -Milliseconds 250
  }
  if (-not $healthy) {
    Get-Content $ServerLog -ErrorAction SilentlyContinue | Write-Host
    throw 'Smoke failed: /api/health did not return ok in time'
  }

  # SPA fallback serves index.html at /
  $root = Invoke-WebRequest -Uri 'http://127.0.0.1:4782/' `
    -Headers @{ Host = '127.0.0.1:4782' } -UseBasicParsing -TimeoutSec 5
  if ($root.Content -notmatch '<html lang="en"') { throw 'Smoke failed: SPA root did not serve index.html' }

  # Loopback-only listener check
  $listeners = Get-NetTCPConnection -LocalPort 4782 -State Listen -ErrorAction Stop
  $external = $listeners | Where-Object { $_.LocalAddress -notin @('127.0.0.1', '::1') }
  if ($external) {
    Write-Host 'Unsafe non-loopback listener detected' 
    exit 1
  }

  $nodeProcess = Get-Process -Id (Get-NetTCPConnection -LocalPort 4782 -State Listen |
    Select-Object -First 1 -ExpandProperty OwningProcess) -ErrorAction SilentlyContinue
  $rssMb = if ($nodeProcess) { [math]::Round($nodeProcess.WorkingSet64 / 1MB) } else { -1 }
  Write-Host "production smoke passed; server RSS=$rssMb MB"
} catch {
  Write-Host ("smoke failed: " + $_.Exception.Message)
  Get-Content $ServerLog -ErrorAction SilentlyContinue | Select-Object -First 30 | Write-Host
  exit 1
} finally {
  Cleanup
}
