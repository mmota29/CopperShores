@echo off
REM Copper Shores - One-Click Startup Script for Windows
REM This script starts the backend server (which serves the frontend) and opens all sections

echo.
echo ========================================
echo   🐉 The Copper Shores - Startup
echo ========================================
echo.

REM Start Backend Server (serves both API and frontend)
echo Starting Backend Server on port 3000...
echo (This server serves both the API and all frontend pages)
start "Copper Shores Backend" cmd /k "cd backend && npm start"

REM Wait 3 seconds for backend to start
timeout /t 3 /nobreak

echo.
echo ✅ Server is starting!
echo.
echo Main Site:  http://localhost:3000
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

echo.
echo To stop the server, close the command window.
pause
