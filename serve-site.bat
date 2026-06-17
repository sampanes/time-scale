@echo off
setlocal
cd /d "%~dp0"

REM ============================================================
REM  serve-site.bat - build To Scale: Time, then serve it in a
REM  window NAMED "to-scale-time" so it is easy to find and kill.
REM  Idempotent: tears down any prior instance before starting,
REM  so re-running replaces the old server instead of stacking a
REM  second one on the next port up.
REM  Stop it with: stop-serve.bat   (or Ctrl+C in the window)
REM ============================================================

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

REM --- tear down any previous instance first ---
taskkill /FI "WINDOWTITLE eq to-scale-time*" /T /F >nul 2>&1

echo.
echo Starting "to-scale-time" on http://127.0.0.1:8126 ...
start "to-scale-time" cmd /c "cd /d %~dp0 && %PYTHON% scripts\serve-site.py --root _site --host 0.0.0.0 --port 8126 || pause"

echo.
echo   Window title : to-scale-time
echo   URL          : http://127.0.0.1:8126/  (also on your LAN IP for phones)
echo   To stop      : run stop-serve.bat  (or Ctrl+C in that window)
echo.
endlocal
