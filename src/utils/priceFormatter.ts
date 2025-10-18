/**
 * Formats a numerical price value into a string with consistent decimal rounding
 * and optional currency suffix.
 *
 * This function applies specific formatting rules based on the price magnitude
 * to ensure readability and precision across the application. For detailed
 * formatting standards, refer to `docs/PRICE_FORMATTING.md`.
 *
 * @param price The numerical price to format.
 * @param currency Optional. The currency unit to append (e.g., 'USD', 'ETH').
 * @returns A string representation of the formatted price.
 */
export function formatPrice(price: number, currency?: string): string {
  let formattedPrice: string;

  if (price < 0.01) {
    formattedPrice = price.toFixed(6);
  } else if (price < 1) {
    formattedPrice = price.toFixed(4);
  } else if (price < 100) {
    formattedPrice = price.toFixed(2);
  } else {
    formattedPrice = price.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return currency ? `${formattedPrice} ${currency}` : formattedPrice;
}

/**
 * Formats a numerical price for display, prepending a dollar sign and
 * optionally appending a currency suffix.
 *
 * This function leverages `formatPrice` for consistent rounding and formatting.
 * For detailed formatting standards, refer to `docs/PRICE_FORMATTING.md`.
 *
 * @param price The numerical price to format for display.
 * @param currency Optional. The currency unit to append (e.g., 'USD', 'ETH').
 * @returns A string representation of the formatted price, prefixed with '$`.
 */
export function formatPriceForDisplay(price: number, currency?: string): string {
  return `$${formatPrice(price, currency)}`;
}
