let { fetchTokenPriceDetailed, CoinGeckoFetchResult, CoinGeckoErrorType } = require('./coinGecko');
import { fetchWithRetry, FetchError, TimeoutError, NetworkError } from './fetchWithRetry';
import { config } from '../config';

// Mock logger to prevent console output during tests
jest.mock('./logger', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock fetchWithRetry
jest.mock('./fetchWithRetry', () => ({
  fetchWithRetry: jest.fn(),
  FetchError: FetchError, // Exporting for instanceof checks in tests
  TimeoutError: TimeoutError,
  NetworkError: NetworkError,
}));

const mockFetchWithRetry = fetchWithRetry as jest.MockedFunction<typeof fetchWithRetry>;

// Mock config values
jest.mock('../config', () => ({
  config: {
    COINGECKO_API_KEY: 'test-api-key',
    COINGECKO_CACHE_TTL_SECONDS: 60,
    COINGECKO_API_CACHE_COOLDOWN_SECONDS_MIN: 30,
    COINGECKO_API_CACHE_COOLDOWN_SECONDS_MAX: 120,
    COINGECKO_API_TIMEOUT_MS: 5000, // Added mock for timeout
  },
}));

describe('fetchTokenPriceDetailed', () => {
  const tokenId = 'bitcoin';
  const mockPriceData = {
    usd: 30000,
    usd_24h_vol: 1000000000,
    usd_24h_change: 5,
    usd_market_cap: 600000000000,
  };

  beforeEach(() => {
    jest.resetModules();
    ({ fetchTokenPriceDetailed, CoinGeckoFetchResult, CoinGeckoErrorType } = require('./coinGecko'));
    jest.clearAllMocks();
  });

  it('should return price data on successful fetch', async () => {
    mockFetchWithRetry.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ [tokenId]: mockPriceData }),
    } as Response);

    const result = await fetchTokenPriceDetailed(tokenId);

    expect(result.ok).toBe(true);
    expect((result as { data: any }).data).toEqual(mockPriceData);
    expect(mockFetchWithRetry).toHaveBeenCalledTimes(1);
    expect(mockFetchWithRetry).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ timeout: config.COINGECKO_API_TIMEOUT_MS }));
  });

  it('should return cached data if available and not expired', async () => {
    mockFetchWithRetry.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ [tokenId]: mockPriceData }),
    } as Response);

    // First call to populate the cache
    await fetchTokenPriceDetailed(tokenId);
    expect(mockFetchWithRetry).toHaveBeenCalledTimes(1);

    // Second call should use cache
    const result = await fetchTokenPriceDetailed(tokenId);

    expect(result.ok).toBe(true);
    expect((result as { data: any }).data).toEqual(mockPriceData);
    expect(mockFetchWithRetry).toHaveBeenCalledTimes(1); // Should not call fetchWithRetry again
  });

  it('should fetch new data if cached data is expired', async () => {
    jest.useFakeTimers();

    mockFetchWithRetry.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ [tokenId]: mockPriceData }),
    } as Response);

    // First call to populate the cache
    await fetchTokenPriceDetailed(tokenId);
    expect(mockFetchWithRetry).toHaveBeenCalledTimes(1);

    // Advance timers to expire the cache
    jest.advanceTimersByTime(config.COINGECKO_CACHE_TTL_SECONDS * 1000 + 1);

    mockFetchWithRetry.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ [tokenId]: mockPriceData }),
    } as Response);

    const result = await fetchTokenPriceDetailed(tokenId);

    expect(result.ok).toBe(true);
    expect((result as { data: any }).data).toEqual(mockPriceData);
    expect(mockFetchWithRetry).toHaveBeenCalledTimes(2); // Should call fetchWithRetry again

    jest.useRealTimers();
  });

  it('should handle network errors from fetchWithRetry', async () => {
    mockFetchWithRetry.mockRejectedValueOnce(new NetworkError('Network down'));

    const result = await fetchTokenPriceDetailed(tokenId);

    expect(result.ok).toBe(false);
    expect((result as { errorType: CoinGeckoErrorType }).errorType).toBe('network_error');
    expect((result as { message: string }).message).toContain('Network down');
    expect(mockFetchWithRetry).toHaveBeenCalledTimes(1);
  });

  it('should handle timeout errors from fetchWithRetry', async () => {
    mockFetchWithRetry.mockRejectedValueOnce(new TimeoutError('Request timed out'));

    const result = await fetchTokenPriceDetailed(tokenId);

    expect(result.ok).toBe(false);
    expect((result as { errorType: CoinGeckoErrorType }).errorType).toBe('timeout');
    expect((result as { message: string }).message).toContain('Request timed out');
    expect(mockFetchWithRetry).toHaveBeenCalledTimes(1);
  });

  it('should handle 404 (invalid token) response', async () => {
    mockFetchWithRetry.mockRejectedValueOnce(new FetchError('Failed to fetch with status 404', 404, 'Not Found', 'Token not found'));

    const result = await fetchTokenPriceDetailed(tokenId);

    expect(result.ok).toBe(false);
    expect((result as { errorType: CoinGeckoErrorType }).errorType).toBe('invalid_token');
    expect((result as { status: number }).status).toBe(404);
    expect((result as { message: string }).message).toContain('Failed to fetch with status 404');
    expect(mockFetchWithRetry).toHaveBeenCalledTimes(1);
  });

  it('should handle 429 (rate limit) response', async () => {
    mockFetchWithRetry.mockRejectedValueOnce(new FetchError('Failed to fetch with status 429', 429, 'Too Many Requests', 'Rate limit exceeded'));

    const result = await fetchTokenPriceDetailed(tokenId);

    expect(result.ok).toBe(false);
    expect((result as { errorType: CoinGeckoErrorType }).errorType).toBe('rate_limited');
    expect((result as { status: number }).status).toBe(429);
    expect((result as { message: string }).message).toContain('Failed to fetch with status 429');
    expect(mockFetchWithRetry).toHaveBeenCalledTimes(1);
  });

  it('should handle 500 (server error) response', async () => {
    mockFetchWithRetry.mockRejectedValueOnce(new FetchError('Failed to fetch with status 500', 500, 'Internal Server Error', 'Server crashed'));

    const result = await fetchTokenPriceDetailed(tokenId);

    expect(result.ok).toBe(false);
    expect((result as { errorType: CoinGeckoErrorType }).errorType).toBe('server_error');
    expect((result as { status: number }).status).toBe(500);
    expect((result as { message: string }).message).toContain('Failed to fetch with status 500');
    expect(mockFetchWithRetry).toHaveBeenCalledTimes(1);
  });

  it('should handle empty data for a valid token ID', async () => {
    mockFetchWithRetry.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}), // Empty response for the token ID
    } as Response);

    const result = await fetchTokenPriceDetailed(tokenId);

    expect(result.ok).toBe(false);
    expect((result as { errorType: CoinGeckoErrorType }).errorType).toBe('invalid_token');
    expect((result as { message: string }).message).toContain('Token not found or returned empty data');
    expect(mockFetchWithRetry).toHaveBeenCalledTimes(1);
  });

  it('should handle unexpected data structure (missing usd price)', async () => {
    mockFetchWithRetry.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ [tokenId]: { usd_24h_vol: 100 } }), // Missing usd
    } as Response);

    const result = await fetchTokenPriceDetailed(tokenId);

    expect(result.ok).toBe(false);
    expect((result as { errorType: CoinGeckoErrorType }).errorType).toBe('unknown');
    expect((result as { message: string }).message).toContain('Unexpected data structure: missing usd price');
    expect(mockFetchWithRetry).toHaveBeenCalledTimes(1);
  });
});
