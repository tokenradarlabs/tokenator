/**
 * Centralized price formatting utility to ensure consistent decimal precision
 * across all price displays in the application.
 */

/**
 * Formats a price with appropriate decimal precision based on the price value
 * @param price The price to format
 * @returns Formatted price string with appropriate decimal places
 */
export function formatPrice(price: number): string {
  if (price < 0.01) {
    // Very small prices get 6 decimal places for precision
    return price.toFixed(6);
  } else if (price < 1) {
    // Small prices (under $1) get 4 decimal places
    return price.toFixed(4);
  } else if (price < 100) {
    // Medium prices get 2 decimal places
    return price.toFixed(2);
  } else {
    // Large prices use locale formatting (includes commas)
    return price.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
}

/**
 * Formats a price specifically for display in Discord messages
 * @param price The price to format
 * @returns Formatted price string with $ prefix
 */
export function formatPriceForDisplay(price: number): string {
  return `$${formatPrice(price)}`;
}

/**
 * Formats a price for alert threshold displays
 * @param price The price to format
 * @returns Formatted price string without currency symbol
 */
export function formatPriceForAlert(price: number): string {
  return formatPrice(price);
}
