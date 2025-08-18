#!/usr/bin/env node

/**
 * Simple test script to verify environment validation
 * This script can be run to test the configuration without starting the full bot
 */

console.log('🔍 Testing environment configuration validation...\n');

// Test 1: Valid configuration (if .env exists)
try {
  const { config } = require('./dist/config');
  console.log('✅ Configuration loaded successfully!');
  console.log(`   Environment: ${config.NODE_ENV}`);
  console.log(`   Discord Token: ${config.DISCORD_TOKEN ? '***set***' : 'missing'}`);
  console.log(`   CoinGecko API Key: ${config.COINGECKO_API_KEY ? '***set***' : 'missing'}`);
  console.log(`   ANKR API Key: ${config.ANKR_API_KEY ? '***set***' : 'missing'}`);
  console.log(`   Database URL: ${config.DATABASE_URL ? '***set***' : 'missing'}`);
  console.log('');
} catch (error) {
  console.error('❌ Configuration validation failed:');
  console.error(error.message);
  console.log('\n💡 This is expected if you haven\'t set up your .env file yet.');
  console.log('📖 Copy .env.example to .env and fill in the required values.');
  process.exit(1);
}

console.log('🎉 Configuration validation test completed successfully!');
