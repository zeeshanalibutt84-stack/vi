# ViteCab Production Deployment Guide

## Overview
This guide covers deploying your ViteCab application to Hostinger with external cloud services.

## Development vs Production Architecture

### Development (Current - Replit)
- **Database**: Replit PostgreSQL
- **Files**: Cloudinary (already configured)
- **Email**: SendGrid (ready)
- **Maps**: Mapbox (integrated)

### Production (Hostinger)
- **Database**: Your Supabase PostgreSQL
- **Files**: Cloudinary (same configuration)
- **Email**: SendGrid (same configuration)
- **Maps**: Mapbox (same configuration)

## Pre-Deployment Setup

### 1. Database Migration Strategy
Since Replit has network restrictions to Supabase, follow this two-step process:

#### Step A: Export Schema from Development
```bash
# Export your current database schema
npm run db:generate
```

#### Step B: Manual Schema Setup on Supabase
1. Go to your Supabase SQL Editor
2. Run this SQL to create the schema:

```sql
-- ViteCab Database Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'customer' CHECK (role IN ('customer', 'driver', 'admin', 'partner')),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  phone VARCHAR(20),
  profile_picture VARCHAR(500),
  is_verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(255),
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Drivers table
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  license_number VARCHAR(255) NOT NULL UNIQUE,
  vehicle_make VARCHAR(255) NOT NULL,
  vehicle_model VARCHAR(255) NOT NULL,
  vehicle_year INTEGER NOT NULL,
  vehicle_color VARCHAR(100) NOT NULL,
  vehicle_plate VARCHAR(50) NOT NULL UNIQUE,
  vehicle_type VARCHAR(100) NOT NULL,
  is_online BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  documents JSONB,
  current_latitude DECIMAL(10,8),
  current_longitude DECIMAL(11,8),
  earnings_balance DECIMAL(10,2) DEFAULT 0.00,
  total_rides INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 5.00,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Rides table
CREATE TABLE rides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES users(id),
  driver_id UUID REFERENCES users(id),
  pickup_location VARCHAR(500) NOT NULL,
  dropoff_location VARCHAR(500) NOT NULL,
  pickup_latitude DECIMAL(10,8),
  pickup_longitude DECIMAL(11,8),
  dropoff_latitude DECIMAL(10,8),
  dropoff_longitude DECIMAL(11,8),
  vehicle_type VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'cancelled')),
  estimated_fare DECIMAL(10,2),
  final_fare DECIMAL(10,2),
  distance DECIMAL(8,2),
  duration INTEGER,
  payment_method VARCHAR(50) DEFAULT 'cash',
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed')),
  scheduled_for TIMESTAMPTZ,
  passenger_count INTEGER DEFAULT 1,
  special_requests TEXT,
  extras JSONB,
  surge_multiplier DECIMAL(3,2) DEFAULT 1.00,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- System Settings table
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(255) NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Promo Codes table
CREATE TABLE promo_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) NOT NULL UNIQUE,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10,2) NOT NULL,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Insert default system settings
INSERT INTO system_settings (key, value, description) VALUES
('base_fare', '5.00', 'Base fare for all rides in EUR'),
('per_km_rate', '2.50', 'Rate per kilometer in EUR'),
('per_minute_rate', '0.40', 'Rate per minute in EUR'),
('driver_commission', '0.20', 'Commission rate for drivers (20%)'),
('surge_enabled', 'true', 'Enable surge pricing'),
('max_surge_multiplier', '3.0', 'Maximum surge multiplier');
```

### 2. Environment Variables for Production

Create these environment variables in your Hostinger hosting:

```env
# Database
DATABASE_URL=postgresql://postgres:kdsUQYOrENg6Zp9u@db.pgleeykalrxnsfmdhyjw.supabase.co:5432/postgres

# File Storage (Cloudinary)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email Service (SendGrid)
SENDGRID_API_KEY=your_sendgrid_api_key

# Maps (Mapbox)
VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_token

# Security
JWT_SECRET=your_secure_random_string
SESSION_SECRET=your_session_secret

# Production
NODE_ENV=production
```

## Hostinger Deployment Steps

### 1. Prepare Files
1. Download your project files (exclude node_modules)
2. Upload to Hostinger file manager
3. Ensure all environment variables are set

### 2. Database Configuration for Production
Update `server/db.ts` for production use:

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

// Production configuration for Supabase
const client = postgres(process.env.DATABASE_URL, {
  ssl: 'require',
  max: 10,
});

export const db = drizzle(client, { schema });
```

### 3. Install Dependencies & Build
```bash
npm install --production
npm run build
```

### 4. Start Production Server
```bash
npm start
```

## Service Integration Status

### ✅ Ready for Production
- **Cloudinary**: File storage configured
- **SendGrid**: Email service ready  
- **Mapbox**: Location services integrated

### 🔧 Requires Setup
- **Supabase**: Database schema needs manual creation
- **Production Environment**: Environment variables configuration

## Benefits of This Architecture

### 🚀 **Performance**
- Cloudinary CDN for global file delivery
- Supabase optimized PostgreSQL
- SendGrid professional email delivery

### 🔒 **Security**
- All services use secure, professional-grade infrastructure
- No local file storage vulnerabilities
- SSL/TLS encryption throughout

### 📈 **Scalability**
- Auto-scaling with usage
- Global distribution
- Professional monitoring

## Testing Your Production Setup

After deployment, verify:

1. **Database Connection**: User registration works
2. **File Uploads**: Driver documents save to Cloudinary
3. **Email Service**: Account verification emails sent
4. **Maps Integration**: Booking form location services work

## Troubleshooting

### Database Issues
- Verify Supabase PROJECT is active
- Check DATABASE_URL format
- Ensure SSL is enabled

### File Upload Issues
- Confirm Cloudinary credentials
- Check CORS settings
- Verify upload folder permissions

### Email Issues
- Validate SendGrid API key
- Check sender verification
- Review email templates

Your ViteCab application is architecturally ready for professional hosting with enterprise-grade external services!