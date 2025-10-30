// Create test users for all roles in the database
import { db } from './server/db.ts';
import { users } from './shared/schema.ts';
import bcrypt from 'bcryptjs';

console.log('🚀 Setting up test users for ViteCab...\n');

const createTestUsers = async () => {
  try {
    console.log('📋 Creating test accounts...');
    
    // Hash password for all test users
    const hashedPassword = await bcrypt.hash('test123', 10);
    
    const testUsers = [
      {
        username: 'admin',
        email: 'admin@vitecab.com',
        password: hashedPassword,
        role: 'admin',
        first_name: 'Admin',
        last_name: 'User',
        phone: '+33123456789',
        is_verified: true
      },
      {
        username: 'testdriver',
        email: 'driver@vitecab.com', 
        password: hashedPassword,
        role: 'driver',
        first_name: 'Test',
        last_name: 'Driver',
        phone: '+33123456790',
        is_verified: true
      },
      {
        username: 'customer1',
        email: 'customer@vitecab.com',
        password: hashedPassword,
        role: 'customer', 
        first_name: 'Test',
        last_name: 'Customer',
        phone: '+33123456791',
        is_verified: true
      },
      {
        username: 'partner1',
        email: 'partner@vitecab.com',
        password: hashedPassword,
        role: 'partner',
        first_name: 'Test', 
        last_name: 'Partner',
        phone: '+33123456792',
        is_verified: true
      }
    ];

    // Insert test users
    for (const user of testUsers) {
      try {
        const [createdUser] = await db.insert(users).values(user).returning();
        console.log(`✅ Created ${user.role}: ${user.email} (password: test123)`);
      } catch (error) {
        if (error.message.includes('duplicate key value')) {
          console.log(`ℹ️  User ${user.email} already exists`);
        } else {
          console.log(`❌ Failed to create ${user.email}:`, error.message);
        }
      }
    }

    console.log('\n🎉 Test users setup complete!');
    console.log('\n📋 Login Credentials:');
    console.log('   Admin: admin@vitecab.com / test123');
    console.log('   Driver: driver@vitecab.com / test123'); 
    console.log('   Customer: customer@vitecab.com / test123');
    console.log('   Partner: partner@vitecab.com / test123');
    
    console.log('\n💡 All accounts are verified and ready to use!');
    
  } catch (error) {
    console.log('❌ Setup failed:', error.message);
    return false;
  }
  
  return true;
};

// Run setup
createTestUsers().then(success => {
  process.exit(success ? 0 : 1);
});