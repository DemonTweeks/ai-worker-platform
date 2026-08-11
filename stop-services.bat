@echo off
setlocal

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-services.ps1" %*
exit /b %ERRORLEVEL%
