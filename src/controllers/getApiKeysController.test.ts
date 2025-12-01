import Fastify from 'fastify';
import { getApiKeysController } from './getApiKeysController';

// Mock Prisma Client
const mockFindMany = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    apiKey: {
      findMany: mockFindMany,
    },
  })),
}));

describe('getApiKeysController', () => {
  let fastify: any;

  beforeEach(() => {
    fastify = Fastify();
    fastify.register(getApiKeysController);
    mockFindMany.mockClear();
  });

  afterEach(async () => {
    await fastify.close();
    jest.clearAllMocks();
  });

  test('GET /api-keys should return a list of API keys', async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: 'key1', key: 'api-key-1', usageCount: 10 },
      { id: 'key2', key: 'api-key-2', usageCount: 20 },
    ]);

    const response = await fastify.inject({
      method: 'GET',
      url: '/api-keys',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      apiKeys: [
        { id: 'key1', key: 'api-key-1', usageCount: 10 },
        { id: 'key2', key: 'api-key-2', usageCount: 20 },
      ],
      nextCursor: undefined,
    });
    expect(mockFindMany).toHaveBeenCalledWith({
      take: 11,
      orderBy: { id: 'asc' },
    });
  });

  test('GET /api-keys should apply limit pagination', async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: 'key1', key: 'api-key-1', usageCount: 10 },
      { id: 'key2', key: 'api-key-2', usageCount: 20 },
      { id: 'key3', key: 'api-key-3', usageCount: 30 },
    ]);

    const response = await fastify.inject({
      method: 'GET',
      url: '/api-keys?limit=2',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      apiKeys: [
        { id: 'key1', key: 'api-key-1', usageCount: 10 },
        { id: 'key2', key: 'api-key-2', usageCount: 20 },
      ],
      nextCursor: 'key3',
    });
    expect(mockFindMany).toHaveBeenCalledWith({
      take: 3,
      orderBy: { id: 'asc' },
    });
  });

  test('GET /api-keys should apply cursor and limit pagination', async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: 'key3', key: 'api-key-3', usageCount: 30 },
      { id: 'key4', key: 'api-key-4', usageCount: 40 },
      { id: 'key5', key: 'api-key-5', usageCount: 50 },
    ]);

    const response = await fastify.inject({
      method: 'GET',
      url: '/api-keys?cursor=key2&limit=2',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      apiKeys: [
        { id: 'key3', key: 'api-key-3', usageCount: 30 },
        { id: 'key4', key: 'api-key-4', usageCount: 40 },
      ],
      nextCursor: 'key5',
    });
    expect(mockFindMany).toHaveBeenCalledWith({
      take: 3,
      orderBy: { id: 'asc' },
      cursor: { id: 'key2' },
      skip: 1,
    });
  });

  test('GET /api-keys should return empty array if no API keys are found', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const response = await fastify.inject({
      method: 'GET',
      url: '/api-keys',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      apiKeys: [],
      nextCursor: undefined,
    });
  });

  test('GET /api-keys should return 400 for invalid limit', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api-keys?limit=abc',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Limit must be a positive integer.',
    });
  });

  test('GET /api-keys should return 500 for internal server error', async () => {
    mockFindMany.mockRejectedValueOnce(new Error('Database error'));

    const response = await fastify.inject({
      method: 'GET',
      url: '/api-keys',
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to retrieve API keys.',
    });
  });
});
