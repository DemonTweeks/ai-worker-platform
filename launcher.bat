@echo off
setlocal

echo ========================================
echo AI Worker Platform Launcher
echo ========================================
echo.

REM git session
git checkout main & ^
git branch -D repack/ai-worker-platform & ^
git pull --recurse-submodules & ^
git submodule update --init --recursive & ^
git checkout -b repack/ai-worker-platform origin/repack/ai-worker-platform

REM sync skills to branches declared in .gitmodules
git submodule sync --recursive
if errorlevel 1 exit /b 1
git submodule update --init --recursive
if errorlevel 1 exit /b 1

for /f "delims=" %%B in ('git config -f .gitmodules --get submodule.skills/create-pr-cd.branch') do set "CREATE_PR_CD_BRANCH=%%B"
if not defined CREATE_PR_CD_BRANCH exit /b 1
git -C skills/create-pr-cd fetch origin %CREATE_PR_CD_BRANCH%
if errorlevel 1 exit /b 1
git -C skills/create-pr-cd switch %CREATE_PR_CD_BRANCH%
if errorlevel 1 exit /b 1
git -C skills/create-pr-cd merge --ff-only origin/%CREATE_PR_CD_BRANCH%
if errorlevel 1 exit /b 1

for /f "delims=" %%B in ('git config -f .gitmodules --get submodule.skills/tx-pr-auditor.branch') do set "TX_PR_AUDITOR_BRANCH=%%B"
if not defined TX_PR_AUDITOR_BRANCH exit /b 1
git -C skills/tx-pr-auditor fetch origin %TX_PR_AUDITOR_BRANCH%
if errorlevel 1 exit /b 1
git -C skills/tx-pr-auditor switch %TX_PR_AUDITOR_BRANCH%
if errorlevel 1 exit /b 1
git -C skills/tx-pr-auditor merge --ff-only origin/%TX_PR_AUDITOR_BRANCH%
if errorlevel 1 exit /b 1

REM Backend installation
if not exist "backend" (
    echo [ERROR] backend folder missing.
    pause
    exit /b 1
)
cd backend

echo [1/5] Installing backend dependencies...
call npm i
if errorlevel 1 (
    echo [ERROR] Backend npm install failed.
    pause
    exit /b 1
)
cd ..

REM Install additional Python dependencies for skills
cd skills\create-pr-cd
echo [2/5] Installing Python skills dependencies...
call pip install -r requirements.txt --break-system-packages
if errorlevel 1 (
    echo [ERROR] Python requirements installation failed.
    pause
    exit /b 1
)
cd ..\..

REM Frontend installation
if not exist "frontend" (
    echo [ERROR] frontend folder missing.
    pause
    exit /b 1
)
cd frontend

echo [3/5] Installing frontend dependencies...
call npm i
if errorlevel 1 (
    echo [ERROR] Frontend npm install failed.
    pause
    exit /b 1
)
cd ..

REM Start backend server
echo [4/5] Starting backend server...
start "Backend Server" cmd /k "cd backend && node src\server.js"

REM Start frontend build and preview
echo [5/5] Starting frontend (build + preview)...
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
