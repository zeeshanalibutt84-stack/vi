# ViteCab - Ride Booking Application

A full-stack ride-booking application for the French market with advanced geolocation and booking capabilities.

## Prerequisites

- Node.js 18+ 
- PostgreSQL database
- VS Code (recommended)
- PowerShell/Command Prompt

## Local Development Setup

### 1. Clone and Install Dependencies

```bash
# Install dependencies
npm install
```

### 2. Quick Environment Setup

**Option A: Super Quick (Recommended)**
```bash
# Run quick setup script (includes working defaults)
.\quick-setup.ps1
```

**Option B: Manual Setup**
```bash
# Copy environment template
copy .env.local .env

# Edit with your settings (optional - defaults work)
notepad .env
```

Default `.env` includes:
- Local PostgreSQL connection
- Working Mapbox token for testing
- Development server configuration

### 3. Database Setup

```bash
# Run database migrations
npm run db:push
```

### 4. Running the Application

```bash
# Start development server
npm run dev
```

The application will be available at: `http://localhost:5000`

## VS Code Setup

### Recommended Extensions

Install these VS Code extensions for better development experience:

1. **TypeScript and JavaScript Language Server** - Built-in
2. **Tailwind CSS IntelliSense** - `bradlc.vscode-tailwindcss`
3. **ES7+ React/Redux/React-Native snippets** - `dsznajder.es7-react-js-snippets`
4. **Auto Rename Tag** - `formulahendry.auto-rename-tag`
5. **Prettier - Code formatter** - `esbenp.prettier-vscode`

### VS Code Settings

Create `.vscode/settings.json`:

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "tailwindCSS.includeLanguages": {
    "typescript": "typescript",
    "typescriptreact": "typescriptreact"
  }
}
```

## PowerShell Commands

```powershell
# Install dependencies
npm install

# Start development server
npm run dev

# Database operations
npm run db:push          # Push schema changes
npm run db:studio        # Open database studio

# Build for production
npm run build

# Check for issues
npm run lint
```

## Project Structure

```
vitecab/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   └── lib/           # Utilities and configurations
├── server/                # Backend Express server
│   ├── routes.ts          # API routes
│   └── storage.ts         # Database operations
├── shared/                # Shared types and schemas
│   └── schema.ts          # Database schema
├── package.json           # Dependencies and scripts
├── vite.config.ts         # Vite configuration
└── drizzle.config.ts      # Database configuration
```

## Features

- **Booking System**: Complete allocab.com/welcomepickups.com style booking
- **Vehicle Types**: 4 vehicle categories for France market
- **Real-time Pricing**: Dynamic pricing with 10% TVA included
- **Map Integration**: Mapbox API for routes and geocoding
- **Document Upload**: Secure driver document management
- **Admin Dashboard**: Fleet management and pricing control

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   ```bash
   # Check PostgreSQL is running
   pg_ctl status
   
   # Verify DATABASE_URL in .env file
   ```

2. **Port Already in Use**
   ```bash
   # Kill process on port 5000
   netstat -ano | findstr :5000
   taskkill /PID <process_id> /F
   ```

3. **Module Not Found Errors**
   ```bash
   # Clear node_modules and reinstall
   rmdir /s node_modules
   del package-lock.json
   npm install
   ```

## API Endpoints

- `GET /api/rides` - Get ride history
- `POST /api/rides` - Create new ride booking
- `GET /api/drivers` - Get available drivers
- `POST /api/auth/login` - User authentication
- `GET /api/pricing` - Get pricing information

## Environment Variables Explained

- `DATABASE_URL`: PostgreSQL connection string
- `VITE_MAPBOX_TOKEN`: Mapbox public API key for maps
- `SESSION_SECRET`: Secret key for session encryption
- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 5000)

## License

Private - ViteCab Ride Sharing Platform