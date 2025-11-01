<p align="center">
  <img src="tokenator.png" alt="Tokenator Logo" width="180"/>
</p>

# Tokenator
 A Discord bot that provides quick, real-time token price updates and market info on demand.

<div style="display: flex; gap: 10px;">
  <a href="https://discord.com/oauth2/authorize?client_id=1210908193337970739">
    <img src="https://img.shields.io/badge/Discord-Invite%20to%20Server-5865F2?logo=discord&logoColor=white" alt="Discord">
  </a>
</div>

## Setup

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Copy the example environment file and fill in the values:
    ```bash
    cp .env.example .env
    ```
    Required variables:
    - `DISCORD_TOKEN`
    - `COINGECKO_API_KEY`
    - `ANKR_API_KEY`
    - `DATABASE_URL`

    Optional variables:
    - `NODE_ENV` (defaults to `development`)

4.  Test your configuration:
    ```bash
    npm run test:config
    ```
    This will validate your environment variables and show you any missing or invalid values.

## Development

- Test configuration:
  ```bash
  npm run test:config
  ```
- Compile TypeScript:
  ```bash
  npm run build
  ```
- Run the compiled bot:
  ```bash
  npm start
  ```
- Run in development mode (uses `ts-node` and `nodemon` for live reload):
  ```bash
  npm run dev
  ```

## Configuration

The bot uses a centralized configuration system with environment validation:

- **Environment validation**: All required environment variables are validated at startup using Zod schema validation
- **Type safety**: Configuration is fully typed for better development experience  
- **Fail fast**: The bot will exit with clear error messages if required variables are missing
- **Centralized access**: All environment variables are accessed through the `config` object instead of `process.env`

To test your configuration without starting the full bot, run:
```bash
npm run test:config
```


## Basic Test

With the bot running and invited to a server:

- `!ping` -> `Pong!` (using default prefix).

## Slash Commands
- [Bot Slash Commands](/src/docs/features.md)

## Project Structure

- `src/`: TypeScript source files (main logic in `src/index.ts`).
- `package.json`: Project metadata, dependencies, and scripts.
- `tsconfig.json`: TypeScript compiler options.
- `.env`: For environment variables (token, prefix - ignored by Git).
- `.gitignore`: Specifies intentionally untracked files.

## Contributing

1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## TODO

- Implement the `/linkwallet [wallet_address]` command to allow users to link their wallets.
- Accept multiple tokens 
