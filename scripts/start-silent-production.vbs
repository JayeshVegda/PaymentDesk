Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\PaymentDesk"
WshShell.Run "cmd /c set NODE_ENV=production&& set NODE_OPTIONS=--max-old-space-size=512&& node --env-file-if-exists=.env scripts/start-production.mjs", 0, False
