# Price Formatting Standards

## Overview

This document outlines the standardized price formatting rules implemented across the Tokenator bot to ensure consistent decimal precision and user experience.

## Formatting Rules

The price formatting follows these rules based on the price value:

1. **Very small prices** (< $0.01): 6 decimal places for precision
   - Example: $0.000123 → `$0.000123`

2. **Small prices** (< $1.00): 4 decimal places
   - Example: $0.5678 → `$0.5678`

3. **Medium prices** (< $100.00): 2 decimal places
   - Example: $12.345 → `$12.35`

4. **Large prices** (>= $100.00): Locale formatting with commas and 2 decimal places
   - Example: $1234.56 → `$1,234.56`

## Implementation

### Central Utility Functions

All price formatting is handled by the centralized utility functions in `src/utils/priceFormatter.ts`:

- `formatPrice(price: number)`: Returns formatted price without currency symbol
- `formatPriceForDisplay(price: number)`: Returns formatted price with $ prefix
- `formatPriceForAlert(price: number)`: Alias for formatPrice for clarity in alerts

### Files Updated

The following files were updated to use consistent price formatting:

1. **src/index.ts**
   - Price command: Now uses smart formatting instead of hardcoded 5 decimals for DEV token
   - Total-price command: Uses smart formatting instead of fixed 3 decimals

2. **src/cron/priceUpdateJob.ts**
   - Alert messages: Now use consistent formatting for all price displays
   - Bot activity status: Uses smart formatting instead of fixed 5 decimals for DEV
   - Log messages: Consistent formatting in price change logs

3. **src/alertCommands/createPriceAlert.ts**
   - Alert creation messages: Now use consistent formatting

4. **src/alertCommands/listPriceAlerts.ts**
   - Alert listing: Now displays prices with consistent formatting

5. **src/utils/priceValidation.ts**
   - Removed duplicate formatPrice function
   - Now uses centralized formatting utility

## Benefits

1. **Consistent User Experience**: All price displays follow the same formatting rules
2. **Appropriate Precision**: Different price ranges get appropriate decimal precision
3. **Maintainability**: Single source of truth for price formatting logic
4. **Readability**: Large numbers include comma separators for better readability

## Before vs After

### Before (Inconsistent)
- DEV token: 5 decimals (`$0.01234`)
- Other tokens: 2 decimals (`$123.45`)
- Alert messages: Raw numbers with varying precision
- Total price: Fixed 3 decimals

### After (Consistent)
- All tokens: Smart formatting based on price value
- Small prices: More precision when needed
- Large prices: Comma separators for readability
- Consistent across all commands and messages

## Usage Examples

```typescript
import { formatPriceForDisplay, formatPrice } from './utils/priceFormatter';

// For Discord messages
const message = `Current price: ${formatPriceForDisplay(0.00123)}`;
// Result: "Current price: $0.001230"

// For alert thresholds (without $)
const threshold = formatPrice(1234.56);
// Result: "1,234.56"
```
