# Configuration System

This document describes the centralized configuration system implemented in Tokenator.

## Overview

The configuration system provides:
- **Environment validation** using Zod schema validation
- **Type safety** for all configuration values
- **Centralized access** to environment variables
- **Fail-fast behavior** with clear error messages

## Usage

```typescript
import { config, isDevelopment, isProduction } from '../config';

// Instead of process.env.DISCORD_TOKEN
const token = config.DISCORD_TOKEN; // Type: string (guaranteed to exist)

// Environment checking utilities
if (isDevelopment()) {
  console.log('Running in development mode');
}
```

## Environment Variables

### Required Variables

| Variable | Type | Description |
|----------|------|-------------|
| `DISCORD_TOKEN` | string | Discord bot authentication token |
| `COINGECKO_API_KEY` | string | CoinGecko API key for price data |
| `ANKR_API_KEY` | string | ANKR API key for Base network RPC |
| `DATABASE_URL` | string (URL) | PostgreSQL connection string |

### Optional Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `NODE_ENV` | `development` \| `production` \| `test` | `development` | Runtime environment |

## Validation

The system validates all environment variables at startup:

1. **Required variables** must be present and non-empty
2. **Optional variables** are validated if present
3. **Type conversion** happens automatically (e.g., PORT string → number)
4. **Clear error messages** show exactly what's missing or invalid

## Testing Configuration

Test your environment setup without starting the full bot:

```bash
npm run test:config
```

This command:
1. Builds the project
2. Loads and validates configuration
3. Shows all configuration values (with sensitive data masked)
4. Reports any validation errors

## Error Handling

If validation fails, the application will:
1. Display specific error messages for each invalid variable
2. Show helpful hints about checking `.env.example`
3. Exit with code 1 to prevent startup with invalid configuration

Example error output:
```
❌ Environment validation failed:
  - DISCORD_TOKEN: String must contain at least 1 character(s)
  - DATABASE_URL: Invalid url
  
💡 Please check your .env file and ensure all required variables are set.
📖 See .env.example for reference.
```

## Migration from Direct process.env Usage

The old pattern:
```typescript
const token = process.env.DISCORD_TOKEN;
if (!token) {
  throw new Error('DISCORD_TOKEN is required');
}
```

The new pattern:
```typescript
import { config } from '../config';
const token = config.DISCORD_TOKEN; // Already validated, never undefined
```

## Benefits

1. **Type Safety**: Configuration values have proper TypeScript types
2. **Fail Fast**: Invalid configuration is caught at startup, not runtime
3. **DRY Principle**: No repeated validation logic throughout the codebase
4. **Developer Experience**: Clear error messages and autocomplete support
5. **Maintainability**: Single source of truth for all configuration
