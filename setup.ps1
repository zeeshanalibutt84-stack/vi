# ViteCab Local Development Setup Script
# Run this in PowerShell as Administrator

Write-Host "🚗 ViteCab Local Development Setup" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

# Check if Node.js is installed
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js 18+ from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Check if PostgreSQL is installed
Write-Host "Checking PostgreSQL installation..." -ForegroundColor Yellow
try {
    $pgVersion = psql --version
    Write-Host "✅ PostgreSQL found: $pgVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️  PostgreSQL not found. You'll need to install it from https://www.postgresql.org/download/" -ForegroundColor Yellow
}

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "Creating .env file from local template..." -ForegroundColor Yellow
    Copy-Item ".env.local" ".env"
    Write-Host "✅ .env file created with local development defaults." -ForegroundColor Green
    
    # Automatically set up database URL for local PostgreSQL
    $envContent = Get-Content ".env"
    $envContent = $envContent -replace "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vitecab_db", "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vitecab_db"
    $envContent | Set-Content ".env"
    
    Write-Host "⚠️  You still need to:" -ForegroundColor Yellow
    Write-Host "   - Get free Mapbox token from https://mapbox.com and update VITE_MAPBOX_TOKEN" -ForegroundColor Yellow
    Write-Host "   - Make sure PostgreSQL is running with database 'vitecab_db'" -ForegroundColor Yellow
} else {
    Write-Host "✅ .env file already exists" -ForegroundColor Green
}

# Check if VS Code is installed
try {
    $codeVersion = code --version
    Write-Host "✅ VS Code found: $($codeVersion[0])" -ForegroundColor Green
    
    # Install recommended extensions
    Write-Host "Installing VS Code extensions..." -ForegroundColor Yellow
    $extensions = @(
        "bradlc.vscode-tailwindcss",
        "dsznajder.es7-react-js-snippets",
        "formulahendry.auto-rename-tag",
        "esbenp.prettier-vscode"
    )
    
    foreach ($ext in $extensions) {
        code --install-extension $ext --force
    }
    Write-Host "✅ VS Code extensions installed" -ForegroundColor Green
} catch {
    Write-Host "⚠️  VS Code not found. Install from https://code.visualstudio.com/" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Update .env file with your database and API keys" -ForegroundColor White
Write-Host "2. Run 'npm run db:push' to setup database" -ForegroundColor White
Write-Host "3. Run 'npm run dev' to start the application" -ForegroundColor White
Write-Host "4. Open http://localhost:5000 in your browser" -ForegroundColor White
Write-Host ""
Write-Host "For VS Code: Open this folder and press F5 to debug" -ForegroundColor Cyan