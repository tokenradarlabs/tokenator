import logger from './logger';
import { config } from '../config';
import 'dotenv/config';

/**
 * @file CoinGecko Utility Module
 * @module utils/coinGecko
 * @description This module provides utilities for interacting with the CoinGecko API,
 * including fetching token prices and handling API-related errors.
 *
 * It implements an in-memory cache for CoinGecko API responses to deduplicate
 * frequent identical requests. This cache is designed for short-term deduplication
 * within a single run and gracefully falls back to a fresh API call on cache failures.
 *
 * @property {number} COINGECKO_CACHE_TTL_SECONDS - The time-to-live (TTL) for cache entries in seconds.
 *                                                  Cache entries expire after this duration.
 * @property {Map<string, { data: CoinGeckoPriceDetail; expiry: number }>} priceCache -
 *           The in-memory cache storing CoinGecko price data. Keys are token IDs,
 *           values are objects containing the price detail and an expiry timestamp.
 * @property {Map<string, NodeJS.Timeout>} cacheTimeouts -
 *           A map to store timeout IDs for each cached token, allowing for clearing
 *           timeouts if a token is re-cached before its previous expiry.
 */

// In-memory cache for CoinGecko API responses to deduplicate frequent identical requests.
// This cache is tiny, optional, and designed for short-term deduplication within a single run.
// On cache failures (e.g., unexpected data structure), it will gracefully fallback to a fresh API call.
// Cache entries expire after COINGECKO_CACHE_TTL_SECONDS.
const COINGECKO_CACHE_TTL_SECONDS = 5; // Cache entries expire after 5 seconds
const priceCache = new Map<string, { data: CoinGeckoPriceDetail; expiry: number }>();
const cacheTimeouts = new Map<string, NodeJS.Timeout>();

/**
 * Formats a number for display, using 'K' for thousands and 'M' for millions.
 *
 * @param {number} num - The number to format.
 * @param {number} [decimals=2] - The number of decimal places to include. Defaults to 2.
 * @returns {string} The formatted number as a string (e.g., "1.23K", "4.56M", "7.89").
 *
 * @example
 * // Returns "123.46"
 * formatNumber(123.456, 2);
 *
 * @example
 * // Returns "1.23K"
 * formatNumber(1234.56);
 *
 * @example
 * // Returns "1.2K"
 * formatNumber(1234.56, 1);
 *
 * @example
 * // Returns "1.23M"
 * formatNumber(1234567.89);
 */
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

/**
 * Maps an HTTP status code to a CoinGeckoErrorType.
 *
 * @param {number} status - The HTTP status code received from the CoinGecko API.
 * @returns {CoinGeckoErrorType} The corresponding error type.
 *
 * @example
 * // Returns 'rate_limited'
 * mapStatusToErrorType(429);
 *
 * @example
 * // Returns 'server_error'
 * mapStatusToErrorType(500);
 *
 * @example
 * // Returns 'unknown'
 * mapStatusToErrorType(418); // I'm a teapot
 */
function mapStatusToErrorType(status: number): CoinGeckoErrorType {
  if (status === 429) return 'rate_limited';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 400) return 'bad_request';
  if (status >= 500) return 'server_error';
  return 'unknown';
}

/**
 * Fetches price data for a specific token from CoinGecko, including detailed market information.
 * This function utilizes an in-memory cache to deduplicate frequent identical requests
 * within a short timeframe (COINGECKO_CACHE_TTL_SECONDS).
 *
 * @param {string} tokenId - The CoinGecko token ID (e.g., 'scout-protocol-token', 'bitcoin').
 * @returns {Promise<CoinGeckoFetchResult>} A promise that resolves to a `CoinGeckoFetchResult` object.
 *   If `ok` is true, `data` contains `CoinGeckoPriceDetail`.
 *   If `ok` is false, `errorType`, `status` (optional), and `message` provide error details.
 *
 * @example
 * // Example 1: Successful fetch
 * // const result = await fetchTokenPriceDetailed('bitcoin');
 * // if (result.ok) {
 * //   console.log(`Bitcoin price: $${result.data.usd}`);
 * // } else {
 * //   console.error(`Error fetching Bitcoin price: ${result.message}`);
 * // }
 *
 * @example
 * // Example 2: Handling an invalid token ID
 * // const result = await fetchTokenPriceDetailed('invalid-token-id');
 * // if (!result.ok && result.errorType === 'invalid_token') {
 * //   console.warn(`Invalid token ID: ${result.message}`);
 * // }
 *
 * @example
 * // Example 3: Handling a rate limit error
 * // const result = await fetchTokenPriceDetailed('ethereum');
 * // if (!result.ok && result.errorType === 'rate_limited') {
 * //   console.error(`Rate limit hit: ${result.message}`);
 * // }
 *
 * @remarks
 * The function first checks an in-memory cache. If a valid, unexpired entry is found,
 * it returns the cached data. Otherwise, it makes a fresh API call to CoinGecko.
 *
 * Error handling includes network issues, HTTP errors (e.g., 404, 429, 500),
 * and unexpected data structures from the CoinGecko API.
 * The `CoinGeckoFetchResult` type provides a structured way to handle both
 * successful responses and various error conditions.
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