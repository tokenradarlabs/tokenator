# Price Formatting Standards

## Overview

This document outlines the standardized price formatting rules implemented across the Tokenator bot to ensure consistent decimal precision and user experience.

## Formatting Rules

Price formatting is dynamically adjusted based on the price value and whether an explicit `precision` is provided. The rules are:

1.  **Very small crypto prices** (< $0.000001): `DEFAULT_CRYPTO_PRECISION` (8) decimal places.
    -   Example: `0.00000012345` → `0.00000012`
2.  **Small crypto prices** (between $0.000001 and < $0.01): 6 decimal places.
    -   Example: `0.00012345` → `0.000123`
3.  **Medium crypto prices** (between $0.01 and < $1.00): 4 decimal places.
    -   Example: `0.56789` → `0.5679`
4.  **Fiat-like prices** (>= $1.00): `DEFAULT_FIAT_PRECISION` (2) decimal places.
    -   Example: `12.345` → `12.35`

If a `precision` parameter is explicitly provided to `formatPrice` or `formatPriceForDisplay`, it will override these dynamic rules.

## Implementation

### Central Utility Functions

All price formatting is handled by the centralized utility functions in `src/utils/priceFormatter.ts`:

-   `formatPrice(price: number, currency?: string, locale?: string, precision?: number)`:
    Formats a price as a string. It can optionally take a `currency` (ISO 4217 code like 'USD' or custom like 'ETH'), a `locale` (defaults to 'en-US'), and `precision` (number of decimal places).
    If `precision` is not provided, dynamic precision rules apply.
-   `formatPriceForDisplay(price: number, currency?: string, locale?: string, precision?: number)`:
    A wrapper around `formatPrice` for display purposes. It accepts the same parameters and ensures consistent display formatting.

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
import { formatPriceForDisplay, formatPrice } from '../src/utils/priceFormatter';

// Basic usage with dynamic precision and default locale (en-US)
console.log(`Current price: ${formatPriceForDisplay(0.00000012345, 'ETH')}`);
// Result: "Current price: 0.00000012 ETH"

console.log(`Current price: ${formatPriceForDisplay(0.00012345, 'LINK')}`);
// Result: "Current price: 0.000123 LINK"

console.log(`Current price: ${formatPriceForDisplay(0.56789, 'BTC')}`);
// Result: "Current price: 0.5679 BTC"

console.log(`Current price: ${formatPriceForDisplay(12.345, 'USD')}`);
// Result: "Current price: $12.35"

console.log(`Large value: ${formatPriceForDisplay(1234.56, 'USD')}`);
// Result: "Large value: $1,234.56"

// Using explicit precision
console.log(`Price with fixed precision: ${formatPriceForDisplay(123.45678, 'EUR', 'de-DE', 2)}`);
// Result: "Price with fixed precision: 123,46 €"

// Formatting without currency for alert thresholds
console.log(`Threshold: ${formatPrice(1234.56789, undefined, undefined, 4)}`);
// Result: "Threshold: 1234.5679"

// Formatting with a different locale and no currency
console.log(`German locale, no currency: ${formatPrice(9876.54, undefined, 'de-DE')}`);
// Result: "German locale, no currency: 9.876,54"
```
