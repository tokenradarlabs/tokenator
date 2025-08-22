import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  COINGECKO_API_KEY: z.string().min(1, 'COINGECKO_API_KEY is required'),
  ANKR_API_KEY: z.string().min(1, 'ANKR_API_KEY is required'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),

  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

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

export const config = validateEnvironment();

export type Config = typeof config;

export const isDevelopment = () => config.NODE_ENV === 'development';

export const isProduction = () => config.NODE_ENV === 'production';

export const isTest = () => config.NODE_ENV === 'test';

if (isDevelopment()) {
  console.log('✅ Environment configuration loaded successfully');
}
