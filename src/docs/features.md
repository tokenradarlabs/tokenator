# Tokenator Bot Commands

Tokenator is a Discord bot that provides real-time cryptocurrency information and allows users to set up price and volume alerts.

## Bot Slash Commands

The bot supports the following slash commands:

### 1. Basic Commands

These commands help you check the bot's status.
- **/ping**: A simple test command. The bot replies with "Pong!". This is useful for checking if the bot is online and responsive.

### 2. Token Information Commands

These commands provide real-time data for supported cryptocurrencies.
- **/price `token-id`**: Fetches and displays the current price of the given token.
  - Supported tokens: `scout-protocol-token` (DEV Token), `bitcoin`, `ethereum`.
- **/mcap `token-id`**: Retrieves and displays the current market capitalization of that token.
- **/price-change `token-id`**: Shows the percentage change in that token's price over the last 24 hours, along with an emoji (📈 or 📉) indicating the direction of change.
- **/volume `token-id`**: Returns the 24-hour trading volume of that token.
- **/total-price `amount` `token-id`**: Calculates the USD price for a given amount of tokens.

### 3. Alert Management Commands

These commands allow users to create, manage, and monitor price and volume alerts. The core logic for these commands can be found in `src/alertCommands/` (e.g., `createPriceAlert.ts`, `listAlerts.ts`).

#### 3.1. Create Alerts

Set up new price or volume alerts.
- **/create-price-alert `token-id` `direction` `value`**: Creates a price alert for the given token.
  - Supported tokens: `scout-protocol-token` (DEV Token), `bitcoin`, `ethereum`.
  - Example: `/create-price-alert token-id:bitcoin direction:up value:70000`
- **/create-volume-alert `token-id` `direction` `value`**: Creates a volume alert for the given token.
  - Supported tokens: `scout-protocol-token` (DEV Token), `bitcoin`, `ethereum`.
  - Example: `/create-volume-alert token-id:ethereum direction:up value:5000000000`

#### 3.2. List Alerts

View existing alerts in the current channel.
- **/list-alerts `[filter-options]`**: Lists all alerts for the current channel. Optional named parameters:
  - `direction` (string): Filter by direction (`Up`, `Down`).
  - `type` (string): Filter by alert type (`price`, `volume`, or `all`).
  - `token` (string): Filter by token ID (e.g., `bitcoin`).
  - `enabled` (boolean): Filter by enabled status (`true` for enabled, `false` for disabled).
  - `id` (string): Filter by alert ID (e.g., `12345`).
  - Example: `/list-alerts type:price enabled:true id:12345 token:bitcoin direction:Up`

#### 3.3. Edit Alerts

Modify existing price or volume alerts.
- **/edit-price-alert `id` `[direction]` `[value]`**: Edits an existing price alert.
  - `id` (string): The ID of the alert to edit (required).
  - `direction` (string): The new price direction to alert on (optional).
  - `value` (number): The new price value to alert at (optional).
  - Example: `/edit-price-alert id:12345 direction:down value:65000`
- **/edit-volume-alert `id` `[direction]` `[value]`**: Edits an existing volume alert.
  - `id` (string): The ID of the volume alert to edit (required).
  - `direction` (string): The new volume direction to alert on (optional).
  - `value` (number): The new volume value to alert at (optional).
  - Example: `/edit-volume-alert id:67890 value:6000000000`

#### 3.4. Enable/Disable Alerts

Control the active status of your alerts.
- **/enable-alert `id` `[enable-type]`**: Enables a specific alert by its ID, or all alerts of a certain type (`all`, `price`, `volume`).
  - Example: `/enable-alert id:12345` or `/enable-alert enable-type:volume`
- **/disable-alert `id` `[disable-type]`**: Disables a specific alert by its ID, or all alerts of a certain type (`all`, `price`, `volume`).
  - Example: `/disable-alert id:67890` or `/disable-alert disable-type:all`

#### 3.5. Delete Alerts

Remove alerts from the system.
- **/delete-alert `id` `[delete-disabled]`**: Deletes a specific alert by its ID, or all disabled alerts in the channel.
  - Example: `/delete-alert id:12345` or `/delete-alert delete-disabled:true`

#### 3.6. Alert Statistics

View summary statistics for alerts in the current channel.
- **/alert-stats**: Shows statistics for alerts in the current channel, including counts of enabled/disabled alerts by type and direction. This command is handled by `src/alertCommands/alertStats.ts`.

## Examples: Main Alert Flows

Here are some common scenarios for using Tokenator's alert features:

### Scenario 1: Create a Price Alert

You want to be notified if Bitcoin's price goes above $70,000.
1.  **Create the alert**:
    `/create-price-alert token-id:bitcoin direction:up value:70000`
    *(This command is processed by logic in `src/alertCommands/createPriceAlert.ts`)*
2.  **Verify the alert is active**:
    `/list-alerts token:bitcoin type:price`

### Scenario 2: Create a Volume Alert

You want to be notified if Ethereum's 24-hour trading volume drops below $5 billion.
1.  **Create the alert**:
    `/create-volume-alert token-id:ethereum direction:down value:5000000000`
    *(This command is processed by logic in `src/alertCommands/createVolumeAlert.ts`)*
2.  **Verify the alert is active**:
    `/list-alerts token:ethereum type:volume`

### Scenario 3: Edit an Existing Alert

You have a Bitcoin price alert (ID: `12345`) set for $70,000, but now you want to change it to $72,000.
1.  **Edit the alert**:
    `/edit-price-alert id:12345 value:72000`
    *(This command is handled by `src/alertCommands/editPriceAlert.ts`)*
2.  **Confirm the change**:
    `/list-alerts id:12345`

### Scenario 4: Disable and Enable an Alert

You want to temporarily pause an alert (ID: `67890`) and then re-enable it later.
1.  **Disable the alert**:
    `/disable-alert id:67890`
    *(This action uses logic from `src/alertCommands/disableAlert.ts`)*
2.  **Re-enable the alert**:
    `/enable-alert id:67890`
    *(This action uses logic from `src/alertCommands/enableAlert.ts`)*
3.  **Check its status**:
    `/list-alerts id:67890`

### Scenario 5: Delete an Alert

You no longer need a specific alert (ID: `12345`).
1.  **Delete the alert**:
    `/delete-alert id:12345`
    *(This command is handled by `src/alertCommands/deleteAlert.ts`)*
2.  **Confirm deletion**:
    `/list-alerts id:12345` (It should no longer appear)

For more information, please visit our GitHub repository.