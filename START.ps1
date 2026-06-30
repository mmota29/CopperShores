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

# Refuse to launch a second backend over an existing process. Otherwise the new
# server exits while the browser keeps talking to the older, stale server.
$existingListener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($existingListener) {
    Write-Host "Port 3000 is already in use." -ForegroundColor Red
    Write-Host "Close the existing Copper Shores Backend window or run STOP.bat, then run START.ps1 again." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Start Backend Server (which also serves the frontend)
Write-Host "Starting Backend Server on port 3000..." -ForegroundColor Yellow
Write-Host "(This server serves both the API and all frontend pages)" -ForegroundColor Gray
$backendPath = Join-Path $PSScriptRoot "backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location -LiteralPath '$backendPath'; npm start" -WindowStyle Normal

# Wait for backend to start
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "✅ Server is starting!" -ForegroundColor Green
Write-Host ""
Write-Host "Main Site:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "Admin:      http://localhost:3000/admin/" -ForegroundColor Cyan
Write-Host ""

# Open multiple browser tabs for different sections
Write-Host "Opening all sections in your default browser..." -ForegroundColor Yellow

# Main dashboard
Start-Process "http://localhost:3000/"

# Map section
Start-Process "http://localhost:3000/maps/"

# Gold/Treasure section
Start-Process "http://localhost:3000/treasury/"

# Notes section
Start-Process "http://localhost:3000/notes/"

# Players section
Start-Process "http://localhost:3000/players/"

# Admin backups
Start-Process "http://localhost:3000/admin/"

Write-Host ""
Write-Host "To stop the server, close the command window." -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to exit this startup window"
