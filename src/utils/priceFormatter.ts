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
  if (isNaN(price) || !isFinite(price)) {
    return "N/A";
  }

  let options: Intl.NumberFormatOptions = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  };

  if (currency) {
    options.style = 'currency';
    options.currency = currency;
  }

  if (price < 0.000001) { // Very small numbers, show more precision
    options.minimumFractionDigits = 8;
    options.maximumFractionDigits = 8;
  } else if (price < 0.01) {
    options.minimumFractionDigits = 6;
    options.maximumFractionDigits = 6;
  } else if (price < 1) {
    options.minimumFractionDigits = 4;
    options.maximumFractionDigits = 4;
  } else if (price < 100) {
    options.minimumFractionDigits = 2;
    options.maximumFractionDigits = 2;
  } else {
    options.minimumFractionDigits = 2;
    options.maximumFractionDigits = 2;
  }

  return price.toLocaleString(undefined, options);
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
  return formatPrice(price, currency);
}
