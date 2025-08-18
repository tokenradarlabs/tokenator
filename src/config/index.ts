import { z } from 'zod';
import 'dotenv/config';

/**
 * Environment validation schema using Zod
 * Validates and transforms environment variables with proper types and defaults
 */
const envSchema = z.object({
  // Required variables
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  COINGECKO_API_KEY: z.string().min(1, 'COINGECKO_API_KEY is required'),
  ANKR_API_KEY: z.string().min(1, 'ANKR_API_KEY is required'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),

  // Optional variables with defaults
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

/**
 * Validates environment variables and returns typed configuration object
 * Throws an error with detailed information if validation fails
 */
function validateEnvironment() {
  try {
    const env = envSchema.parse(process.env);
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => {
        const path = err.path.join('.');
        return `${path}: ${err.message}`;
      });

      console.error('❌ Environment validation failed:');
      errorMessages.forEach(msg => console.error(`  - ${msg}`));
      console.error('\n💡 Please check your .env file and ensure all required variables are set.');
      console.error('📖 See .env.example for reference.');
      
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Validated and typed configuration object
 * All environment variables are validated and have proper types
 */
export const config = validateEnvironment();

/**
 * Type definition for the configuration object
 * Useful for TypeScript consumers of the config
 */
export type Config = typeof config;

/**
 * Utility function to check if we're in development mode
 */
export const isDevelopment = () => config.NODE_ENV === 'development';

/**
 * Utility function to check if we're in production mode
 */
export const isProduction = () => config.NODE_ENV === 'production';

/**
 * Utility function to check if we're in test mode
 */
export const isTest = () => config.NODE_ENV === 'test';

// Log successful configuration loading
if (isDevelopment()) {
  console.log('✅ Environment configuration loaded successfully');
}
