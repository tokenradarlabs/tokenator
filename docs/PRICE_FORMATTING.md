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

For practical demonstrations of how to use these formatting functions, consider the following TypeScript examples. These snippets illustrate various scenarios, including dynamic precision, explicit precision, different currencies, and locales.

```typescript
import { formatPriceForDisplay, formatPrice } from '../src/utils/priceFormatter';

// --- Using formatPriceForDisplay (dynamic precision by default) ---

// Very small crypto price (< $0.000001): 8 decimal places
console.log(`ETH Price: ${formatPriceForDisplay(0.00000012345678, 'ETH')}`);
// Expected: "ETH Price: 0.00000012 ETH"

// Small crypto price (between $0.000001 and < $0.01): 6 decimal places
console.log(`LINK Price: ${formatPriceForDisplay(0.000123456, 'LINK')}`);
// Expected: "LINK Price: 0.000123 LINK"

// Medium crypto price (between $0.01 and < $1.00): 4 decimal places
console.log(`BTC Price: ${formatPriceForDisplay(0.56789, 'BTC')}`);
// Expected: "BTC Price: 0.5679 BTC"

// Fiat-like price (>= $1.00): 2 decimal places
console.log(`USD Price: ${formatPriceForDisplay(12.345, 'USD')}`);
// Expected: "USD Price: $12.35"

// Large fiat value with comma separator (en-US locale)
console.log(`Portfolio Value: ${formatPriceForDisplay(1234567.89, 'USD')}`);
// Expected: "Portfolio Value: $1,234,567.89"

// --- Using formatPrice (for more control, e.g., alert thresholds) ---

// Custom precision (4 decimal places) for a threshold
console.log(`Alert Threshold (custom precision): ${formatPrice(1234.56789, undefined, 'en-US', 4)}`);
// Expected: "Alert Threshold (custom precision): 1,234.5679"

// Explicit precision (2 decimal places) for display with EUR currency and German locale
console.log(`EUR Price (de-DE, 2 precision): ${formatPriceForDisplay(9876.54321, 'EUR', 'de-DE', 2)}`);
// Expected: "EUR Price (de-DE, 2 precision): 9.876,54 €"

// Dynamic precision with a custom token symbol
console.log(`Custom Token Value: ${formatPrice(123.456789, 'MYTOKEN', 'en-GB')}`);
// Expected: "Custom Token Value: 123.46 MYTOKEN"

// Handling prices that are not finite or invalid
console.log(`Invalid Price: ${formatPrice(NaN, 'USD')}`);
// Expected: "Invalid Price: N/A"
```

## Related File

For the full implementation details, refer to the source code: [`src/utils/priceFormatter.ts`](../src/utils/priceFormatter.ts)


