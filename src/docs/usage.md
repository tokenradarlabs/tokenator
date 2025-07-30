# Tokenator Bot Usage

This document explains how to use the Tokenator Discord bot.

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
- **token-id**: The token to create an alert for (supported: `dev`, `eth`, `btc`).
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
