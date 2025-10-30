// Simple test to check if we can connect to Supabase
import pkg from 'pg';
const { Client } = pkg;

console.log('🔗 Testing Supabase Database Connection...\n');

const databaseUrl = process.env.DATABASE_URL;
console.log('Database URL:', databaseUrl ? 'Provided' : 'Missing');

if (!databaseUrl) {
  console.log('❌ No DATABASE_URL found');
  process.exit(1);
}

const client = new Client({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  try {
    console.log('🔄 Attempting to connect...');
    await client.connect();
    console.log('✅ Connected to Supabase successfully!');
    
    // Test a simple query
    console.log('🔄 Running test query...');
    const result = await client.query('SELECT version()');
    console.log('✅ Database query successful');
    console.log('   PostgreSQL Version:', result.rows[0].version.split(' ')[0]);
    
    // Check if tables exist
    console.log('🔄 Checking existing tables...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    if (tablesResult.rows.length > 0) {
      console.log('✅ Found existing tables:');
      tablesResult.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    } else {
      console.log('ℹ️  No custom tables found (fresh database)');
    }
    
  } catch (error) {
    console.log('❌ Connection failed:');
    console.log('   Error:', error.message);
    console.log('   Code:', error.code);
    
    if (error.code === 'ENOTFOUND') {
      console.log('\n💡 DNS Resolution Issue:');
      console.log('   - Check internet connectivity');
      console.log('   - Verify Supabase project is active');
      console.log('   - Confirm hostname in DATABASE_URL');
    } else if (error.code === '28P01') {
      console.log('\n💡 Authentication Issue:');
      console.log('   - Verify password is correct');
      console.log('   - Check if special chars are properly encoded');
    }
  } finally {
    try {
      await client.end();
      console.log('🔚 Connection closed');
    } catch (e) {
      // Connection might already be closed
    }
  }
}

testConnection();