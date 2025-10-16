import logger from './logger';
import { config } from '../config';
import 'dotenv/config';

// In-memory cache for CoinGecko API responses to deduplicate frequent identical requests.
// This cache is tiny, optional, and designed for short-term deduplication within a single run.
// On cache failures (e.g., unexpected data structure), it will gracefully fallback to a fresh API call.
// Cache entries expire after COINGECKO_CACHE_TTL_SECONDS.
const COINGECKO_CACHE_TTL_SECONDS = 5; // Cache entries expire after 5 seconds
const priceCache = new Map<string, { data: CoinGeckoPriceDetail; expiry: number }>();
const cacheTimeouts = new Map<string, NodeJS.Timeout>();

// Utility to format numbers for display (e.g., 1.2K, 1.2M)
export function formatNumber(num: number, decimals: number = 2): string {
    if (num >= 1000000) {
        return `${(num / 1000000).toFixed(decimals)}M`;
    } else if (num >= 1000) {
        return `${(num / 1000).toFixed(decimals)}K`;
    }
    return num.toFixed(decimals);
}

// Interface for the Coingecko API response
interface CoinGeckoPriceDetail {
  usd: number;
  usd_24h_vol?: number;
  usd_24h_change?: number;
  usd_market_cap?: number;
}

interface CoinGeckoPriceResponse {
  [tokenId: string]: CoinGeckoPriceDetail;
}

const COINGECKO_API_KEY = config.COINGECKO_API_KEY;

export type CoinGeckoErrorType =
  | 'network_error'
  | 'rate_limited'
  | 'invalid_token'
  | 'unauthorized'
  | 'forbidden'
  | 'server_error'
  | 'bad_request'
  | 'unknown';

export type CoinGeckoFetchResult =
  | { ok: true; data: CoinGeckoPriceDetail }
  | { ok: false; errorType: CoinGeckoErrorType; status?: number; message: string };

function mapStatusToErrorType(status: number): CoinGeckoErrorType {
  if (status === 429) return 'rate_limited';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 400) return 'bad_request';
  if (status >= 500) return 'server_error';
  return 'unknown';
}

/**
 * Fetches price data from CoinGecko with detailed error context
 */
export async function fetchTokenPriceDetailed(tokenId: string): Promise<CoinGeckoFetchResult> {
  // Check cache first
  const cached = priceCache.get(tokenId);
  if (cached && cached.expiry > Date.now()) {
    logger.info(`[CoinGecko] Returning cached price for token: ${tokenId}`);
    return { ok: true, data: cached.data };
  }

  const url = `https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&ids=${tokenId}&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&precision=5`;
  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'x-cg-demo-api-key': COINGECKO_API_KEY as string,
    },
  } as const;

  try {
    logger.info(`[CoinGecko] Fetching price for token: ${tokenId}`);
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorBody = await response.text();
      const errorType = mapStatusToErrorType(response.status);
      const message = `[CoinGecko] HTTP ${response.status} ${response.statusText}`;

      logger.error('[CoinGecko] Failed to fetch token price', {
        status: response.status,
        statusText: response.statusText,
        errorBody,
      });

      return { ok: false, errorType, status: response.status, message };
    }

    const json = (await response.json()) as CoinGeckoPriceResponse;
    const tokenData = json[tokenId];

    if (!tokenData) {
      const message = `[CoinGecko] Token not found or returned empty data for id: ${tokenId}`;
      logger.warn(message, { response: json });
      return { ok: false, errorType: 'invalid_token', message };
    }

    if (typeof tokenData.usd !== 'number') {
      const message = '[CoinGecko] Unexpected data structure: missing usd price';
      logger.warn(message, { response: json });
      return { ok: false, errorType: 'unknown', message };
    }

    logger.info(`[CoinGecko] Successfully fetched price for ${tokenId}: $${tokenData.usd}`);

    // Cache the successful response
    const expiry = Date.now() + COINGECKO_CACHE_TTL_SECONDS * 1000;
    priceCache.set(tokenId, { data: tokenData, expiry });

    // Clear any existing timeout and set a new one
    if (cacheTimeouts.has(tokenId)) {
      clearTimeout(cacheTimeouts.get(tokenId));
    }
    const timeout = setTimeout(() => {
      priceCache.delete(tokenId);
      cacheTimeouts.delete(tokenId);
      logger.debug(`[CoinGecko] Cache for ${tokenId} expired and cleared.`);
    }, COINGECKO_CACHE_TTL_SECONDS * 1000);
    cacheTimeouts.set(tokenId, timeout);

    return { ok: true, data: tokenData };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown network error';
    logger.error('[CoinGecko] Network or processing error fetching token price', {
      errorMessage: message,
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    return { ok: false, errorType: 'network_error', message };
  }
}

/**
 * Fetches the price data for a specific token from CoinGecko
 * @param tokenId The CoinGecko token ID (e.g., 'scout-protocol-token')
 * @returns The price data including USD price, 24h volume, and 24h change
 */
export async function fetchTokenPrice(
  tokenId: string
): Promise<CoinGeckoPriceDetail | null> {
  // Backwards-compatible wrapper used by other utilities
  const result = await fetchTokenPriceDetailed(tokenId);
  return result.ok ? result.data : null;
}

/**
 * Builds a user-friendly message for CoinGecko fetch failures
 */
export function buildFriendlyCoinGeckoError(
  tokenId: string,
  result: CoinGeckoFetchResult
): string {
  if (result.ok) return `Unexpected error fetching **${tokenId}**.`;
  switch (result.errorType) {
    case 'invalid_token':
      return `The token id **${tokenId}** is invalid or not recognized by CoinGecko.`;
    case 'rate_limited':
      return `Rate limit reached while fetching **${tokenId}**. Please wait a minute and try again.`;
    case 'unauthorized':
    case 'forbidden':
      return `Access to CoinGecko API was denied while fetching **${tokenId}**. Please check API key configuration.`;
    case 'server_error':
      return `CoinGecko is experiencing issues (server error) for **${tokenId}**. Please try again shortly.`;
    case 'bad_request':
      return `Bad request sent to CoinGecko for **${tokenId}**. Please verify the token id and try again.`;
    case 'network_error':
      return `Network error while reaching CoinGecko for **${tokenId}**. Please check your connection and try again.`;
    default:
      return `Sorry, couldn't fetch the **${tokenId}** data right now. Please try again later.`;
  }
}