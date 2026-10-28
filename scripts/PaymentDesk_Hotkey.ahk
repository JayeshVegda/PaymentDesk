#Requires AutoHotkey v2.0
#SingleInstance Force

; ============================================================
; WORK HOTKEYS - Windows 10 / AutoHotkey v2
;
; CapsLock + D  -> Website 1
; CapsLock + F  -> Website 2
; CapsLock + S  -> Google Sheet sync ONLY, hidden
; Tap CapsLock  -> Normal Caps Lock toggle
; ============================================================

CapsLock & d::Run("http://127.0.0.1:4782/")

CapsLock & f::Run("http://127.0.0.1:4174/")

CapsLock & s::{
    ; Encoded UTF-16LE avoids AutoHotkey/PowerShell nested-quote parsing errors.
    command := "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -EncodedCommand JABlAG4AdgA6AFAAUwBNAG8AZAB1AGwAZQBQAGEAdABoACAAPQAgACIAJABlAG4AdgA6AFcASQBOAEQASQBSAFwAUwB5AHMAdABlAG0AMwAyAFwAVwBpAG4AZABvAHcAcwBQAG8AdwBlAHIAUwBoAGUAbABsAFwAdgAxAC4AMABcAE0AbwBkAHUAbABlAHMAOwAkAGUAbgB2ADoAUAByAG8AZwByAGEAbQBGAGkAbABlAHMAXABXAGkAbgBkAG8AdwBzAFAAbwB3AGUAcgBTAGgAZQBsAGwAXABNAG8AZAB1AGwAZQBzACIAOwAgAEkAbQBwAG8AcgB0AC0ATQBvAGQAdQBsAGUAIABNAGkAYwByAG8AcwBvAGYAdAAuAFAAbwB3AGUAcgBTAGgAZQBsAGwALgBTAGUAYwB1AHIAaQB0AHkAIAAtAEUAcgByAG8AcgBBAGMAdABpAG8AbgAgAFMAdABvAHAAOwAgACYAIAAnAEMAOgBcAFMAaQB0AGUAXwBpAG0AcABcAGsAYQBwAGkAbAAtAHcAaQBuAGQAbwB3AHMAXABKAGEAeQBlAHMAaABWAGUAZwBkAGEALQBLAGEAcABpAGwAXwBwAHIAbwAtADQAOQBjADUANgAxAGEAXABhAHUAdABvAG0AYQB0AGkAbwBuAFwAUwB5AG4AYwAtAEsAYQBwAGkAbABUAG8ARwBvAG8AZwBsAGUAUwBoAGUAZQB0AC4AcABzADEAJwAgAC0AVwBlAGIAQQBwAHAAVQByAGwAIAAnAGgAdAB0AHAAcwA6AC8ALwBzAGMAcgBpAHAAdAAuAGcAbwBvAGcAbABlAC4AYwBvAG0ALwBtAGEAYwByAG8AcwAvAHMALwBBAEsAZgB5AGMAYgB6AHoAdgBWADkASAAtAEIAdgBvAFAAYQBjAGkAdQB2AGoAZwBzAEQARQBYAHYAZgBBADEANQBGADYANgBCAFIAbQBtAHcAXwBrAEEAZQBDAEkAegBaAEcAdABVADEAZgBHAC0AZwBQADQATgBVAEcARwAwAGgAUQAtAGkAdgByAEsAawAvAGUAeABlAGMAJwA="
    exitCode := RunWait(command, , "Hide")
    if (exitCode != 0)
        TrayTip("Google Sheet sync failed. PowerShell exit code: " exitCode, "Sync Error")
    else
        TrayTip("Google Sheet refreshed successfully.", "Sync Complete")
    KeyWait("s")
}

CapsLock::{
    SetCapsLockState(GetKeyState("CapsLock", "T") ? "Off" : "On")
}
