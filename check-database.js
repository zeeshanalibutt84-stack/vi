// Simple database connection test
const DATABASE_URL = process.env.DATABASE_URL;

console.log('🔍 Checking DATABASE_URL...');
console.log('URL provided:', DATABASE_URL ? 'Yes' : 'No');

if (DATABASE_URL) {
  // Parse the URL to check format
  try {
    const url = new URL(DATABASE_URL);
    console.log('✅ URL format valid');
    console.log('   Protocol:', url.protocol);
    console.log('   Host:', url.hostname);
    console.log('   Port:', url.port);
    console.log('   Database:', url.pathname);
    console.log('   Username:', url.username);
    console.log('   Password:', url.password ? 'Provided' : 'Missing');
    
    // Check for common Supabase patterns
    if (url.hostname.includes('supabase.co')) {
      console.log('✅ Supabase hostname detected');
      
      // Check if password is encoded
      if (url.password && url.password.includes('%')) {
        console.log('⚠️  Password appears to be URL-encoded');
        console.log('   Try decoding special characters in password');
      }
    } else {
      console.log('⚠️  Non-Supabase hostname detected');
    }
    
  } catch (error) {
    console.log('❌ Invalid URL format');
    console.log('   Error:', error.message);
    console.log('\n📝 Expected format:');
    console.log('   postgresql://postgres:[YOUR-PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres');
  }
} else {
  console.log('❌ DATABASE_URL not found');
  console.log('\n📝 Please add your Supabase DATABASE_URL:');
  console.log('   1. Go to Supabase Dashboard');
  console.log('   2. Settings > Database');
  console.log('   3. Copy "Connection string" URI');
  console.log('   4. Replace [YOUR-PASSWORD] with your actual password');
}

console.log('\n🔧 Next steps:');
console.log('   1. Verify DATABASE_URL is correctly formatted');
console.log('   2. Ensure password is URL-decoded (no % symbols)');
console.log('   3. Test connection from Supabase dashboard first');