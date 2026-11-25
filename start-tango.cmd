@echo off
rem Launch Tango for local development.
rem Run this from Windows (double-click or terminal), not from a restricted shell:
rem Electron needs to write %APPDATA%\tango. --no-sandbox is required because
rem Electron's sandbox cannot start in this environment.
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  call npm install || goto :error
)

start "Tango Vite" /min cmd /c "npx vite --host 127.0.0.1 --strictPort --config ui/vite.config.mts"
call npx tsc -p tsconfig.node.json || goto :error
call npx wait-on tcp:5173 || goto :error

".\node_modules\electron\dist\electron.exe" --no-sandbox .
goto :eof

:error
echo.
echo Tango could not start. See the messages above.
pause
