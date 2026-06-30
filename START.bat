@echo off
REM Copper Shores - One-Click Startup Script for Windows
REM This script starts the backend server (which serves the frontend) and opens all sections
cd /d "%~dp0"

echo.
echo ========================================
echo   🐉 The Copper Shores - Startup
echo ========================================
echo.

REM Refuse to launch over an existing server on port 3000. A second backend
REM would immediately fail and leave the browser connected to stale code.
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %ERRORLEVEL% EQU 0 (
    echo Port 3000 is already in use.
    echo Close the existing Copper Shores Backend window or run STOP.bat,
    echo then run START.bat again.
    echo.
    pause
    exit /b 1
)

REM Start Backend Server (serves both API and frontend)
echo Starting Backend Server on port 3000...
echo (This server serves both the API and all frontend pages)
start "Copper Shores Backend" cmd /k "cd /d ""%~dp0backend"" && npm start"

REM Wait 3 seconds for backend to start
timeout /t 3 /nobreak

echo.
echo ✅ Server is starting!
echo.
echo Main Site:  http://localhost:3000
echo Admin:      http://localhost:3000/admin/
echo.

REM Open multiple browser tabs for different sections
echo Opening all sections in your default browser...

REM Main dashboard
start http://localhost:3000/

REM Map section
start http://localhost:3000/maps/

REM Gold/Treasure section
start http://localhost:3000/treasury/

REM Notes section
start http://localhost:3000/notes/

REM Players section
start http://localhost:3000/players/

REM Admin backups
start http://localhost:3000/admin/

echo.
echo To stop the server, close the command window.
pause
