# Copper Shores - One-Click Startup Script for PowerShell
# Right-click this file and select "Run with PowerShell"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   🐉 The Copper Shores - Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "Checking if Node.js is installed..." -ForegroundColor Yellow
$nodeCheck = node --version 2>$null
if ($null -eq $nodeCheck) {
    Write-Host "❌ Node.js not found! Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit
}
Write-Host "✅ Node.js $nodeCheck found" -ForegroundColor Green
Write-Host ""

# Start Backend Server
Write-Host "Starting Backend Server on port 3000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$pwd\backend'; npm start" -WindowStyle Normal

# Wait for backend to start
Start-Sleep -Seconds 2

# Start Frontend Server
Write-Host "Starting Frontend Server on port 8000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$pwd\frontend'; npx http-server -p 8000" -WindowStyle Normal

# Wait a moment
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "✅ Both servers are starting!" -ForegroundColor Green
Write-Host ""
Write-Host "Backend:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:8000" -ForegroundColor Cyan
Write-Host ""

# Open browser
Write-Host "Opening website in your default browser..." -ForegroundColor Yellow
Start-Process "http://localhost:8000"

Write-Host ""
Write-Host "To stop the servers, close the command windows." -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to exit this startup window"
