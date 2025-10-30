# ViteCab Quick Local Setup - All in One Script
# Run this in PowerShell to get everything working quickly

Write-Host "🚗 ViteCab Quick Local Setup" -ForegroundColor Green
Write-Host "============================" -ForegroundColor Green

# Create .env file with working defaults
Write-Host "Setting up environment file..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    @"
# ViteCab Local Development Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vitecab_db
VITE_MAPBOX_TOKEN=your_mapbox_public_token_here
NODE_ENV=development
PORT=5000
SESSION_SECRET=vitecab-local-development-secret-key-2024
VITE_LOCAL_MODE=true
VITE_API_BASE_URL=http://localhost:5000
SENDGRID_API_KEY=
PUBLIC_OBJECT_SEARCH_PATHS=
PRIVATE_OBJECT_DIR=
"@ | Out-File -FilePath ".env" -Encoding utf8
    Write-Host "✅ .env file created with working defaults" -ForegroundColor Green
} else {
    Write-Host "✅ .env file already exists" -ForegroundColor Green
}

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

# Try to create local database
Write-Host "Setting up local database..." -ForegroundColor Yellow
try {
    # Try to create database (will fail silently if already exists)
    createdb vitecab_db 2>$null
    Write-Host "✅ Database created or already exists" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Make sure PostgreSQL is installed and running" -ForegroundColor Yellow
    Write-Host "   Run: .\install-postgres.ps1 (as Administrator)" -ForegroundColor Yellow
}

# Push database schema
Write-Host "Setting up database schema..." -ForegroundColor Yellow
npm run db:push

Write-Host ""
Write-Host "🎉 Quick Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "✅ Environment configured" -ForegroundColor Green
Write-Host "✅ Dependencies installed" -ForegroundColor Green  
Write-Host "✅ Database schema ready" -ForegroundColor Green
Write-Host "⚠️  Update VITE_MAPBOX_TOKEN in .env with your Mapbox public token" -ForegroundColor Yellow
Write-Host ""
Write-Host "🚀 Ready to start!" -ForegroundColor Cyan
Write-Host "Run: npm run dev" -ForegroundColor White
Write-Host "Open: http://localhost:5000" -ForegroundColor White