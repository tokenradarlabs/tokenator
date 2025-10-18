import logger from './logger';
import { getLatestTokenPriceFromDatabase } from './databasePrice';
import { fetchTokenPrice } from './coinGecko';
import { getStandardizedTokenId } from './constants';
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
  priceValue: number,
  direction: 'up' | 'down'
): Promise<PriceValidationResult> {
  // Get standardized token ID
  const standardizedId = getStandardizedTokenId(tokenId);
  if (!standardizedId || !(standardizedId in TOKEN_PRICE_BOUNDS)) {
    return {
      isValid: false,
      errorMessage: `Unsupported token: ${tokenId}`,
    };
  }

  const bounds =
    TOKEN_PRICE_BOUNDS[standardizedId as keyof typeof TOKEN_PRICE_BOUNDS];

  // Validate input type and basic numeric properties
  if (priceValue === null || priceValue === undefined) {
    return {
      isValid: false,
      errorMessage: 'Price value cannot be empty. Please provide a number.',
    };
  }

  if (typeof priceValue !== 'number') {
    return {
      isValid: false,
      errorMessage: `Invalid price input: "${priceValue}". Please enter a numeric value.`,
    };
  }

  if (isNaN(priceValue)) {
    return {
      isValid: false,
      errorMessage: 'Invalid price value: "NaN". Please enter a valid number.',
    };
  }

  if (!isFinite(priceValue)) {
    return {
      isValid: false,
      errorMessage: `Price value "${priceValue}" is not a finite number. Please enter a realistic numeric value.`,
    };
  }

  // Check for non-positive values
  if (priceValue <= 0) {
    return {
      isValid: false,
      errorMessage: `Price value must be positive. You entered: $${formatPrice(priceValue)}.`,
    };
  }

  // Check against absolute bounds
  if (priceValue < bounds.min) {
    return {
      isValid: false,
      errorMessage: `Price value $${formatPrice(priceValue)} is too low for ${
        bounds.name
      }. The minimum allowed is $${formatPrice(bounds.min)}.`,
    };
  }

  if (priceValue > bounds.max) {
    return {
      isValid: false,
      errorMessage: `Price value $${formatPrice(priceValue)} is too high for ${
        bounds.name
      }. The maximum allowed is $${formatPrice(bounds.max)}.`,
    };
  }

  // Get current price for context validation
  let currentPrice: number | null = null;

  try {
    // Try database first
    currentPrice = await getLatestTokenPriceFromDatabase(tokenId);

    // Fallback to CoinGecko if no database price
    if (currentPrice === null) {
      logger.info(
        `[PriceValidation] No database price for ${tokenId}, trying CoinGecko...`
      );
      const coinGeckoData = await fetchTokenPrice(standardizedId);
      if (coinGeckoData?.usd) {
        currentPrice = coinGeckoData.usd;
      }
    }
  } catch (error) {
    logger.warn(
      `[PriceValidation] Could not fetch current price for ${tokenId}:`,
      error
    );
  }

  // If we have current price, do additional validation
  if (currentPrice !== null) {
    const priceDifferenceRatio =
      Math.abs(priceValue - currentPrice) / currentPrice;
    const maxDeviationRatio = 10; // Allow alerts up to 10x current price or 1/10th

    // Check for extreme deviations from current price
    if (priceDifferenceRatio > maxDeviationRatio) {
      const suggestedMin = formatPrice(currentPrice / 10);
      const suggestedMax = formatPrice(currentPrice * 10);

      return {
        isValid: false,
        errorMessage: `Price value $${formatPrice(
          priceValue
        )} seems unrealistic compared to current price of $${formatPrice(
          currentPrice
        )}. Consider a value between $${suggestedMin} and $${suggestedMax}.`,
        currentPrice,
      };
    }

    // Warn about alerts that might never trigger
    if (direction === 'up' && priceValue <= currentPrice) {
      return {
        isValid: false,
        errorMessage: `"Up" alert price $${formatPrice(
          priceValue
        )} should be higher than current price of $${formatPrice(
          currentPrice
        )}`,
        currentPrice,
      };
    }

    if (direction === 'down' && priceValue >= currentPrice) {
      return {
        isValid: false,
        errorMessage: `"Down" alert price $${formatPrice(
          priceValue
        )} should be lower than current price of $${formatPrice(currentPrice)}`,
        currentPrice,
      };
    }
  }

  return {
    isValid: true,
    currentPrice: currentPrice || undefined,
  };
}

/**
 * Gets the bounds for a specific token
 * @param tokenId The token identifier
 * @returns The price bounds for the token, or null if unsupported
 */
export function getTokenPriceBounds(tokenId: string) {
  const standardizedId = getStandardizedTokenId(tokenId);
  if (!standardizedId || !(standardizedId in TOKEN_PRICE_BOUNDS)) {
    return null;
  }
  return TOKEN_PRICE_BOUNDS[standardizedId as keyof typeof TOKEN_PRICE_BOUNDS];
}
