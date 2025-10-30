# PostgreSQL Installation and Setup Script for Windows
# Run as Administrator

Write-Host "🐘 PostgreSQL Setup for ViteCab" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

# Check if running as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "❌ This script must be run as Administrator" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    pause
    exit 1
}

# Check if Chocolatey is installed
try {
    choco --version | Out-Null
    Write-Host "✅ Chocolatey found" -ForegroundColor Green
} catch {
    Write-Host "Installing Chocolatey package manager..." -ForegroundColor Yellow
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
}

# Install PostgreSQL
Write-Host "Installing PostgreSQL..." -ForegroundColor Yellow
choco install postgresql15 --params '/Password:postgres' -y

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ PostgreSQL installed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to install PostgreSQL" -ForegroundColor Red
    exit 1
}

# Wait for PostgreSQL service to start
Start-Sleep -Seconds 10

# Create database
Write-Host "Creating ViteCab database..." -ForegroundColor Yellow
try {
    & "C:\Program Files\PostgreSQL\15\bin\createdb.exe" -U postgres -h localhost vitecab_db
    Write-Host "✅ Database 'vitecab_db' created" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Database might already exist or PostgreSQL not ready" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 PostgreSQL Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Database Details:" -ForegroundColor Cyan
Write-Host "Host: localhost" -ForegroundColor White
Write-Host "Port: 5432" -ForegroundColor White
Write-Host "Database: vitecab_db" -ForegroundColor White
Write-Host "Username: postgres" -ForegroundColor White
Write-Host "Password: postgres" -ForegroundColor White
Write-Host ""
Write-Host "Update your .env file with:" -ForegroundColor Yellow
Write-Host "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vitecab_db" -ForegroundColor Green