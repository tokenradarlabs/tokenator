import logger from './logger';
import { getLatestTokenPriceFromDatabase } from './databasePrice';
import { fetchTokenPrice } from './coinGecko';
import { resolveTokenAlias, SUPPORTED_TOKENS } from './constants';
import { formatPrice } from './priceFormatter';

// Define reasonable price bounds for each token type
const TOKEN_PRICE_BOUNDS = {
  'scout-protocol-token': {
    min: 0.00001, // Minimum reasonable price for a small-cap token
    max: 100, // Maximum reasonable price for DEV token
    name: 'DEV',
  },
  bitcoin: {
    min: 1, // Bitcoin shouldn't realistically go below $1
    max: 10000000, // $10M upper bound for Bitcoin
    name: 'BTC',
  },
  ethereum: {
    min: 1, // Ethereum shouldn't realistically go below $1
    max: 500000, // $500K upper bound for Ethereum
    name: 'ETH',
  },
} as const;

export interface PriceValidationResult {
  isValid: boolean;
  errorMessage?: string;
  currentPrice?: number;
  parsedPriceValue?: number; // Added for clarity when parsing string inputs
  sanitizedTokenId?: string; // Added to return the sanitized token ID
}

/**
 * Sanitizes a token symbol input string.
 * Trims whitespace and converts to lowercase.
 * @param inputSymbol The raw token symbol string.
 * @returns The sanitized token symbol, or null if the input is empty or becomes empty after sanitization.
 */
export function sanitizeTokenSymbol(inputSymbol: string | null | undefined): string | null {
  if (typeof inputSymbol !== 'string') {
    return null;
  }
  const sanitized = inputSymbol.trim().toLowerCase();
  return sanitized === '' ? null : sanitized;
}

/**
 * Internal helper to validate basic numeric properties of an input price.
 * Handles NaN, non-finite numbers, negative numbers, and attempts to parse string inputs.
 * @param inputPrice The raw input price, which could be a number or a string.
 * @returns A PriceValidationResult indicating validity and a parsed number if successful.
 */
export function _validateNumericInput(inputPrice: number | string | null | undefined): PriceValidationResult {
  if (inputPrice === null || inputPrice === undefined) {
    return {
      isValid: false,
      errorMessage: 'Price value cannot be empty. Please provide a number.',
    };
  }

  let parsedPrice: number;

  if (typeof inputPrice === 'string') {
    // Attempt to parse string to number
    parsedPrice = parseFloat(inputPrice);
    if (isNaN(parsedPrice)) {
      return {
        isValid: false,
        errorMessage: `Invalid price input: "${inputPrice}". Please enter a valid numeric value.`
      };
    }
  } else if (typeof inputPrice === 'number') {
    parsedPrice = inputPrice;
  } else {
    return {
      isValid: false,
      errorMessage: `Invalid price input type: "${typeof inputPrice}". Please enter a numeric value.`
    };
  }

  if (isNaN(parsedPrice)) {
    return {
      isValid: false,
      errorMessage: 'Invalid price value: "NaN". Please enter a valid number.',
    };
  }

  if (!isFinite(parsedPrice)) {
    return {
      isValid: false,
      errorMessage: `Price value "${parsedPrice}" is not a finite number. Please enter a realistic numeric value.`
    };
  }

  // Check for non-positive values
  if (parsedPrice <= 0) {
    return {
      isValid: false,
      errorMessage: `Price value must be positive. You entered: $${formatPrice(parsedPrice)}.`
    };
  }

  return { isValid: true, parsedPriceValue: parsedPrice };
}

/**
 * Internal helper to check if a price value is within the predefined absolute bounds for a token.
 * @param standardizedId The standardized token identifier.
 * @param priceValue The numeric price value to check.
 * @param bounds The min/max bounds for the token.
 * @returns A PriceValidationResult indicating validity.
 */
export function _checkAbsoluteBounds(
  standardizedId: string,
  priceValue: number,
  bounds: { min: number; max: number; name: string }
): PriceValidationResult {
  if (priceValue < bounds.min) {
    return {
      isValid: false,
      errorMessage: `Price value $${formatPrice(priceValue)} is too low for ${
        bounds.name
      }. The minimum allowed is $${formatPrice(bounds.min)}.`
    };
  }

  if (priceValue > bounds.max) {
    return {
      isValid: false,
      errorMessage: `Price value $${formatPrice(priceValue)} is too high for ${
        bounds.name
      }. The maximum allowed is $${formatPrice(bounds.max)}.`
    };
  }

  return { isValid: true };
}

/**
 * Validates a price alert value against reasonable bounds and market conditions
 * @param tokenId The token identifier (standardized ID)
 * @param priceValue The price value to validate
 * @param direction The alert direction ("up" or "down")
 * @returns Validation result with error message if invalid
 */
