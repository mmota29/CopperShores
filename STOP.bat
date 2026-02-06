@echo off
REM Copper Shores - Stop All Servers

echo.
echo ========================================
echo   🛑 Stopping Copper Shores Servers
echo ========================================
echo.

REM Kill node processes (backend and frontend servers)
echo Stopping all Node.js processes...
taskkill /F /IM node.exe /T 2>nul

if %ERRORLEVEL% == 0 (
    echo ✅ Servers stopped successfully
) else (
    echo ⚠️ No active servers found or already stopped
)

echo.
echo All servers stopped. You can now close this window.
pause
