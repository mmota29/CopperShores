@echo off
REM Copper Shores - One-Click Startup Script for Windows
REM This script starts both backend and frontend servers automatically

echo.
echo ========================================
echo   🐉 The Copper Shores - Startup
echo ========================================
echo.

REM Start Backend Server
echo Starting Backend Server on port 3000...
start "Copper Shores Backend" cmd /k "cd backend && npm start"

REM Wait 2 seconds for backend to start
timeout /t 2 /nobreak

REM Start Frontend Server
echo Starting Frontend Server on port 8000...
start "Copper Shores Frontend" cmd /k "cd frontend && npx http-server -p 8000"

REM Wait 2 seconds and open browser
timeout /t 2 /nobreak

echo.
echo ✅ Both servers are starting!
echo.
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:8000
echo.

REM Open the website in default browser
start http://localhost:8000

echo Opening website in your default browser...
echo.
echo To stop the servers, close the command windows.
pause