export async function validatePriceAlertValue(
  tokenId: string,
  priceValue: number | string, // Allow string input
  direction: 'up' | 'down'
): Promise<PriceValidationResult> {
  const sanitizedTokenId = sanitizeTokenSymbol(tokenId);
  if (!sanitizedTokenId) {
    return {
      isValid: false,
      errorMessage: 'Token symbol cannot be empty. Please provide a valid token (e.g., "dev", "eth", "btc").',
    };
  }

  // Get standardized token ID
  const standardizedId = resolveTokenAlias(sanitizedTokenId);
  if (!standardizedId || !(standardizedId in TOKEN_PRICE_BOUNDS)) {
    const supportedTokenSymbols = Object.keys(SUPPORTED_TOKENS).map(key => `"${key}"`).join(', ');
    return {
      isValid: false,
      errorMessage: `Unsupported token: "${tokenId}". Supported tokens are: ${supportedTokenSymbols}.`,
    };
  }

  const bounds =
    TOKEN_PRICE_BOUNDS[standardizedId as keyof typeof TOKEN_PRICE_BOUNDS];

  // Validate input type and basic numeric properties using the helper
  const numericValidation = _validateNumericInput(priceValue);
  if (!numericValidation.isValid) {
    return numericValidation;
  }
  const validatedPriceValue = numericValidation.parsedPriceValue!;

  // Check against absolute bounds using the helper
  const boundsValidation = _checkAbsoluteBounds(standardizedId, validatedPriceValue, bounds);
  if (!boundsValidation.isValid) {
    return boundsValidation;
  }

  // Get current price for context validation
  let currentPrice: number | null = null;

  try {
    // Try database first
    currentPrice = await getLatestTokenPriceFromDatabase(standardizedId);

    // Fallback to CoinGecko if no database price
    if (currentPrice === null) {
      logger.info(
        `[PriceValidation] No database price for ${standardizedId}, trying CoinGecko...`
      );
      const coinGeckoData = await fetchTokenPrice(standardizedId);
      if (coinGeckoData?.usd) {
        currentPrice = coinGeckoData.usd;
      }
    }
  } catch (error) {
    logger.warn({ error }, `[PriceValidation] Could not fetch current price for ${tokenId}`);
  }

  // If we have current price, do additional validation
  if (currentPrice !== null) {
    const priceDifferenceRatio =
      Math.abs(validatedPriceValue - currentPrice) / currentPrice;
    const maxDeviationRatio = 10; // Allow alerts up to 10x current price or 1/10th

    // Check for extreme deviations from current price
    if (priceDifferenceRatio > maxDeviationRatio) {
      const suggestedMin = formatPrice(currentPrice / 10);
      const suggestedMax = formatPrice(currentPrice * 10);

      return {
        isValid: false,
        errorMessage: `Price value $${formatPrice(
          validatedPriceValue
        )} seems unrealistic compared to current price of $${formatPrice(
          currentPrice
        )}. Consider a value between $${suggestedMin} and $${suggestedMax}.`,
        currentPrice,
      };
    }

    // Warn about alerts that might never trigger
    if (direction === 'up' && validatedPriceValue <= currentPrice) {
      return {
        isValid: false,
        errorMessage: `"Up" alert price $${formatPrice(
          validatedPriceValue
        )} should be higher than current price of $${formatPrice(
          currentPrice
        )}`,
        currentPrice,
      };
    }

    if (direction === 'down' && validatedPriceValue >= currentPrice) {
      return {
        isValid: false,
        errorMessage: `"Down" alert price $${formatPrice(
          validatedPriceValue
        )} should be lower than current price of $${formatPrice(currentPrice)}`,
        currentPrice,
      };
    }
  }

  return {
    isValid: true,
    parsedPriceValue: validatedPriceValue,
    currentPrice: currentPrice || undefined,
    sanitizedTokenId: standardizedId, // Return the standardized and sanitized token ID
  };
}

/**
 * Gets the bounds for a specific token
 * @param tokenId The token identifier
 * @returns The price bounds for the token, or null if unsupported
 */
export function getTokenPriceBounds(tokenId: string) {
  const sanitizedTokenId = sanitizeTokenSymbol(tokenId);
  if (!sanitizedTokenId) {
    return null;
  }
  const standardizedId = resolveTokenAlias(sanitizedTokenId);
  if (!standardizedId || !(standardizedId in TOKEN_PRICE_BOUNDS)) {
    return null;
  }
  return TOKEN_PRICE_BOUNDS[standardizedId as keyof typeof TOKEN_PRICE_BOUNDS];
}