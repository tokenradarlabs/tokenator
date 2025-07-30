## Bot Slash Commands

The bot supports the following slash commands:

### Basic Commands
- **`/ping`**: A simple test command. The bot replies with "Pong!". This is useful for checking if the bot is online and responsive.

### Token Information Commands
- **`/price`**: Takes 1 input `token-id`, Fetches and displays the current price of that given token.
- **`/mcap`**: Takes 1 input `token-id`, Retrieves and displays the current market capitalization of that token.
- **`/price-change`**: Takes 1 input `token-id`, Shows the percentage change in that token's price over the last 24 hours, along with an emoji (📈 or 📉) indicating the direction of change.
- **`/volume`**: Takes 1 input `token-id`, Returns the 24-hour trading volume of that token.
- **`/total-price`**: Takes 2 inputs: `amount` (number) and `token-id` (string), Calculates the USD price for a given amount of tokens.

### Price Alert Commands
- **`/create-price-alert`**: Creates a price alert for a token. Takes 3 inputs:
  - `token-id` (string): The token ID to create an alert for (e.g. scout-protocol-token)
  - `direction` (string): Price direction to alert on (Up/Down)
  - `value` (number): The price value to alert at
- **`/list-alerts`**: Lists all price alerts for the current channel. Optional filters:
  - `direction` (string): Filter by direction (Up/Down)
  - `type` (string): Filter by alert type (currently only 'price' is supported)
  - `token` (string): Filter by token address
- **`/edit-price-alert`**: Edits an existing price alert. Takes 1 required and 2 optional inputs:
  - `id` (string): The ID of the alert to edit (required)
  - `direction` (string): The new price direction to alert on (optional)
  - `value` (number): The new price value to alert at (optional)
- **`/delete-alert`**: Deletes a price alert by its ID. Takes 1 input:
  - `id` (string): The ID of the alert to delete
- **`/enable-alert`**: Enables a price alert by its ID. Takes 1 input:
  - `id` (string): The ID of the alert to enable
- **`/disable-alert`**: Disables a price alert by its ID. Takes 1 input:
  - `id` (string): The ID of the alert to disable
