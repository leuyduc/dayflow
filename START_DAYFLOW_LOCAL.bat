@echo off
setlocal
chcp 65001 >nul
title DAYFLOW V2 - LOCAL PREVIEW

rem DayFlow V2 - one-click Windows local review runner.
rem Only runs on 127.0.0.1 using an isolated local PostgreSQL sandbox.
rem No Linux server, production database, or public network access is changed.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Please install Node.js 22.12+ and reopen this window.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm is missing. Install Node.js with npm.
  pause
  exit /b 1
)

node -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]>22||v[0]===22&&v[1]>=12?0:1)"
if errorlevel 1 (
  echo ERROR: DayFlow needs Node.js 22.12 or newer.
  pause
  exit /b 1
)

if not exist "node_modules\vite\package.json" (
  echo Installing project dependencies in this local repo...
  call npm ci
  if errorlevel 1 (
    echo ERROR: npm ci failed.
    pause
    exit /b 1
  )
)

if not exist ".artifacts\postgres-sandbox\node_modules\embedded-postgres\dist\index.js" (
  echo Installing the isolated test-only PostgreSQL 17 package...
  if not exist ".artifacts\postgres-sandbox" mkdir ".artifacts\postgres-sandbox"
  call npm install --prefix .artifacts/postgres-sandbox embedded-postgres@17.10.0-beta.17 --no-audit --no-fund
  if errorlevel 1 (
    echo ERROR: isolated PostgreSQL package install failed.
    pause
    exit /b 1
  )
)

echo ========================================================
echo  DAYFLOW - LOCAL REVIEW (NOT PRODUCTION)
echo  Data and demo login stay in .artifacts
echo  Keep this window open. Stop with Ctrl+C or q then Enter.
echo ========================================================
if /I "%~1"=="--smoke" (
  call npm run demo:smoke
) else (
  call npm run demo:local
)
if errorlevel 1 (
  echo ERROR: DayFlow local preview exited with an error.
  pause
  exit /b 1
)
echo DayFlow preview stopped. Demo data remains on this PC.
if /I "%~1"=="--smoke" exit /b 0
pause
endlocal
