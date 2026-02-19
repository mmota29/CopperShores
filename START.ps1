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

# Start Backend Server (which also serves the frontend)
Write-Host "Starting Backend Server on port 3000..." -ForegroundColor Yellow
Write-Host "(This server serves both the API and all frontend pages)" -ForegroundColor Gray
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$pwd\backend'; npm start" -WindowStyle Normal

# Wait for backend to start
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "✅ Server is starting!" -ForegroundColor Green
Write-Host ""
Write-Host "Main Site:  http://localhost:3000" -ForegroundColor Cyan
Write-Host ""

# Open multiple browser tabs for different sections
Write-Host "Opening all sections in your default browser..." -ForegroundColor Yellow

# Main dashboard
Start-Process "http://localhost:3000/index.html"

# Map section
Start-Process "http://localhost:3000/map.html"

# Gold/Treasure section
Start-Process "http://localhost:3000/gold.html"

# Notes section
Start-Process "http://localhost:3000/notes.html"

# Players section
Start-Process "http://localhost:3000/players.html"

Write-Host ""
Write-Host "To stop the server, close the command window." -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to exit this startup window"
