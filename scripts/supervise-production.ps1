param(
  [string]$ProjectDirectory = (Split-Path -Parent $PSScriptRoot),
  [int]$HealthIntervalSeconds = 15,
  [int]$FailureThreshold = 3,
  [int]$RestartDelaySeconds = 10
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$project = (Resolve-Path $ProjectDirectory).Path
$node = 'C:\Program Files\nodejs\node.exe'
if (-not (Test-Path -LiteralPath $node)) { throw "Node.js was not found at $node" }

$createdNew = $false
$supervisorMutex = New-Object System.Threading.Mutex($true, 'Local\PaymentDeskSupervisor', [ref]$createdNew)
if (-not $createdNew) { exit 0 }

$dataRoot = Join-Path $env:LOCALAPPDATA 'PaymentLedger'
$logDirectory = Join-Path $dataRoot 'logs'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
$supervisorLog = Join-Path $logDirectory 'supervisor.log'
$serverOutput = Join-Path $logDirectory 'server.stdout.log'
$serverError = Join-Path $logDirectory 'server.stderr.log'
$healthUrl = 'http://127.0.0.1:4782/api/health'

function Write-SupervisorLog([string]$Message) {
  Add-Content -LiteralPath $supervisorLog -Value "$(Get-Date -Format o) $Message"
}

function Test-PaymentDeskHealth {
  try {
    $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 5
    return $response.status -eq 'ok' -and $response.database -eq 'ok'
  } catch { return $false }
}

Write-SupervisorLog "Supervisor started for $project"
$env:PAYMENT_LEDGER_DATA_DIR = $dataRoot
$env:NODE_ENV = 'production'
if (-not $env:NODE_OPTIONS) { $env:NODE_OPTIONS = '--max-old-space-size=512' }

while ($true) {
  $child = $null
  try {
    if (Test-PaymentDeskHealth) {
      Write-SupervisorLog 'A healthy listener already exists; monitoring it.'
      while (Test-PaymentDeskHealth) { Start-Sleep -Seconds $HealthIntervalSeconds }
      Write-SupervisorLog 'Existing listener became unhealthy.'
    }

    $child = Start-Process -FilePath $node -ArgumentList '--env-file-if-exists=.env', 'scripts/start-production.mjs' -WorkingDirectory $project -WindowStyle Hidden -RedirectStandardOutput $serverOutput -RedirectStandardError $serverError -PassThru
    Write-SupervisorLog "Server process started with PID $($child.Id)"
    $startupDeadline = (Get-Date).AddSeconds(45)
    while (-not $child.HasExited -and (Get-Date) -lt $startupDeadline) {
      if (Test-PaymentDeskHealth) { break }
      Start-Sleep -Seconds 2
      $child.Refresh()
    }

    if ($child.HasExited) {
      Write-SupervisorLog "Server exited during startup with code $($child.ExitCode)"
    } elseif (-not (Test-PaymentDeskHealth)) {
      Write-SupervisorLog 'Server did not become healthy within 45 seconds.'
      Stop-Process -Id $child.Id -Force -ErrorAction SilentlyContinue
    } else {
      Write-SupervisorLog 'Health check passed.'
      $failedChecks = 0
      while (-not $child.HasExited) {
        Start-Sleep -Seconds $HealthIntervalSeconds
        $child.Refresh()
        if ($child.HasExited) { break }
        if (Test-PaymentDeskHealth) { $failedChecks = 0 } else {
          $failedChecks++
          Write-SupervisorLog "Health check failed ($failedChecks/$FailureThreshold)."
          if ($failedChecks -ge $FailureThreshold) {
            Write-SupervisorLog 'Health threshold reached; terminating unhealthy server.'
            Stop-Process -Id $child.Id -Force -ErrorAction SilentlyContinue
            break
          }
        }
      }
      $child.Refresh()
      if ($child.HasExited) { Write-SupervisorLog "Server process exited with code $($child.ExitCode)" }
    }
  } catch {
    Write-SupervisorLog "Supervisor cycle failed: $($_.Exception.Message)"
    if ($child -and -not $child.HasExited) { Stop-Process -Id $child.Id -Force -ErrorAction SilentlyContinue }
  }
  Write-SupervisorLog "Retrying in $RestartDelaySeconds seconds."
  Start-Sleep -Seconds $RestartDelaySeconds
}
