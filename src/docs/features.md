# Tokenator Bot Commands

Tokenator is a Discord bot that provides real-time cryptocurrency information and allows users to set up price alerts.

## Bot Slash Commands

The bot supports the following slash commands:

### Basic Commands

- **/ping**: A simple test command. The bot replies with "Pong!". This is useful for checking if the bot is online and responsive.

### Token Information Commands

- **/price `token-id`**: Fetches and displays the current price of that given token.
- **/mcap `token-id`**: Retrieves and displays the current market capitalization of that token.
- **/price-change `token-id`**: Shows the percentage change in that token's price over the last 24 hours, along with an emoji (📈 or 📉) indicating the direction of change.
- **/volume `token-id`**: Returns the 24-hour trading volume of that token.
- **/total-price `amount` `token-id`**: Calculates the USD price for a given amount of tokens.

### Price Alert Commands

- **/create-price-alert `token-id` `direction` `value`**: Creates a price alert for a token.
  - `token-id` (string): The token ID to create an alert for (e.g. scout-protocol-token)
  - `direction` (string): Price direction to alert on (Up/Down)
  - `value` (number): The price value to alert at
  - ⚡ **New**: Includes comprehensive validation to prevent invalid price values
- **/list-alerts `[direction]` `[type]` `[token]`**: Lists all price alerts for the current channel. Optional filters:
  - `direction` (string): Filter by direction (Up/Down)
  - `type` (string): Filter by alert type (currently only 'price' is supported)
  - `token` (string): Filter by token address
- **/edit-price-alert `id` `[direction]` `[value]`**: Edits an existing price alert.
  - `id` (string): The ID of the alert to edit (required)
  - `direction` (string): The new price direction to alert on (optional)
  - `value` (number): The new price value to alert at (optional)
  - ⚡ **New**: Validates new values against market conditions
- **/delete-alert `id`**: Deletes a price alert by its ID.
- **/enable-alert `id`**: Enables a price alert by its ID.
- **/disable-alert `id`**: Disables a price alert by its ID.

### Price Alert Validation Features 🛡️

**New Security & Usability Features:**

- ✅ **Positive Values Only**: Prevents negative or zero price alerts
- ✅ **Realistic Bounds**: Token-specific minimum and maximum price limits
- ✅ **Market Context**: Validates against current market prices
- ✅ **Direction Logic**: Ensures "up" alerts are above current price, "down" alerts below
- ✅ **Smart Suggestions**: Provides helpful error messages with suggested ranges
- ✅ **Multi-Source Pricing**: Uses database and CoinGecko for current price validation

**Supported Token Ranges:**

- **Bitcoin (BTC)**: $1 - $10,000,000
- **Ethereum (ETH)**: $1 - $500,000
- **Scout Protocol (DEV)**: $0.00001 - $100

---

For more information, please visit our GitHub repository.
