$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$url = 'http://127.0.0.1:4782'
$health = Invoke-RestMethod "$url/api/health"
if ($health.status -ne 'ok') { throw 'Health endpoint did not report ok.' }

$listener = Get-NetTCPConnection -LocalPort 4782 -State Listen -ErrorAction SilentlyContinue
if (-not $listener) { throw 'Nothing is listening on port 4782.' }
if (($listener | Where-Object { $_.LocalAddress -notin @('127.0.0.1', '::1') })) {
  throw 'Unsafe non-loopback listener detected. The app must bind only to 127.0.0.1.'
}

Write-Host "Production health: $($health.status)"
Write-Host 'Listener: 127.0.0.1:4782'
