const DEFAULT_LOCALE = 'en-US';
// Default precision for displaying crypto prices when no specific currency formatting is applied
const DEFAULT_CRYPTO_PRECISION = 8;
const DEFAULT_FIAT_PRECISION = 2;

/**

 * Formats a numerical price into a localized string, with optional currency and precision control.

 *

 * This function intelligently adjusts decimal precision based on the price's magnitude

 * (e.g., more digits for very small crypto prices, fewer for larger fiat prices)

 * unless a specific `precision` is provided.

 *

 * @param price The numerical price to format.

 * @param currency Optional. An ISO 4217 currency code (e.g., 'USD', 'EUR') or a custom token symbol (e.g., 'ETH', 'BTC').

 *   If an ISO code is provided, `Intl.NumberFormat` handles currency-specific formatting.

 *   If a custom symbol, it will be appended to a decimal-formatted price.

 * @param locale Optional. The locale string for formatting (e.g., 'en-US', 'de-DE'). Defaults to 'en-US'.

 * @param precision Optional. The number of decimal places to fix the output to. If provided, this overrides

 *   the dynamic precision logic and `Intl.NumberFormat`'s default currency precision.

 * @returns A string representation of the formatted price, or "N/A" if the price is invalid.

 */

export function formatPrice(

  price: number,

  currency?: string,

  locale: string = DEFAULT_LOCALE,

  precision?: number

): string {
  if (isNaN(price) || !isFinite(price)) {
    return "N/A";
  }

      let options: Intl.NumberFormatOptions = {};
  
      if (precision !== undefined) {
          options.minimumFractionDigits = precision;
          options.maximumFractionDigits = precision;
      } else {
          const absolutePrice = Math.abs(price);
          if (absolutePrice < 0.000001) {
              options.minimumFractionDigits = DEFAULT_CRYPTO_PRECISION;
              options.maximumFractionDigits = DEFAULT_CRYPTO_PRECISION;
          } else if (absolutePrice < 0.01) {
              options.minimumFractionDigits = 6;
              options.maximumFractionDigits = 6;
          } else if (absolutePrice < 1) {
              options.minimumFractionDigits = 4;
              options.maximumFractionDigits = 4;
          } else {
              options.minimumFractionDigits = DEFAULT_FIAT_PRECISION;
              options.maximumFractionDigits = DEFAULT_FIAT_PRECISION;
          }
      }
  let formattedPriceString: string;

  // Check if the currency is a valid ISO 4217 code (3 uppercase letters)
  const isISO4217 = currency && /^[A-Z]{3}$/.test(currency);

  if (isISO4217) {
    options.style = 'currency';
    options.currency = currency;
    // Intl.NumberFormat will determine fraction digits for ISO currencies
    delete options.minimumFractionDigits;
    try {
      formattedPriceString = price.toLocaleString(locale, options);
    } catch (error) {
      if (error instanceof RangeError) {
        // Fallback to decimal formatting if currency code is invalid
        options.style = 'decimal';
        delete options.currency; // Remove the invalid currency option
        // Re-apply default fraction digits or determine based on price magnitude
        if (precision !== undefined) {
          options.minimumFractionDigits = precision;
          options.maximumFractionDigits = precision;
        } else {
          const absolutePrice = Math.abs(price);
          if (absolutePrice < 0.000001) {
            options.minimumFractionDigits = DEFAULT_CRYPTO_PRECISION;
            options.maximumFractionDigits = DEFAULT_CRYPTO_PRECISION;
          } else if (absolutePrice < 0.01) {
            options.minimumFractionDigits = 6;
            options.maximumFractionDigits = 6;
          } else if (absolutePrice < 1) {
            options.minimumFractionDigits = 4;
            options.maximumFractionDigits = 4;
          } else {
            options.minimumFractionDigits = DEFAULT_FIAT_PRECISION;
            options.maximumFractionDigits = DEFAULT_FIAT_PRECISION;
          }
        }
        formattedPriceString = price.toLocaleString(locale, options);
        if (currency) { // Only append if it was a custom currency, not an invalid ISO one already handled
          formattedPriceString += ` ${currency}`;
        }
      } else {
        throw error; // Re-throw other errors
      }
    }
  } else {
    options.style = 'decimal'; // Fallback to decimal for non-ISO/crypto codes

    if (precision !== undefined) {
      options.minimumFractionDigits = precision;
      options.maximumFractionDigits = precision;
    } else {
      const absolutePrice = Math.abs(price);
      if (absolutePrice < 0.000001) { // Very small numbers, show more precision
        options.minimumFractionDigits = DEFAULT_CRYPTO_PRECISION;
        options.maximumFractionDigits = DEFAULT_CRYPTO_PRECISION;
      } else if (absolutePrice < 0.01) {
        options.minimumFractionDigits = 6;
        options.maximumFractionDigits = 6;
      } else if (absolutePrice < 1) {
        options.minimumFractionDigits = 4;
        options.maximumFractionDigits = 4;
      } else { // Default for price >= 1, including price < 100
        options.minimumFractionDigits = DEFAULT_FIAT_PRECISION;
        options.maximumFractionDigits = DEFAULT_FIAT_PRECISION;
      }
    }
    formattedPriceString = price.toLocaleString(locale, options);
    if (currency) {
      formattedPriceString += ` ${currency}`;
    }
  }

  return formattedPriceString;
}

/**
 * Formats a numerical price specifically for display purposes, leveraging `formatPrice`.
 *
 * This function serves as a convenient wrapper for `formatPrice`, ensuring that
 * prices are consistently rounded and formatted across the CLI and exports.
 * It allows for overriding the default precision settings if needed.
 *
 * For comprehensive details on formatting standards and examples, refer to `docs/PRICE_FORMATTING.md`.
 *
 * @param price The numerical price to format for display.
 * @param currency Optional. The currency unit to append (e.g., 'USD', 'ETH').
 * @param locale Optional. The locale to use for formatting. Defaults to 'en-US'.
 * @param precision Optional. The number of decimal places to fix the output to, overriding dynamic precision.
 * @returns A string representation of the formatted price.
 */
export function formatPriceForDisplay(price: number, currency?: string, locale?: string, precision?: number): string {
  return formatPrice(price, currency, locale, precision);
}
