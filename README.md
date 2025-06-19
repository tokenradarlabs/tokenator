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
3.  Create a `.env` file in the root and add your environment variables:
    ```env
    DISCORD_TOKEN=YOUR_DISCORD_BOT_TOKEN
    ```

## Development

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


## Basic Test

With the bot running and invited to a server:

- `!ping` -> `Pong!` (using default prefix).

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

- Implement the `/linkwallet [wallet_address]` command: Allow users to link their wallets.
- Accept multiple tokens
