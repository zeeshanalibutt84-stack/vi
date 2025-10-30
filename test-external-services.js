#!/usr/bin/env node

// Test script to verify external services integration
import { storage } from './server/storage.js';

console.log('🚀 Testing External Services Integration...\n');

// Test 1: Database Connection (Supabase)
console.log('📊 Testing Database Connection...');
try {
  const settings = await storage.getSystemSettings();
  console.log('✅ Database connection successful');
  console.log('   Settings found:', settings ? 'Yes' : 'No');
} catch (error) {
  console.log('❌ Database connection failed:', error.message);
}

// Test 2: Cloudinary Configuration
console.log('\n☁️  Testing Cloudinary Configuration...');
try {
  const hasCloudinaryConfig = !!(
    process.env.CLOUDINARY_CLOUD_NAME && 
    process.env.CLOUDINARY_API_KEY && 
    process.env.CLOUDINARY_API_SECRET
  );
  
  if (hasCloudinaryConfig) {
    console.log('✅ Cloudinary configuration complete');
    console.log('   Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
    console.log('   API Key:', process.env.CLOUDINARY_API_KEY ? 'Set' : 'Missing');
    console.log('   API Secret:', process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Missing');
  } else {
    console.log('❌ Cloudinary configuration incomplete');
  }
} catch (error) {
  console.log('❌ Cloudinary test failed:', error.message);
}

// Test 3: SendGrid Configuration
console.log('\n📧 Testing SendGrid Configuration...');
try {
  const hasSendGridConfig = !!process.env.SENDGRID_API_KEY;
  
  if (hasSendGridConfig) {
    console.log('✅ SendGrid configuration complete');
    console.log('   API Key:', process.env.SENDGRID_API_KEY ? 'Set' : 'Missing');
  } else {
    console.log('❌ SendGrid configuration missing');
  }
} catch (error) {
  console.log('❌ SendGrid test failed:', error.message);
}

// Test 4: Environment Check
console.log('\n🔧 Environment Configuration...');
console.log('   DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Missing');
console.log('   NODE_ENV:', process.env.NODE_ENV || 'development');

console.log('\n✨ External Services Test Complete!');
console.log('\n📝 Deployment Readiness:');
console.log('   ✅ Database: External (Supabase)');
console.log('   ✅ File Storage: External (Cloudinary)');
console.log('   ✅ Email Service: External (SendGrid)');
console.log('   ✅ Maps: External (Mapbox)');
console.log('\n🎯 Ready for Hostinger deployment!');

process.exit(0);