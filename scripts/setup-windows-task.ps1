param(
  [string]$ProjectDirectory = (Split-Path -Parent $PSScriptRoot),
  [string]$TaskName = 'Payment Desk',
  [string]$UserName = 'Kapil'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$supervisor = Join-Path $ProjectDirectory 'scripts\supervise-production.ps1'
if (-not (Test-Path -LiteralPath $supervisor)) { throw "Could not find $supervisor" }
$powerShellExe = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
if (-not (Test-Path -LiteralPath $powerShellExe)) {
  $powerShellExe = (Get-Command pwsh.exe -ErrorAction SilentlyContinue).Source
  if (-not $powerShellExe) { throw 'Neither powershell.exe nor pwsh.exe found' }
}
$action = New-ScheduledTaskAction -Execute $powerShellExe -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$supervisor`"" -WorkingDirectory $ProjectDirectory
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $UserName
$trigger.Delay = 'PT20S'
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$domain = (Get-CimInstance Win32_ComputerSystem).Name
$principal = New-ScheduledTaskPrincipal -UserId "$domain\$UserName" -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Supervises PaymentDesk and recovers it after failures.' -Force | Out-Null

# Create a Startup-folder fallback for dual-layer boot reliability
# (The supervisor uses a named Mutex so they will never conflict or run twice)
$startupDir = [System.IO.Path]::Combine($env:USERPROFILE, 'AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup')
if (Test-Path -LiteralPath $startupDir) {
  $startupVbs = Join-Path $startupDir 'Start PaymentDesk Supervisor.vbs'
  $vbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "$ProjectDirectory"
WshShell.Run """$powerShellExe"" -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & "$supervisor" & """", 0, False
"@
  [System.IO.File]::WriteAllText($startupVbs, $vbsContent)
}

# Transfer ownership from any currently running fallback supervisor to the
# newly registered task, then verify that it starts a healthy server.
$supervisors = Get-CimInstance Win32_Process | Where-Object {
  $_.Name -in 'powershell.exe','pwsh.exe' -and $_.CommandLine -match '-File "?C:\\PaymentDesk\\scripts\\supervise-production.ps1'
}
foreach ($process in $supervisors) {
  Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
}
$listeners = Get-NetTCPConnection -LocalPort 4782 -State Listen -ErrorAction SilentlyContinue
foreach ($listener in $listeners) {
  $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
  if ($owner.Name -eq 'node.exe') {
    Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
  }
}

Start-ScheduledTask -TaskName $TaskName
$deadline = (Get-Date).AddSeconds(60)
$healthy = $false
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 2
  try {
    $health = Invoke-RestMethod 'http://127.0.0.1:4782/api/health' -TimeoutSec 5
    if ($health.status -eq 'ok' -and $health.database -eq 'ok') {
      $healthy = $true
      break
    }
  } catch {}
}
if (-not $healthy) {
  throw "Scheduled task '$TaskName' was installed, but PaymentDesk did not become healthy within 60 seconds. Check the supervisor logs."
}

$taskInfo = Get-ScheduledTaskInfo -TaskName $TaskName
Write-Host "Scheduled task '$TaskName' installed and running." -ForegroundColor Green
Write-Host "PaymentDesk health: $($health.status); database: $($health.database)"
Write-Host "Last task result: $($taskInfo.LastTaskResult)"
Write-Host "Logs: $(Join-Path $env:LOCALAPPDATA 'PaymentLedger\logs')"
