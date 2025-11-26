
import { logger } from './logger';

interface FetchOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
  backoffFactor?: number;
}

export async function fetchWithRetry(url: string, options?: FetchOptions): Promise<Response> {
  const { retries = 3, retryDelay = 1000, backoffFactor = 2, ...fetchOptions } = options || {};

  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, fetchOptions);
      if (response.ok) {
        return response;
      } else if (response.status === 429) { // Too Many Requests
        logger.warn(`Rate limit hit for ${url}. Retrying... (Attempt ${i + 1}/${retries + 1})`);
      } else if (response.status >= 500) { // Server errors
        logger.error(`Server error ${response.status} for ${url}. Retrying... (Attempt ${i + 1}/${retries + 1})`);
      } else {
        // For other client errors (4xx) or unhandled statuses, don't retry
        return response;
      }
    } catch (error: any) {
      logger.error(`Fetch error for ${url}: ${error.message}. Retrying... (Attempt ${i + 1}/${retries + 1})`);
    }

    if (i < retries) {
      const delay = retryDelay * Math.pow(backoffFactor, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error(`Failed to fetch ${url} after ${retries + 1} attempts.`);
}
