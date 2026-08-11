@echo off
setlocal

set "RUNTIME_PROFILE=%~1"
if not defined RUNTIME_PROFILE set "RUNTIME_PROFILE=local"

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher.ps1" -Profile "%RUNTIME_PROFILE%"
exit /b %ERRORLEVEL%
