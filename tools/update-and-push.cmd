@echo off
setlocal
cd /d "%~dp0.."

set "LOGDIR=%LOCALAPPDATA%\campus-info-hub"
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
set "LOG=%LOGDIR%\update.log"

set "NODE=node"
where node >nul 2>nul
if errorlevel 1 set "NODE=C:\Users\OMEN\AppData\Local\OfficePLUSAgent\resources\runtime\node.exe"

echo [%DATE% %TIME%] crawl start>>"%LOG%"
"%NODE%" tools\crawler\crawl.mjs --pages=5 --max-new=80 >>"%LOG%" 2>&1
if errorlevel 1 (
  echo [%DATE% %TIME%] crawl failed>>"%LOG%"
  exit /b 1
)

git add web/data/school_data.js web/data/status.js
git diff --cached --quiet -- web/data/school_data.js web/data/status.js
if errorlevel 1 (
  git -c user.name="campus-info-bot" -c user.email="campus-info-bot@users.noreply.github.com" commit -m "chore(data): auto-update notices" >>"%LOG%" 2>&1
  if errorlevel 1 (
    echo [%DATE% %TIME%] commit failed>>"%LOG%"
    exit /b 1
  )
)

git fetch origin main >>"%LOG%" 2>&1
if errorlevel 1 (
  echo [%DATE% %TIME%] fetch failed>>"%LOG%"
  exit /b 1
)

set "AHEAD=0"
for /f %%n in ('git rev-list --count origin/main..HEAD') do set "AHEAD=%%n"
if "%AHEAD%"=="0" (
  echo [%DATE% %TIME%] up to date>>"%LOG%"
  exit /b 0
)

git pull --rebase origin main >>"%LOG%" 2>&1
if errorlevel 1 (
  echo [%DATE% %TIME%] rebase failed>>"%LOG%"
  exit /b 1
)

git push origin main >>"%LOG%" 2>&1
if errorlevel 1 (
  echo [%DATE% %TIME%] push failed>>"%LOG%"
  exit /b 1
)
echo [%DATE% %TIME%] pushed %AHEAD% commit(s)>>"%LOG%"
exit /b 0
