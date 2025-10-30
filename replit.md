# Replit.md

## Overview
This is a full-stack ride-booking application, ViteCab, designed to support customers, drivers, and administrators. It offers a comprehensive platform for ride booking, driver management, and administrative oversight, aiming to provide a robust solution for the ride-sharing market. The project has undergone an Uber-style redesign and rebranding to "ViteCab", focusing on advanced booking features, surge pricing, and a user-friendly interface.

## User Preferences
Preferred communication style: Simple, everyday language.
- User communication: Prefers Roman Urdu for explanations and questions
- Design preference: Simple, readable designs over colorful themes - specifically dislikes blue colors (except for homepage hero section which should remain original)
- Homepage layout: Keep original homepage design unchanged, only apply green theme to dedicated booking page
- Navigation requirements: Keep only main "Become a Driver" and "Partner" tabs, remove all dropdown menus
- Document requirements: Remove background check option from driver documents
- Partner system: Change "Affiliate Programme" to "Become a Partner" with full email verification and login option
- Object storage: Documents saved in Replit's default bucket with private directory for security
- Login system: Needs partner login option added alongside driver and admin login options
- France market focus: Vehicle types must match France market with Euro pricing
- Booking system: Premium booking form with global Mapbox autocomplete, France/Paris priority location suggestions, live driver tracking with ETA/distance display, real-time route visualization
- Driver categorization: Drivers only see rides for their specific Country/City/Car Class combination
- TVA requirements: All driver prices must include 10% TVA (Value Added Tax)
- Fleet management: Admin control over ride assignment and pricing with fixed payment to drivers
- Local development: Requires VS Code and PowerShell compatibility with easy setup scripts and working defaults
- Password security: Drivers need ability to change passwords through dedicated page
- Instant payout removal: Remove all instant payout options from driver earnings
- Billing downloads: Provide workable download option for driver billing statements with commission and tax breakdown
- Admin panel visibility: Fixed white text/invisible elements to black text with visible circles (30% opacity backgrounds)
- KYC management: Added null checks for documents object to prevent clicking errors
- Password management: Added admin password update functionality in dedicated Account tab
- Live driver tracking: Real-time driver locations on map with distance/ETA, connection lines from nearest driver to pickup, pickup-to-dropoff route visualization
- Location autocomplete: Global Mapbox integration with France/Paris priority suggestions, fixed route pricing display, enhanced fallback locations
- Booking form enhancements: Trip type selection (Airport vs City Transfer), comprehensive extra options (child seats, luggage, meet & greet, WiFi, etc.), detailed price breakdown with extras calculation
- Map integration: Side-by-side booking form and live map display with conditional rendering based on location selection
- Live driver tracking implementation: Real-time driver movement simulation, nearest driver display with ETA/distance, pickup-to-dropoff route visualization with connecting lines, interactive tracking controls with start/stop functionality
- Enhanced Mapbox integration: Streets-v12 style with proper road visualization, traffic condition overlay with color-coded congestion levels (green/orange/red), 3D pitch for better road visibility
- Careem/Google Maps style tracking: Live driver position updates, route lines from driver to pickup then pickup to destination, real-time ETA/distance calculations, driver profile card with contact options
- Premium booking experience: Dedicated premium booking page (/premium-booking) with live tracking demo, interactive driver tracking controls, comprehensive feature showcase

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query
- **UI Components**: Shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form with Zod
- **Build Tool**: Vite
- **UI/UX Decisions**: Uber-style redesign with a black, white, and gray color palette, modern typography, and sophisticated card shadows. All "Uber" references are rebranded to "ViteCab".

### Backend
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT tokens with bcrypt
- **API Design**: RESTful API with role-based access control
- **Session Management**: Server-side sessions with connect-pg-simple

### Database Schema
Key entities include Users (customer, driver, admin roles), Drivers (profile, vehicle, verification), Rides (requests, tracking, status), System Settings (pricing), and Promo Codes. The schema is extended to support Uber-specific fields like surge pricing, tips, tolls, and wait times.

### Core Features & Design
- **Authentication & Authorization**: JWT-based with role-based access control (customer, driver, admin).
- **Ride Management**: Real-time booking, fare estimation, status tracking (pending, accepted, in_progress, completed, cancelled), GPS location storage, vehicle type selection (expanded to 18 options for France market), scheduled rides, and a comprehensive booking API with various pricing models (distance, flat route, hourly).
- **Driver Management**: Registration, verification (simplified from KYC), vehicle information, online/offline status, earnings, and document uploads (license, registration, insurance, vehicle photo, driver photo).
- **Admin Dashboard**: User and system settings management, promo codes, analytics, and driver verification controls.
- **Surge Pricing Engine**: Dynamic pricing based on demand and driver availability, time-based and zone-based activation, and admin controls.
- **Email Verification & Document Upload**: Complete email verification system via SendGrid and secure document upload to Replit's default bucket with pre-signed URLs.

## External Dependencies

### Frontend
- React, React DOM, React Hook Form
- TanStack Query
- Wouter
- Shadcn/ui, Radix UI
- Tailwind CSS
- Lucide React
- Zod

### Backend
- Express.js
- Drizzle ORM with @neondatabase/serverless
- bcryptjs
- jsonwebtoken
- connect-pg-simple
- SendGrid (for email services)
- Cloudinary (for document/image storage)
- Multer (for file upload handling)

### External Services Integration
- **Database**: Two-tier approach - Replit PostgreSQL for development, Supabase PostgreSQL for production (due to network restrictions)
- **File Storage**: Cloudinary (documents, photos, profile images) - fully configured
- **Email Service**: SendGrid (verification, notifications) - ready for production
- **Maps**: Mapbox (location services, route planning) - integrated
- **Production Strategy**: Manual database schema setup for Supabase when deploying to Hostinger

### Development
- TypeScript
- Vite
- ESBuild
- PostCSS, Autoprefixer