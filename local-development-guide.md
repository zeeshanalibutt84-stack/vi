# ViteCab Local Development Guide

## Quick Start (PowerShell)

### Option 1: Super Quick Setup (Recommended)
```powershell
# All-in-one setup with working defaults
.\quick-setup.ps1

# Start development server
npm run dev
```

### Option 2: Full Setup (with PostgreSQL installation)
```powershell
# Install PostgreSQL (as Administrator)
.\install-postgres.ps1

# Run setup script
.\setup.ps1

# Start development server
.\run-dev.ps1
```

### Option 2: Manual Setup

1. **Install Prerequisites**
   ```powershell
   # Install Node.js 18+ from https://nodejs.org
   # Install PostgreSQL from https://www.postgresql.org
   ```

2. **Install Dependencies**
   ```powershell
   npm install
   ```

3. **Environment Setup**
   ```powershell
   # Copy environment template
   copy .env.example .env
   
   # Edit .env file with your settings
   notepad .env
   ```

4. **Database Setup**
   ```powershell
   # Push database schema
   npm run db:push
   ```

5. **Start Development Server**
   ```powershell
   npm run dev
   ```

## VS Code Setup

1. **Open Project**
   ```powershell
   code .
   ```

2. **Install Extensions**
   - Extensions will be automatically suggested
   - Or install manually:
     - Tailwind CSS IntelliSense
     - ES7+ React/Redux snippets
     - Auto Rename Tag
     - Prettier - Code formatter

3. **Debug Configuration**
   - Press `F5` to start debugging
   - Or use `Ctrl+Shift+P` → "Debug: Start Debugging"

## Environment Variables (.env)

```env
# Required
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vitecab_db
VITE_MAPBOX_TOKEN=pk.your_mapbox_token_here

# Optional
SESSION_SECRET=your-random-secret-here
SENDGRID_API_KEY=your-sendgrid-key-here
```

## Available Scripts

```powershell
# Development
npm run dev              # Start full application
npm run dev:client       # Start only frontend
npm run dev:server       # Start only backend

# Database
npm run db:push          # Apply schema changes
npm run db:studio        # Open database studio
npm run db:generate      # Generate migrations

# Build
npm run build            # Build for production
npm run build:client     # Build frontend only
npm run build:server     # Build backend only

# Other
npm run check            # Type checking
npm start                # Start production server
```

## Troubleshooting

### Port 5000 Already in Use
```powershell
# Find process using port 5000
netstat -ano | findstr :5000

# Kill the process
taskkill /PID <process_id> /F
```

### Database Connection Issues
```powershell
# Check PostgreSQL service
Get-Service -Name postgresql*

# Start PostgreSQL service
Start-Service postgresql-x64-15
```

### Module Not Found Errors
```powershell
# Clear and reinstall
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

### Permission Errors
```powershell
# Run PowerShell as Administrator
# Set execution policy
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## Project Structure for Local Development

```
vitecab/
├── client/                 # Frontend (React + TypeScript)
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── pages/         # Page components
│   │   ├── lib/           # Utilities
│   │   └── App.tsx        # Main app component
│   └── index.html
├── server/                 # Backend (Express + TypeScript)
│   ├── index.ts           # Server entry point
│   ├── routes.ts          # API routes
│   └── storage.ts         # Database operations
├── shared/                 # Shared types
│   └── schema.ts          # Database schema
├── .vscode/               # VS Code configuration
│   ├── settings.json      # Editor settings
│   ├── launch.json        # Debug configuration
│   └── extensions.json    # Recommended extensions
├── .env                   # Environment variables
├── setup.ps1              # Setup script
├── run-dev.ps1            # Development script
└── README.md              # Documentation
```

## Development Workflow

1. **Make Changes**
   - Edit files in `client/src/` for frontend
   - Edit files in `server/` for backend
   - Edit `shared/schema.ts` for database changes

2. **Database Changes**
   ```powershell
   # After schema changes
   npm run db:push
   ```

3. **Testing**
   - Frontend: http://localhost:5000
   - API: http://localhost:5000/api/*
   - Database: `npm run db:studio`

4. **Debugging**
   - Use VS Code debugger (F5)
   - Check browser console for frontend issues
   - Check PowerShell terminal for backend logs

## Production Build

```powershell
# Build application
npm run build

# Test production build
npm start
```

## Getting Help

- Check README.md for full documentation
- Review error logs in PowerShell terminal
- Use VS Code debugger for step-by-step debugging
- Check browser developer tools for frontend issues