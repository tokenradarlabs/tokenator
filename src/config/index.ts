import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required').describe('Discord bot token for authentication'),
  COINGECKO_API_KEY: z.string().min(1, 'COINGECKO_API_KEY is required').describe('CoinGecko API key for cryptocurrency data'),
  ANKR_API_KEY: z.string().min(1, 'ANKR_API_KEY is required').describe('Ankr API key for blockchain data'),
  COINGECKO_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60).describe('CoinGecko cache time-to-live in seconds, defaults to 60 seconds'),
  COINGECKO_API_CACHE_COOLDOWN_SECONDS_MIN: z.coerce.number().int().positive().default(5).describe('Minimum cooldown in seconds for CoinGecko API cache'),
  COINGECKO_API_CACHE_COOLDOWN_SECONDS_MAX: z.coerce.number().int().positive().default(300).describe('Maximum cooldown in seconds for CoinGecko API cache'),
  COINGECKO_API_FREE_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(250).describe('Rate limit for CoinGecko Free API tier in requests per minute'),
  COINGECKO_API_PRO_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(1000).describe('Rate limit for CoinGecko Pro API tier in requests per minute'),
  COINGECKO_API_PLAN: z.enum(['free', 'pro']).default('free').describe('CoinGecko API plan (free or pro)'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL').describe('Database connection URL'),

  NODE_ENV: z.enum(['development', 'production', 'test']).default('development').describe('Application environment'),
});

function validateEnvironment() {
  try {
    const env = envSchema.parse(process.env);
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => {
        const path = err.path.join('.');
        const fieldSchema = envSchema.shape[path as keyof typeof envSchema.shape];
        const description = fieldSchema && 'description' in fieldSchema._def ? fieldSchema._def.description : '';
        return `${path}: ${err.message}${description ? ` (${description})` : ''}`;
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
