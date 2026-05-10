@echo off
setlocal

cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 (
  set "PYTHON=python"
) else (
  where py >nul 2>nul
  if %errorlevel%==0 (
    set "PYTHON=py -3"
  ) else (
    echo Python was not found on PATH.
    pause
    exit /b 1
  )
)

echo Building To Scale: Time...
call npm run build
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b %errorlevel%
)

echo.
echo Starting local server...
%PYTHON% scripts\serve-site.py --root _site --host 0.0.0.0 --port 8126

echo.
echo Server exited.
pause
