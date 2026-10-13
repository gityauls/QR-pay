@echo off
setlocal
cd /d "%~dp0"

if not exist "package.json" (
  echo Project setup error: package.json was not found.
  exit /b 1
)

if /i "%~1"=="--check" (
  echo Project directory OK: %CD%
  exit /b 0
)

if not exist "node_modules" (
  echo First run: installing required packages...
  call npm.cmd install
  if errorlevel 1 (
    echo Package installation failed.
    pause
    exit /b 1
  )
)

echo Starting QR Pay at http://localhost:5173/
echo Keep this window open while using the app.
call npm.cmd run dev
