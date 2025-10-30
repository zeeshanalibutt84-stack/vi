@echo off
echo Starting ViteCab Development Server...

REM Check if .env exists
if not exist ".env" (
    echo .env file not found. Please run setup.ps1 first.
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

REM Start the development server
echo Starting server on http://localhost:5000...
npm run dev
pause