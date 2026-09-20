@echo off
setlocal EnableExtensions
pushd "%~dp0"
title Daily Progress Report System

echo ================================================
echo   Daily Progress Report System
echo ================================================
echo.

if not exist package.json goto :not_extracted

rem ---- 1. Node.js -------------------------------------------------------
call :probe_node
if defined NODE_OK goto :node_ready

echo Node.js 20.19+ or 22.12+ is required and was not found on this PC.
call :install_node
call :refresh_path
call :probe_node
if not defined NODE_OK goto :node_failed

:node_ready
echo Node.js %NODE_MAJOR%.%NODE_MINOR% found.
call npm --version >nul 2>nul
if errorlevel 1 goto :node_failed

rem ---- 2. Dependencies --------------------------------------------------
rem Re-install when node_modules is missing, incomplete, copied from another
rem OS/CPU, or when package-lock.json changed since the last install.
call :hash_lock
set "STAMP=node_modules\.dprs-install-stamp"
set "HAVE="
if exist "%STAMP%" set /p HAVE=<"%STAMP%"
if not exist "node_modules\.bin\vite.cmd" set "HAVE="
if "%HAVE%"=="%WANT%" goto :deps_ready

echo.
echo Installing dependencies. The first run can take a few minutes and needs internet access...
if exist package-lock.json (
  call npm ci --no-audit --no-fund
) else (
  call npm install --no-audit --no-fund
)
if errorlevel 1 (
  echo.
  echo The first install attempt failed. Retrying with npm install...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :deps_failed
)
if not exist "node_modules\.bin\vite.cmd" goto :deps_failed
call :hash_lock
>"%STAMP%" echo %WANT%

:deps_ready
rem ---- 3. Run -----------------------------------------------------------
echo.
echo Starting the application. The browser should open automatically.
echo Keep this window open while using the application. Press Ctrl+C to stop it.
echo.
call npm run dev -- --open
echo.
echo The application has stopped.
pause
popd
exit /b 0

rem ======================================================================
:not_extracted
echo ERROR: package.json was not found next to this file.
echo If you opened this from inside a .zip file, extract the whole folder first,
echo then run launch.bat from the extracted folder.
goto :fail

:node_failed
echo.
echo Node.js could not be installed or is not visible yet.
echo - If an installer just ran: close this window and double-click launch.bat again.
echo - Otherwise install Node.js LTS manually from https://nodejs.org/ and run this file again.
goto :fail

:deps_failed
echo.
echo ERROR: Installing dependencies failed.
echo Check the internet connection (and proxy settings if you are on a company network),
echo then run launch.bat again. If it keeps failing, delete the node_modules folder first.
goto :fail

:fail
echo.
pause
popd
exit /b 1

rem ======================================================================
rem Sets NODE_OK when a suitable Node is on PATH (Vite 6 / plugin-react 5 need 20.19+ or 22.12+).
:probe_node
set "NODE_OK="
set "NODE_MAJOR="
set "NODE_MINOR="
where node >nul 2>nul
if errorlevel 1 goto :eof
for /f "tokens=1,2 delims=." %%a in ('node -p "process.versions.node" 2^>nul') do (
  if not defined NODE_MAJOR set "NODE_MAJOR=%%a"
  if not defined NODE_MINOR set "NODE_MINOR=%%b"
)
if not defined NODE_MAJOR goto :eof
if not defined NODE_MINOR goto :eof
if %NODE_MAJOR% GEQ 23 set "NODE_OK=1"
if %NODE_MAJOR% EQU 22 if %NODE_MINOR% GEQ 12 set "NODE_OK=1"
if %NODE_MAJOR% EQU 20 if %NODE_MINOR% GEQ 19 set "NODE_OK=1"
goto :eof

rem Try winget first, then a direct, checksum-verified download from nodejs.org.
:install_node
echo Installing Node.js LTS. Windows may ask for permission - please click Yes.
echo.
where winget >nul 2>nul
if errorlevel 1 goto :install_node_direct
winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
call :refresh_path
call :probe_node
if defined NODE_OK goto :eof
echo winget did not finish the installation. Trying a direct download instead...
:install_node_direct
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-node.ps1"
goto :eof

rem A freshly installed Node is not on this window's PATH yet; add its default folders.
:refresh_path
set "PATH=%ProgramFiles%\nodejs;%LocalAppData%\Programs\nodejs;%PATH%"
goto :eof

rem WANT = hash of package-lock.json + CPU type, so a changed lockfile triggers a reinstall.
:hash_lock
set "WANT=nolock"
if exist package-lock.json for /f "delims=" %%H in ('certutil -hashfile package-lock.json SHA256 ^| findstr /v ":"') do set "WANT=%%H"
set "WANT=%WANT: =%-%PROCESSOR_ARCHITECTURE%"
goto :eof
