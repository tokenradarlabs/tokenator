
import { logger } from './logger';

export class FetchError extends Error {
  public status?: number;
  public statusText?: string;
  public body?: string;

  constructor(message: string, status?: number, statusText?: string, body?: string) {
    super(message);
    this.name = 'FetchError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

export class TimeoutError extends FetchError {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class NetworkError extends FetchError {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

interface FetchOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
  backoffFactor?: number;
  timeout?: number; // Added timeout option
  jitter?: number; // Added jitter option
}

export async function fetchWithRetry(url: string, options?: FetchOptions): Promise<Response> {
  const {
    retries = 3,
    retryDelay = 1000,
    backoffFactor = 2,
    timeout, // Destructure timeout
    jitter = 0.5, // Default jitter factor
    ...fetchOptions
  } = options || {};

  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const timeoutId = timeout ? setTimeout(() => controller.abort(), timeout) : undefined;

    try {
      const response = await fetch(url, { ...fetchOptions, signal: controller.signal });

      if (timeoutId) clearTimeout(timeoutId);

      if (response.ok) {
        return response;
      } else if (response.status === 429 || response.status >= 500) {
        logger.warn(`[fetchWithRetry] ${response.status} for ${url}. Retrying... (Attempt ${i + 1}/${retries + 1})`);
      } else {
        // For other client errors (4xx) or unhandled statuses, don't retry, throw immediately
        const errorBody = await response.text();
        throw new FetchError(
          `Failed to fetch ${url} with status ${response.status}`,
          response.status,
          response.statusText,
          errorBody
        );
      }
    } catch (error: any) {
      if (timeoutId) clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        logger.error(`[fetchWithRetry] Timeout for ${url}. Retrying... (Attempt ${i + 1}/${retries + 1})`);
        if (i === retries) {
          throw new TimeoutError(`Failed to fetch ${url} after ${retries + 1} attempts due to timeout.`);
        }
      } else if (error instanceof TypeError) { // Network errors often manifest as TypeError in fetch
        logger.error(`[fetchWithRetry] Network error for ${url}: ${error.message}. Retrying... (Attempt ${i + 1}/${retries + 1})`);
        if (i === retries) {
          throw new NetworkError(`Failed to fetch ${url} after ${retries + 1} attempts due to network errors.`);
        }
      } else if (error instanceof FetchError) {
        // Re-throw FetchError immediately as it's not a retryable error (e.g., 404, 400)
        throw error;
      } else {
        logger.error(`[fetchWithRetry] Unexpected error for ${url}: ${error.message}. Retrying... (Attempt ${i + 1}/${retries + 1})`);
        if (i === retries) {
          throw new FetchError(`Failed to fetch ${url} after ${retries + 1} attempts due to unexpected errors: ${error.message}`);
        }
      }
    }

    if (i < retries) {
      const randomJitter = Math.random() * jitter * retryDelay;
      const delay = retryDelay * Math.pow(backoffFactor, i) + randomJitter;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  // This part should ideally not be reached if errors are thrown on last retry
  throw new Error(`Failed to fetch ${url} after ${retries + 1} attempts.`);
}
