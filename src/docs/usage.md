# Tokenator Bot Usage

This document explains how to use the Tokenator Discord bot.

## Quickstart

This section provides a quick guide to get the Tokenator bot running and interacting with its core features.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/tokenradarlabs/tokenator.git
    cd tokenator
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```

### Configuration (Environment Variables)

The bot requires several environment variables to function correctly. Create a `.env` file in the project root based on `.env.example` and fill in the values.

```ini
# .env example
DISCORD_BOT_TOKEN="YOUR_DISCORD_BOT_TOKEN_HERE"
COINGECKO_API_KEY="YOUR_COINGECKO_API_KEY_HERE" # Optional, but recommended for higher rate limits
DATABASE_URL="postgresql://user:password@host:port/database?schema=public" # Your PostgreSQL database URL
```

*   `DISCORD_BOT_TOKEN`: Your Discord bot's token. Obtain this from the Discord Developer Portal.
*   `COINGECKO_API_KEY`: (Optional) An API key for CoinGecko. While the bot can function without it, providing one can help avoid rate-limiting issues with CoinGecko's public API.
*   `DATABASE_URL`: The connection string for your PostgreSQL database. Tokenator uses Prisma for database interactions.

### Running the Bot

To start the Tokenator bot and connect it to Discord:

1.  **Ensure your `.env` file is configured.**
2.  **Run database migrations:**
    ```bash
    npx prisma migrate deploy
    ```
3.  **Start the bot:**
    ```bash
    npm run start
    ```
    *(This command uses `ts-node src/index.ts` internally, as defined in `package.json`)*

Once the bot is running and invited to your Discord server (guild), you can interact with it using Discord slash commands. Commands are not invoked by passing arguments to `ts-node src/index.ts` directly after initial setup.

**Note:** The multi-line or colon-separated examples shown below are simplified documentation representations for readability. Users should invoke the slash command in Discord and then supply parameters via Discord's UI modal, not by typing colon-separated inline parameters.

### Example Alert Commands

Here are a few examples of how to create and list alerts using Discord slash commands. These commands interact with the logic defined in `src/alertCommands/`.

*   **Create a price alert:**
    ```
    /create-price-alert
    token-id: bitcoin
    direction: up
    value: 70000
    ```
    *(This command uses the logic from `src/alertCommands/createPriceAlert.ts`)*

*   **Create a volume alert:**
    ```
    /create-volume-alert
    token: ethereum
    direction: up
    volume: 100000000
    timeframe: 24h
    ```
    **Note on `timeframe`:** The `timeframe` parameter is required for volume alerts and accepts the following values: `24h`, `7d`, `30d`.
    *(This command uses the logic from `src/alertCommands/createVolumeAlert.ts`)*

*   **List all alerts:**
    ```
    /list-alerts
    ```
    *(This command uses the logic from `src/alertCommands/listAlerts.ts`)*

### Troubleshooting

If slash commands do not appear in your Discord server after starting the bot, ensure the bot has been invited with the necessary permissions and that application commands have been registered. Typically, inviting the bot with the `applications.commands` scope will handle registration automatically. If issues persist, restarting the bot process might help.

### Frequently Asked Questions (FAQ)

**Q: My bot isn't responding to commands. What should I do?**
A: First, check the bot's console output for any errors. Ensure your `DISCORD_BOT_TOKEN` is correct in your `.env` file and that the bot has been invited to your server with the `applications.commands` scope. A restart of the bot process (`npm run start`) often resolves temporary issues.

**Q: Slash commands are not showing up in Discord.**
A: This usually means the application commands haven't been registered with Discord. Ensure your bot is running and has the `applications.commands` OAuth2 scope when invited to your server. If you've recently added new commands, a bot restart might be necessary to re-register them.

**Q: How do I update the bot?**
A: To update, first stop the running bot process. Then, pull the latest changes from the Git repository (`git pull`), install any new dependencies (`npm install`), and run any new database migrations (`npx prisma migrate deploy`). Finally, restart the bot (`npm run start`).

**Q: I'm getting database connection errors.**
A: Verify that your `DATABASE_URL` in the `.env` file is correct and that your PostgreSQL database server is running and accessible from where the bot is hosted. Also, ensure you've run `npx prisma migrate deploy` to apply the latest database schema.

**Q: Can I run multiple instances of the bot?**
A: While technically possible, running multiple instances connected to the same Discord application token can lead to unexpected behavior and duplicate responses. It's generally recommended to run a single instance per Discord application.


## General Commands

### `/ping`
Checks if the bot is online. Replies with "Pong!".

### `/price`
Fetches and displays the current price of a supported token.
- **token-id**: The token to get the price for (e.g., `scout-protocol-token`, `bitcoin`, `ethereum`).

### `/mcap`
Returns the market capitalization of the token.
- **token-id**: The token to get the market cap for.

### `/price-change`
Returns the price change over the last 24 hours for the token.
- **token-id**: The token to get the price change for.

### `/volume`
Returns the 24-hour trading volume of the token.
- **token-id**: The token to get the volume for.

### `/total-price`
Calculates the USD price for a given amount of tokens.
- **amount**: The number of tokens.
- **token-id**: The token to calculate the total price for.

## Price Alert Commands

### `/create-price-alert`
Creates a new price alert.
- **token-id** (string): The token to create an alert for (supported: `dev`, `eth`, `btc`).
- **direction**: The price direction to alert on (`up` or `down`).
- **value**: The price value to trigger the alert.

### `/list-alerts`
Lists all price alerts for the current channel.
- **direction** (optional): Filter by direction (`up` or `down`).
- **type** (optional): Filter by alert type (currently only `price`).
- **token** (optional): Filter by token address.

### `/edit-price-alert`
Edits an existing price alert. This command requires 'Manage Channels' permission.
- **id**: The ID of the alert to edit.
- **direction** (optional): The new price direction (`up` or `down`).
- **value** (optional): The new price value.

### `/delete-alert`
Deletes a price alert by its ID. This command requires 'Manage Channels' permission.
- **id**: The ID of the alert to delete.

### `/enable-alert`
Enables a disabled price alert by its ID. This command requires 'Manage Channels' permission.
- **id**: The ID of the alert to enable.

### `/disable-alert`
Disables an active price alert by its ID. This command requires 'Manage Channels' permission.
- **id**: The ID of the alert to disable.
