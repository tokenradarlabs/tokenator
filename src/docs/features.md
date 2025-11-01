# Tokenator Bot Commands

Tokenator is a Discord bot that provides real-time cryptocurrency information and allows users to set up price and volume alerts.

## Bot Slash Commands

These commands are implemented as Discord slash commands. Use the command name (e.g., `/create-price-alert`) and fill in the options presented by Discord's UI. The colon-separated inline syntax (e.g., `token-id:bitcoin`) is not supported by these slash commands and is incorrect.

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
- **/create-price-alert** — Opens a dialog with the following options:
  - `token-id` (string, required): Supported tokens — `scout-protocol-token`, `bitcoin`, `ethereum`.
  - `direction` (string, required): Allowed values — `up` (alert when price >= value), `down` (alert when price <= value).
  - `value` (number, required): Threshold price in USD.
  - `notify-channel` (channel, optional): Channel to post the alert.
  Type `/create-price-alert` and fill in the fields shown in the command UI; no colon-separated inline arguments are accepted.
- **/create-volume-alert** — Opens a dialog with the following options:
  - `token` (string, required): The token to track (e.g., `scout-protocol-token`, `bitcoin`, `ethereum`).
  - `direction` (string, required): Alert when volume goes `up` or `down`.
  - `volume` (number, required): The volume threshold in USD (e.g., `1000000` for $1M).
  - `timeframe` (string, required): The time frame for the volume (e.g., `24h`, `7d`, `30d`).
  Type `/create-volume-alert` and fill in the fields shown in the command UI; no colon-separated inline arguments are accepted.

#### 3.2. List Alerts

View existing alerts in the current channel.
- **/list-alerts** — Opens a dialog with the following options:
  - `direction` (string, optional): Filter by direction (`Up`, `Down`).
  - `type` (string, optional): Filter by alert type (`price`, `volume`, or `all`).
  - `token` (string, optional): Filter by token ID (e.g., `bitcoin`).
  - `enabled` (string, optional): Filter by enabled status (`true` for enabled, `false` for disabled).
  - `page` (number, optional): Page number to display (defaults to 1).
  - `limit` (number, optional): Number of alerts per page (defaults to 10, max 50).
  Type `/list-alerts` and fill in the fields shown in the command UI; no colon-separated inline arguments are accepted.

#### 3.3. Edit Alerts

Modify existing price or volume alerts.
- **/edit-price-alert** — Opens a dialog with the following options:
  - `id` (string, required): The ID of the alert to edit.
  - `direction` (string, optional): The new price direction to alert on.
  - `value` (number, optional): The new price value to alert at.
  Type `/edit-price-alert` and fill in the fields shown in the command UI; no colon-separated inline arguments are accepted.
- **/edit-volume-alert** — Opens a dialog with the following options:
  - `id` (string, required): The ID of the volume alert to edit.
  - `direction` (string, optional): The new volume direction to alert on.
  - `value` (number, optional): The new volume value to alert at.
  Type `/edit-volume-alert` and fill in the fields shown in the command UI; no colon-separated inline arguments are accepted.

#### 3.4. Enable/Disable Alerts

Control the active status of your alerts.
- **/enable-alert** — Opens a dialog with the following options:
  - `id` (string, optional): The ID of the alert to enable.
  - `enable-type` (string, optional): Choose which type of alerts to enable (`all`, `price`, `volume`).
  Type `/enable-alert` and fill in the fields shown in the command UI; no colon-separated inline arguments are accepted.
- **/disable-alert** — Opens a dialog with the following options:
  - `id` (string, optional): The ID of the alert to disable.
  - `disable-type` (string, optional): Choose which type of alerts to disable (`all`, `price`, `volume`).
  Type `/disable-alert` and fill in the fields shown in the command UI; no colon-separated inline arguments are accepted.

#### 3.5. Delete Alerts

Remove alerts from the system.
- **/delete-alert** — Opens a dialog with the following options:
  - `id` (string, optional): The ID of the alert to delete.
  - `delete-disabled` (string, optional): Delete all disabled alerts in this channel (`true`).
  - `type` (string, optional): Type of alert to delete (`price`, `volume`, or `all`). Required for bulk delete.
  Type `/delete-alert` and fill in the fields shown in the command UI; no colon-separated inline arguments are accepted.

#### 3.6. Alert Statistics

View summary statistics for alerts in the current channel.
- **/alert-stats** — Opens a dialog with the following options:
  - `token` (string, optional): Filter stats by token (e.g., `scout-protocol-token`, `bitcoin`, `ethereum`).
  Type `/alert-stats` and fill in the fields shown in the command UI; no colon-separated inline arguments are accepted.

## Examples: Main Alert Flows

Here are some common scenarios for using Tokenator's alert features:

### Scenario 1: Create a Price Alert

You want to be notified if Bitcoin's price goes above $70,000.
1.  **Create the alert**: Use `/create-price-alert`.
    *   For `token-id`, select `bitcoin`.
    *   For `direction`, select `up`.
    *   For `value`, enter `70000`.
    *(This command is processed by logic in `src/alertCommands/createPriceAlert.ts`)*
2.  **Verify the alert is active**: Use `/list-alerts`.
    *   For `token`, select `bitcoin`.
    *   For `type`, select `price`.

### Scenario 2: Create a Volume Alert

You want to be notified if Ethereum's 24-hour trading volume drops below $5 billion.
1.  **Create the alert**: Use `/create-volume-alert`.
    *   For `token`, select `ethereum`.
    *   For `direction`, select `down`.
    *   For `volume`, enter `5000000000`.
    *   For `timeframe`, select `24h`.
    *(This command is processed by logic in `src/alertCommands/createVolumeAlert.ts`)*
2.  **Verify the alert is active**: Use `/list-alerts`.
    *   For `token`, select `ethereum`.
    *   For `type`, select `volume`.

### Scenario 3: Edit an Existing Alert

You have a Bitcoin price alert (ID: `12345`) set for $70,000, but now you want to change it to $72,000.
1.  **Edit the alert**: Use `/edit-price-alert`.
    *   For `id`, enter `12345`.
    *   For `value`, enter `72000`.
    *(This command is handled by `src/alertCommands/editPriceAlert.ts`)*
2.  **Confirm the change**: Use `/list-alerts`.
    *   For `token`, select `bitcoin`.
    *   For `type`, select `price`.

### Scenario 4: Disable and Enable an Alert

You want to temporarily pause an alert (ID: `67890`) and then re-enable it later.
1.  **Disable the alert**: Use `/disable-alert`.
    *   For `id`, enter `67890`.
    *(This action uses logic from `src/alertCommands/disableAlert.ts`)*
2.  **Re-enable the alert**: Use `/enable-alert`.
    *   For `id`, enter `67890`.
    *(This action uses logic from `src/alertCommands/enableAlert.ts`)*
3.  **Check its status**: Use `/list-alerts`.
    *   For `token`, select `67890` (assuming 67890 is a token id, otherwise it should be omitted).

### Scenario 5: Delete an Alert

You no longer need a specific alert (ID: `12345`).
1.  **Delete the alert**: Use `/delete-alert`.
    *   For `id`, enter `12345`.
    *(This command is handled by `src/alertCommands/deleteAlert.ts`)*
2.  **Confirm deletion**: Use `/list-alerts` (It should no longer appear).

For more information, please visit our GitHub repository.