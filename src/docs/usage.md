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

### Running CLI Commands

You can run Tokenator's CLI commands using `ts-node` directly on `src/index.ts`.

**Example:**

```bash
ts-node src/index.ts <command> [arguments]
```

### Example Alert Commands

Here are a few examples of how to create and list alerts. These commands interact with the logic defined in `src/alertCommands/`.

*   **Create a price alert:**
    ```bash
    ts-node src/index.ts create-price-alert --token-id bitcoin --direction up --value 70000
    ```
    *(This command uses the logic from `src/alertCommands/createPriceAlert.ts`)*

*   **Create a volume alert:**
    ```bash
    ts-node src/index.ts create-volume-alert --token-id ethereum --direction up --value 100000000
    ```
    *(This command uses the logic from `src/alertCommands/createVolumeAlert.ts`)*

*   **List all alerts:**
    ```bash
    ts-node src/index.ts list-alerts
    ```
    *(This command uses the logic from `src/alertCommands/listAlerts.ts`)*


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
