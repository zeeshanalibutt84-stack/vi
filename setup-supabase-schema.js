// Setup Supabase database schema using service role key
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pgleeykalrxnsfmdhyjw.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnbGVleWthbHJ4bnNmbWRoeWp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDgwOTMyMSwiZXhwIjoyMDcwMzg1MzIxfQ.KFyWj9g3Dfi3FSkJQpWmmZgKrlJSiUzMwxBblJlA6co';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🚀 Setting up ViteCab schema in Supabase...\n');

const createSchema = async () => {
  try {
    console.log('📊 Creating database schema...');
    
    // Create the complete schema
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Enable UUID extension
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        -- Users table
        CREATE TABLE IF NOT EXISTS users (
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
        CREATE TABLE IF NOT EXISTS drivers (
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
        CREATE TABLE IF NOT EXISTS rides (
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
        CREATE TABLE IF NOT EXISTS system_settings (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          key VARCHAR(255) NOT NULL UNIQUE,
          value TEXT NOT NULL,
          description TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        -- Promo Codes table
        CREATE TABLE IF NOT EXISTS promo_codes (
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
        INSERT INTO system_settings (key, value, description) 
        VALUES
        ('base_fare', '5.00', 'Base fare for all rides in EUR'),
        ('per_km_rate', '2.50', 'Rate per kilometer in EUR'),
        ('per_minute_rate', '0.40', 'Rate per minute in EUR'),
        ('driver_commission', '0.20', 'Commission rate for drivers (20%)'),
        ('surge_enabled', 'true', 'Enable surge pricing'),
        ('max_surge_multiplier', '3.0', 'Maximum surge multiplier')
        ON CONFLICT (key) DO NOTHING;
      `
    });

    if (error) {
      console.log('❌ Schema creation failed:', error.message);
      return false;
    }

    console.log('✅ Database schema created successfully!');
    
    // Verify tables were created
    console.log('🔍 Verifying tables...');
    const { data: tables, error: tablesError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `
    });

    if (tablesError) {
      console.log('⚠️ Could not verify tables:', tablesError.message);
    } else {
      console.log('📋 Tables created:');
      tables?.forEach(table => console.log(`   - ${table.table_name}`));
    }

    return true;
  } catch (error) {
    console.log('❌ Setup failed:', error.message);
    return false;
  }
};

// Run the setup
createSchema().then(success => {
  if (success) {
    console.log('\n🎉 Supabase database ready for production!');
    console.log('📝 Next steps:');
    console.log('   1. Use this DATABASE_URL for production:');
    console.log('      postgresql://postgres:kdsUQYOrENg6Zp9u@db.pgleeykalrxnsfmdhyjw.supabase.co:5432/postgres');
    console.log('   2. Replace server/db.ts with production version when deploying');
    console.log('   3. Set environment variables on Hostinger');
  } else {
    console.log('\n💡 Manual setup required - use SQL Editor in Supabase dashboard');
  }
  
  process.exit(success ? 0 : 1);
});