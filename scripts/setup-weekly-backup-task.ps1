param(
  [string]$ProjectDirectory = 'C:\PaymentDesk',
  [string]$TaskName = 'Payment Desk Weekly Backup'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -Command `"Set-Location '$ProjectDirectory'; `$env:PAYMENT_LEDGER_DATA_DIR = Join-Path `$env:LOCALAPPDATA 'PaymentLedger'; pnpm exec tsx scripts/backup.ts --tier=weekly`""
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 11:00pm
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description 'Runs weekly automated database backups for Payment Desk retaining only the last 4 backups.' -Force | Out-Null
Write-Host "Scheduled task '$TaskName' created successfully."
