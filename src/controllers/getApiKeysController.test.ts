import Fastify from 'fastify';
import { getApiKeysController } from './getApiKeysController';
import { PrismaClient } from '@prisma/client';

// Mock Prisma Client
const prisma = new PrismaClient();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    token: {
      findMany: jest.fn(),
    },
  })),
}));

describe('getApiKeysController', () => {
  let fastify: any;
  let mockFindMany: jest.Mock;

  beforeEach(() => {
    fastify = Fastify();
    fastify.register(getApiKeysController);
    mockFindMany = prisma.token.findMany as jest.Mock;
  });

  afterEach(async () => {
    await fastify.close();
    jest.clearAllMocks();
  });

  test('GET /api-keys should return a list of API keys', async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: 'token1', address: 'address1' },
      { id: 'token2', address: 'address2' },
    ]);

    const response = await fastify.inject({
      method: 'GET',
      url: '/api-keys',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      apiKeys: [
        { id: 'token1', address: 'address1' },
        { id: 'token2', address: 'address2' },
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
      { id: 'token1', address: 'address1' },
      { id: 'token2', address: 'address2' },
      { id: 'token3', address: 'address3' },
    ]);

    const response = await fastify.inject({
      method: 'GET',
      url: '/api-keys?limit=2',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      apiKeys: [
        { id: 'token1', address: 'address1' },
        { id: 'token2', address: 'address2' },
      ],
      nextCursor: 'token3',
    });
    expect(mockFindMany).toHaveBeenCalledWith({
      take: 3,
      orderBy: { id: 'asc' },
    });
  });

  test('GET /api-keys should apply cursor and limit pagination', async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: 'token3', address: 'address3' },
      { id: 'token4', address: 'address4' },
      { id: 'token5', address: 'address5' },
    ]);

    const response = await fastify.inject({
      method: 'GET',
      url: '/api-keys?cursor=token2&limit=2',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      apiKeys: [
        { id: 'token3', address: 'address3' },
        { id: 'token4', address: 'address4' },
      ],
      nextCursor: 'token5',
    });
    expect(mockFindMany).toHaveBeenCalledWith({
      take: 3,
      orderBy: { id: 'asc' },
      cursor: { id: 'token2' },
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
