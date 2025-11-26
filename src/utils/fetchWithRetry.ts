
import { logger } from './logger';

interface FetchOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
  backoffFactor?: number;
}

export async function fetchWithRetry(url: string, options?: FetchOptions): Promise<Response> {
  const { retries = 3, retryDelay = 1000, backoffFactor = 2, ...fetchOptions } = options || {};
  let lastResponse: Response | undefined; // To store the last non-OK response

  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, fetchOptions);
      if (response.ok) {
        return response;
      } else if (response.status === 429 || response.status >= 500) {
        lastResponse = response; // Store this response
        logger.warn(`[fetchWithRetry] ${response.status} for ${url}. Retrying... (Attempt ${i + 1}/${retries + 1})`);
      } else {
        // For other client errors (4xx) or unhandled statuses, don't retry, return immediately
        return response;
      }
    } catch (error: any) {
      logger.error(`[fetchWithRetry] Network error for ${url}: ${error.message}. Retrying... (Attempt ${i + 1}/${retries + 1})`);
      // Do not set lastResponse here, as no valid Response object was obtained
    }

    if (i < retries) {
      const delay = retryDelay * Math.pow(backoffFactor, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // After exhausting retries
  if (lastResponse) {
    return lastResponse; // Return the last non-OK response if one was obtained
  } else {
    // Only throw if no response was ever obtained (pure network errors throughout retries)
    throw new Error(`Failed to fetch ${url} after ${retries + 1} attempts due to network errors.`);
  }
}
