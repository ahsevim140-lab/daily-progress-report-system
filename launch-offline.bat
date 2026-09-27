@echo off
setlocal
pushd "%~dp0"
if not exist dist\index.html (
  echo Offline build is missing. Run npm run build first.
  pause
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required. Install Node.js, then run this file again.
  pause
  exit /b 1
)
start "DPRS Offline" cmd /c "node offline-server.mjs"
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:3000
popd
