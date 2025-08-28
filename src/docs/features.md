# Tokenator Bot Commands

Tokenator is a Discord bot that provides real-time cryptocurrency information and allows users to set up price alerts.

## Bot Slash Commands

The bot supports the following slash commands:

### Basic Commands
- **/ping**: A simple test command. The bot replies with "Pong!". This is useful for checking if the bot is online and responsive.

### Token Information Commands
- **/price `token-id`**: Fetches and displays the current price of the given token.
  - Supported tokens:
    - scout-protocol-token (DEV Token)
    - bitcoin (Bitcoin)
    - ethereum (Ethereum)
- **/mcap `token-id`**: Retrieves and displays the current market capitalization of that token.
- **/price-change `token-id`**: Shows the percentage change in that token's price over the last 24 hours, along with an emoji (📈 or 📉) indicating the direction of change.
- **/volume `token-id`**: Returns the 24-hour trading volume of that token.
- **/total-price `amount` `token-id`**: Calculates the USD price for a given amount of tokens.


### Alert Commands (Price & Volume)

#### Alert Statistics
- **/alert-stats**: Shows statistics for alerts in the current channel, including counts of enabled/disabled alerts by type and direction.

#### Create Alerts
- **/create-price-alert `token-id` `direction` `value`**: Creates a price alert for of the given token.
  - Supported tokens:
    - scout-protocol-token (DEV Token)
    - bitcoin (Bitcoin)
    - ethereum (Ethereum)
- **/create-volume-alert `token-id` `direction` `value`**: Creates a volume alert of the given token.
  - Supported tokens:
    - scout-protocol-token (DEV Token)
    - bitcoin (Bitcoin)
    - ethereum (Ethereum)

#### List Alerts
- **/list-alerts `[direction]` `[type]` `[token]`**: Lists all alerts for the current channel. Optional filters:
  - `direction` (string): Filter by direction (Up/Down)
  - `type` (string): Filter by alert type (`price`, `volume`, or `all`)
  - `token` (string): Filter by token address
  - `enabled` (boolean): Filter by enabled status (true for enabled, false for disabled)

#### Edit Alerts
- **/edit-price-alert `id` `[direction]` `[value]`**: Edits an existing price alert.
  - `id` (string): The ID of the alert to edit (required)
  - `direction` (string): The new price direction to alert on (optional)
  - `value` (number): The new price value to alert at (optional)
- **/edit-volume-alert `id` `[direction]` `[value]`**: Edits an existing volume alert.
  - `id` (string): The ID of the volume alert to edit (required)
  - `direction` (string): The new volume direction to alert on (optional)
  - `value` (number): The new volume value to alert at (optional)

#### Delete Alerts
- **/delete-alert `id` `[delete-disabled]`**: Deletes a price alert by its ID or all disabled price alerts in the channel.

#### Enable/Disable Alerts
- **/enable-alert `id` `[enable-type]`**: Enables a price or volume alert by its ID, or all alerts by type (`all`, `price`, `volume`).
- **/disable-alert `id` `[disable-type]`**: Disables a price or volume alert by its ID, or all alerts by type (`all`, `price`, `volume`).

For more information, please visit our GitHub repository.
