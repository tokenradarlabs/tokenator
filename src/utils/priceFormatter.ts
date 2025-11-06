export function formatPrice(price: number, currency?: string, locale: string = 'en-US'): string {
  if (isNaN(price) || !isFinite(price)) {
    return "N/A";
  }

  let options: Intl.NumberFormatOptions = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  };

  let formattedPriceString: string;

  // Check if the currency is a valid ISO 4217 code (3 uppercase letters)
  const isISO4217 = currency && /^[A-Z]{3}$/.test(currency);

  if (isISO4217) {
    options.style = 'currency';
    options.currency = currency;
    // Intl.NumberFormat will determine fraction digits for ISO currencies
    delete options.minimumFractionDigits;
    delete options.maximumFractionDigits;
    formattedPriceString = price.toLocaleString(locale, options);
  } else {
    options.style = 'decimal'; // Fallback to decimal for non-ISO/crypto codes
    const absolutePrice = Math.abs(price);

    if (absolutePrice < 0.000001) { // Very small numbers, show more precision
      options.minimumFractionDigits = 8;
      options.maximumFractionDigits = 8;
    } else if (absolutePrice < 0.01) {
      options.minimumFractionDigits = 6;
      options.maximumFractionDigits = 6;
    } else if (absolutePrice < 1) {
      options.minimumFractionDigits = 4;
      options.maximumFractionDigits = 4;
    } else { // Default for price >= 1, including price < 100
      options.minimumFractionDigits = 2;
      options.maximumFractionDigits = 2;
    }
    formattedPriceString = price.toLocaleString(locale, options);
    if (currency) {
      formattedPriceString += ` ${currency}`;
    }
  }

  return formattedPriceString;
}

/**
 * Formats a numerical price for display with optional currency suffix.
 *
 * This function leverages `formatPrice` for consistent rounding and formatting.
 * For detailed formatting standards, refer to `docs/PRICE_FORMATTING.md`.
 *
 * @param price The numerical price to format for display.
 * @param currency Optional. The currency unit to append (e.g., 'USD', 'ETH').
 * @param locale Optional. The locale to use for formatting. Defaults to 'en-US'.
 * @returns A string representation of the formatted price.
 */
export function formatPriceForDisplay(price: number, currency?: string, locale?: string): string {
  return formatPrice(price, currency, locale);
}
