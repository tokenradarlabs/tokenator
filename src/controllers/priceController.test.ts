import { buildApp } from '../app';
import * as coinGeckoUtils from '../utils/coinGecko';

describe('Price Controller', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let fetchTokenPriceDetailedSpy: jest.SpyInstance;

  beforeEach(async () => {
    app = buildApp();
    await app.ready();
    fetchTokenPriceDetailedSpy = jest.spyOn(coinGeckoUtils, 'fetchTokenPriceDetailed');
  });

  afterEach(async () => {
    fetchTokenPriceDetailedSpy.mockRestore();
    await app.close();
  });

  test('GET /price/:token should return 200 with price for a valid token', async () => {
    fetchTokenPriceDetailedSpy.mockResolvedValueOnce({
      ok: true,
      data: { usd: 123.45, usd_24h_vol: 1000, usd_24h_change: 5 },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/price/bitcoin',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ token: 'bitcoin', price: 123.45 });
  });

  test('GET /price/:token should return 404 for an invalid token', async () => {
    fetchTokenPriceDetailedSpy.mockResolvedValueOnce({
      ok: false,
      errorType: 'invalid_token',
      message: '[CoinGecko] Token not found or returned empty data for id: invalid-token',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/price/invalid-token',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      message: '[CoinGecko] Token not found or returned empty data for id: invalid-token',
    });
  });

  test('GET /price/:token should return 400 for a bad request', async () => {
    fetchTokenPriceDetailedSpy.mockResolvedValueOnce({
      ok: false,
      errorType: 'bad_request',
      message: '[CoinGecko] Bad request sent to CoinGecko for token: bad-request',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/price/bad-request',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: '[CoinGecko] Bad request sent to CoinGecko for token: bad-request',
    });
  });

  test('GET /price/:token should return 500 for an internal server error', async () => {
    fetchTokenPriceDetailedSpy.mockResolvedValueOnce({
      ok: false,
      errorType: 'server_error',
      message: '[CoinGecko] CoinGecko is experiencing issues (server error) for token: ethereum',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/price/ethereum',
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      message: '[CoinGecko] CoinGecko is experiencing issues (server error) for token: ethereum',
    });
  });

  test('GET /price/:token should return 500 for an unexpected error during fetch', async () => {
    fetchTokenPriceDetailedSpy.mockRejectedValueOnce(new Error('Network down'));

    const response = await app.inject({
      method: 'GET',
      url: '/price/some-token',
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      message: 'Internal Server Error',
    });
  });
});
