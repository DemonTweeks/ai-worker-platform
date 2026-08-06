@echo off
setlocal

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-services.ps1" %*
set "STOP_EXIT_CODE=%ERRORLEVEL%"

if not "%STOP_EXIT_CODE%"=="0" (
    echo.
    echo [ERROR] Service stop failed with exit code %STOP_EXIT_CODE%.
)

exit /b %STOP_EXIT_CODE%
