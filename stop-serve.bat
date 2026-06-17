@echo off
REM ============================================================
REM  stop-serve.bat - tear down the "to-scale-time" server.
REM  1) kills the named window (and its python child tree)
REM  2) falls back to whatever is LISTENING on :8126
REM ============================================================

echo Stopping "to-scale-time" ...
taskkill /FI "WINDOWTITLE eq to-scale-time*" /T /F
if not errorlevel 1 goto done

echo No matching window - checking port 8126 ...
set "FOUND="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :8126 ^| findstr LISTENING') do (
  set "FOUND=1"
  echo   killing PID %%p
  taskkill /PID %%p /F
)
if not defined FOUND echo Nothing listening on :8126 - already stopped.

:done
echo Done.
