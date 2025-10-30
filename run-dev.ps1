# Quick development server startup script
# Run this in PowerShell to start the development server

Write-Host "🚗 Starting ViteCab Development Server..." -ForegroundColor Green

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ .env file not found. Please run setup.ps1 first." -ForegroundColor Red
    exit 1
}

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Start the development server
Write-Host "Starting server on http://localhost:5000..." -ForegroundColor Green
npm run dev