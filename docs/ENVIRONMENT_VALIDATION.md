# Environment Variable Validation

This document outlines the environment variables used by the Tokenator application and how they are validated. Proper configuration of these variables is crucial for the application's correct operation.

## Validation Logic

The application uses `zod` for robust environment variable validation. The schema is defined in [`src/config/index.ts`](../src/config/index.ts). This ensures that all necessary variables are present and correctly formatted before the application starts.

## Required Environment Variables

The following table lists the essential environment variables that must be set for the Tokenator application.

| Variable Name | Type | Required | Default | Description | Example |
|---------------|------|----------|---------|-------------|---------|
| `NODE_ENV` | `enum` (`development`, `production`, `test`) | Yes | `development` | Application environment. | `development`, `production`, `test` |
| `PORT` | `number` | Yes | `3000` | The port on which the application server will listen. | `3000` |
| `DISCORD_TOKEN` | `string` | Yes | None | Discord bot token for authentication. | `YOUR_DISCORD_BOT_TOKEN` |
| `COINGECKO_API_KEY` | `string` | Yes | None | CoinGecko API key for cryptocurrency data. | `YOUR_COINGECKO_API_KEY` |
| `ANKR_API_KEY` | `string` | Yes | None | Ankr API key for blockchain data. | `YOUR_ANKR_API_KEY` |
| `COINGECKO_CACHE_TTL_SECONDS` | `number` | Yes | `60` | CoinGecko cache time-to-live in seconds. | `60` |
| `COINGECKO_API_CACHE_COOLDOWN_SECONDS_MIN` | `number` | Yes | `60` | Minimum cooldown in seconds for CoinGecko API cache. | `60` |
| `COINGECKO_API_CACHE_COOLDOWN_SECONDS_MAX` | `number` | Yes | `300` | Maximum cooldown in seconds for CoinGecko API cache. | `300` |
| `COINGECKO_API_FREE_RATE_LIMIT_PER_MINUTE` | `number` | Yes | `30` | Rate limit for CoinGecko Free API tier in requests per minute. | `30` |
| `COINGECKO_API_PRO_RATE_LIMIT_PER_MINUTE` | `number` | Yes | `1000` | Rate limit for CoinGecko Pro API tier in requests per minute. | `1000` |
| `COINGECKO_API_PLAN` | `enum` (`free`, `pro`) | Yes | `free` | CoinGecko API plan. | `free`, `pro` |
| `COINGECKO_API_TIMEOUT_MS` | `number` | Yes | `5000` | Timeout for CoinGecko API requests in milliseconds. | `5000` |
| `DATABASE_URL` | `string` | Yes | None | Database connection URL. | `postgresql://user:password@host:port/database` |
| `REDIS_URL` | `string` | No | None | (Optional) Redis connection URL for rate limiting and caching. | `redis://localhost:6379` |
| `UNISWAP_SUBGRAPH_URL` | `string` | No | None | (Optional) URL for the Uniswap subgraph. Required for Uniswap price fetching. | `https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2` |

## Examples

### `.env` File Example

For local development, you can create a `.env` file in the project root:

```dotenv
NODE_ENV=development
PORT=3000
DISCORD_TOKEN="your_discord_bot_token_here"
COINGECKO_API_KEY="your_coingecko_api_key_here"
ANKR_API_KEY="your_ankr_api_key_here"
COINGECKO_CACHE_TTL_SECONDS=60
COINGECKO_API_CACHE_COOLDOWN_SECONDS_MIN=60
COINGECKO_API_CACHE_COOLDOWN_SECONDS_MAX=300
COINGECKO_API_FREE_RATE_LIMIT_PER_MINUTE=30
COINGECKO_API_PRO_RATE_LIMIT_PER_MINUTE=1000
COINGECKO_API_PLAN=free
COINGECKO_API_TIMEOUT_MS=5000
DATABASE_URL="postgresql://user:password@localhost:5432/tokenator_dev"
REDIS_URL="redis://localhost:6379"
UNISWAP_SUBGRAPH_URL="https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2"
```

### Docker Compose Example

When deploying with Docker Compose, you can specify environment variables in your `docker-compose.yml`:

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      DISCORD_TOKEN: ${DISCORD_TOKEN}
      COINGECKO_API_KEY: ${COINGECKO_API_KEY}
      ANKR_API_KEY: ${ANKR_API_KEY}
      COINGECKO_CACHE_TTL_SECONDS: 60
      COINGECKO_API_CACHE_COOLDOWN_SECONDS_MIN: 60
      COINGECKO_API_CACHE_COOLDOWN_SECONDS_MAX: 300
      COINGECKO_API_FREE_RATE_LIMIT_PER_MINUTE: 30
      COINGECKO_API_PRO_RATE_LIMIT_PER_MINUTE: 1000
      COINGECKO_API_PLAN: pro # Example of setting to pro
      COINGECKO_API_TIMEOUT_MS: 5000
      DATABASE_URL: postgresql://user:password@db:5432/tokenator_prod
      REDIS_URL: redis://redis:6379
      UNISWAP_SUBGRAPH_URL: ${UNISWAP_SUBGRAPH_URL}
    depends_on:
      - db
      - redis
  db:
    image: postgres:13
    environment:
      POSTGRES_DB: tokenator_prod
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
  redis:
    image: redis:6-alpine
```

## Important Notes

*   **Security:** Never commit sensitive API keys or database credentials directly into your version control system. Use environment variables or a secure secret management system.
*   **Validation Errors:** If environment variable validation fails, the application will log detailed error messages and exit. Ensure all required variables are correctly set according to the specified types and formats.