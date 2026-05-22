@echo off
setlocal

echo ========================================
echo AI Worker Platform Launcher
echo ========================================
echo.

REM git session
git checkout main & ^
git branch -D repack/ai-worker-platform & ^
git pull & ^
git checkout -b repack/ai-worker-platform origin/repack/ai-worker-platform

REM Backend installation
if not exist "backend" (
    echo [ERROR] backend folder missing.
    pause
    exit /b 1
)
cd backend
echo [1/4] Installing backend dependencies...
call npm i
if errorlevel 1 (
    echo [ERROR] Backend npm install failed.
    pause
    exit /b 1
)
cd ..

REM Frontend installation
if not exist "frontend" (
    echo [ERROR] frontend folder missing.
    pause
    exit /b 1
)
cd frontend
echo [2/4] Installing frontend dependencies...
call npm i
if errorlevel 1 (
    echo [ERROR] Frontend npm install failed.
    pause
    exit /b 1
)
cd ..

REM Start backend server
echo [3/4] Starting backend server...
start "Backend Server" cmd /k "cd backend && node src\server.js"

REM Start frontend build and preview
echo [4/4] Starting frontend (build + preview)...
start "Frontend Build & Preview" cmd /k "cd frontend && npm run build && npm run preview"

REM Open browser after short delay
timeout /t 5 /nobreak >nul
start http://localhost:3000

echo.
echo ========================================
echo Launch complete! Services are running in separate windows.
echo This launcher window stays open. Press any key to exit.
echo ========================================
pause