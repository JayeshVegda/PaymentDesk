@echo off
setlocal
title Payment Desk Auto-Start Fix

:: Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting Administrator privileges to register startup service...
    powershell -NoProfile -Command "Start-Process cmd.exe -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

cd /d "C:\PaymentDesk"

echo ================================================================
echo   Fixing Payment Desk Auto-Start on Boot and Background Service
echo ================================================================
echo.

"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "C:\PaymentDesk\scripts\setup-windows-task.ps1"

if %errorLevel% equ 0 (
    echo.
    echo ================================================================
    echo   SUCCESS! Payment Desk auto-start has been registered.
    echo   - Scheduled Task "Payment Desk" updated with correct path.
    echo   - Startup folder fallback configured.
    echo   - Server is now running at http://127.0.0.1:4782
    echo ================================================================
) else (
    echo.
    echo ================================================================
    echo   Failed to complete setup. Please check the error above.
    echo ================================================================
)

echo.
pause
