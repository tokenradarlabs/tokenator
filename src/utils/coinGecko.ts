import logger from './logger';
import 'dotenv/config';

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

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;

if (!COINGECKO_API_KEY) {
    logger.error('[CoinGecko] COINGECKO_API_KEY is not set in environment variables');
    throw new Error('COINGECKO_API_KEY is required but not set in environment variables');
}

/**
 * Fetches the price data for a specific token from CoinGecko
 * @param tokenId The CoinGecko token ID (e.g., 'scout-protocol-token')
 * @returns The price data including USD price, 24h volume, and 24h change
 */
export async function fetchTokenPrice(tokenId: string): Promise<CoinGeckoPriceDetail | null> {
    const url = `https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&ids=${tokenId}&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&precision=5`;
    const options = {
        method: 'GET',
        headers: {
            accept: 'application/json',
            'x-cg-demo-api-key': COINGECKO_API_KEY as string
        }
    };

    try {
        logger.info(`[CoinGecko] Fetching price for token: ${tokenId}`);
        const response = await fetch(url, options);

        if (!response.ok) {
            const errorBody = await response.text();
            logger.error('[CoinGecko] Failed to fetch token price', {
                status: response.status,
                statusText: response.statusText,
                errorBody: errorBody,
            });
            return null;
        }

        const json = await response.json() as CoinGeckoPriceResponse;
        const tokenData = json[tokenId];

        if (!tokenData || typeof tokenData.usd !== 'number') {
            logger.warn('[CoinGecko] Received invalid or unexpected data structure', { response: json });
            return null;
        }

        logger.info(`[CoinGecko] Successfully fetched price for ${tokenId}: $${tokenData.usd}`);
        return tokenData;
    } catch (error) {
        logger.error('[CoinGecko] Error fetching or processing token price', { 
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            errorStack: error instanceof Error ? error.stack : undefined,
        });
        return null;
    }
} 