# Price Alert Input Validation

This document describes the price validation feature implemented to address security and usability concerns with price alert values.

## Problem Solved

Previously, users could set price alerts with:

- Negative values (e.g., -$100)
- Unrealistic values (e.g., $50,000,000 for a small token)
- Values that would never trigger (e.g., "up" alert below current price)
- No bounds checking against reasonable market ranges

## Solution Overview

The new validation system implements multi-layered checks:

### 1. Basic Value Validation

- **Positive Numbers Only**: Rejects negative values and zero
- **Data Type Validation**: Ensures numeric input

### 2. Token-Specific Bounds

Each supported token has realistic price bounds:

| Token          | Symbol | Min Price | Max Price   |
| -------------- | ------ | --------- | ----------- |
| Bitcoin        | BTC    | $1.00     | $10,000,000 |
| Ethereum       | ETH    | $1.00     | $500,000    |
| Scout Protocol | DEV    | $0.00001  | $100.00     |

### 3. Market Context Validation

- **Current Price Comparison**: Validates against real market data
- **Direction Logic**: Ensures "up" alerts are above current price, "down" alerts below
- **Extreme Deviation Check**: Prevents alerts more than 10x or 1/10th current price

### 4. User Experience Enhancements

- **Clear Error Messages**: Specific feedback about why validation failed
- **Suggested Ranges**: Provides reasonable alternative values
- **Current Price Display**: Shows market context in responses

## Implementation Details

### Core Validation Function

```typescript
validatePriceAlertValue(tokenId: string, priceValue: number, direction: "up" | "down")
```

**Parameters:**

- `tokenId`: Token identifier (e.g., "bitcoin", "ethereum", "dev")
- `priceValue`: The price value to validate
- `direction`: Alert direction ("up" or "down")

**Returns:**

- `isValid`: Boolean indicating if validation passed
- `errorMessage`: Descriptive error if validation failed
- `currentPrice`: Current market price if available

### Price Data Sources

1. **Primary**: Local database (`getLatestTokenPriceFromDatabase`)
2. **Fallback**: CoinGecko API (`fetchTokenPrice`)
3. **Graceful Degradation**: Works without current price data

### Files Modified

1. **`src/utils/priceValidation.ts`** (NEW)

   - Core validation logic
   - Token bounds configuration
   - Price formatting utilities

2. **`src/alertCommands/createPriceAlert.ts`**

   - Added validation before alert creation
   - Enhanced error messaging
   - Improved success messages

3. **`src/alertCommands/editPriceAlert.ts`**
   - Added validation for both price and direction changes
   - Contextual validation with existing alert data

## Usage Examples

### Valid Scenarios ✅

```bash
/create-price-alert token-id:bitcoin direction:up value:75000
# Bitcoin up alert at $75,000 - reasonable given market history

/create-price-alert token-id:ethereum direction:down value:2500
# Ethereum down alert at $2,500 - within reasonable range

/create-price-alert token-id:scout-protocol-token direction:up value:0.05
# DEV token up alert at $0.05 - reasonable for small cap token
```

### Invalid Scenarios ❌

```bash
/create-price-alert token-id:bitcoin direction:up value:-1000
# Error: "Price value must be positive. You entered: $-1000"

/create-price-alert token-id:bitcoin direction:up value:20000000
# Error: "Price value $20,000,000 is too high for BTC. Maximum allowed: $10,000,000"

/create-price-alert token-id:bitcoin direction:down value:80000
# Error: "Down alert price $80,000 should be lower than current price of $67,000"
```

## Error Message Types

### 1. Basic Validation Errors

- Negative/zero values
- Out of bounds (too high/low)

### 2. Market Context Errors

- Direction mismatch with current price
- Extreme deviation from market value

### 3. System Errors

- Unsupported token
- Unable to fetch price data

## Configuration

### Adjusting Token Bounds

Token bounds can be modified in `src/utils/priceValidation.ts`:

```typescript
const TOKEN_PRICE_BOUNDS = {
  'scout-protocol-token': {
    min: 0.00001,
    max: 100,
    name: 'DEV',
  },
  // ... other tokens
};
```

### Deviation Ratio

The maximum deviation from current price can be adjusted:

```typescript
const maxDeviationRatio = 10; // Allow alerts up to 10x current price
```

## Testing

Run validation tests with:

```bash
npm run test:price-validation
```

See `src/test/priceValidationTests.ts` for comprehensive test scenarios.

## Future Enhancements

1. **Dynamic Bounds**: Adjust bounds based on token volatility
2. **Historical Analysis**: Warn about alerts unlikely to trigger based on history
3. **Multi-Currency Support**: Validate alerts in different currencies
4. **Batch Validation**: Validate multiple alerts simultaneously

## Monitoring

The validation system includes logging for:

- Validation failures and reasons
- Price data source used (database vs API)
- Performance metrics for validation calls

Check logs for patterns in validation failures to identify potential UX improvements.
