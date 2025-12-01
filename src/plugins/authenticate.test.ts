import { FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from './authenticate';
import jwt from 'jsonwebtoken';
import { sendError } from '../utils/responseHelper';
import prisma from '../utils/prisma';
import { config } from '../config';

const mockApiKeyUpdate = jest.fn();
const mockApiKeyUsageCreate = jest.fn();
const mockTransaction = jest.fn((callback) => callback({
  apiKey: {
    update: mockApiKeyUpdate,
  },
  apiKeyUsage: {
    create: mockApiKeyUsageCreate,
  },
}));

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    apiKey: {
      update: mockApiKeyUpdate,
    },
    apiKeyUsage: {
      create: mockApiKeyUsageCreate,
    },
    $transaction: mockTransaction,
  },
}));

describe('authenticate plugin', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let mockLog: { warn: jest.Mock; error: jest.Mock };

  beforeEach(() => {
    mockLog = {
      warn: jest.fn(),
      error: jest.fn(),
    };
    mockRequest = {
      headers: {},
      log: mockLog as any,
    };
    mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    (jwt.verify as jest.Mock).mockClear();
    (sendError as jest.Mock).mockClear();
    mockApiKeyUpdate.mockClear();
    mockApiKeyUsageCreate.mockClear();
    mockTransaction.mockClear();
  });

  // Helper function to create a valid token
  const createToken = (id: string) => {
    return jwt.sign({ id }, config.JWT_SECRET);
  };

  test('should successfully authenticate with a valid token and track usage', async () => {
    const userId = 'test-user-id';
    const token = createToken(userId);
    mockRequest.headers.authorization = `Bearer ${token}`;

    (jwt.verify as jest.Mock).mockReturnValue({ id: userId });
    mockApiKeyUpdate.mockResolvedValue({ id: userId, usageCount: 1 });
    mockApiKeyUsageCreate.mockResolvedValue({ apiKeyId: userId, timestamp: new Date() });

    await authenticate(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(jwt.verify).toHaveBeenCalledWith(token, config.JWT_SECRET);
    expect(mockRequest.user).toEqual({ id: userId });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockApiKeyUpdate).toHaveBeenCalledWith({
      where: { id: userId },
      data: { usageCount: { increment: 1 } },
    });
    expect(mockApiKeyUsageCreate).toHaveBeenCalledWith({
      data: {
        apiKeyId: userId,
        timestamp: expect.any(Date),
      },
    });
    expect(sendError).not.toHaveBeenCalled();
    expect(mockLog.warn).not.toHaveBeenCalled();
    expect(mockLog.error).not.toHaveBeenCalled();
  });

  test('should call sendError if no authorization header is provided', async () => {
    await authenticate(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(sendError).toHaveBeenCalledWith(mockReply, 'Unauthorized: No token provided.', 401);
    expect(mockLog.warn).toHaveBeenCalledWith('Authentication failed: No Authorization header provided.');
    expect(jwt.verify).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test('should call sendError if authorization header does not start with Bearer', async () => {
    mockRequest.headers.authorization = 'Token abc';

    await authenticate(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(sendError).toHaveBeenCalledWith(mockReply, 'Unauthorized: Invalid authentication scheme.', 401);
    expect(mockLog.warn).toHaveBeenCalledWith('Authentication failed: Authorization header does not start with Bearer.');
    expect(jwt.verify).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test('should call sendError if token is missing after Bearer', async () => {
    mockRequest.headers.authorization = 'Bearer ';

    await authenticate(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(sendError).toHaveBeenCalledWith(mockReply, 'Unauthorized: Token missing.', 401);
    expect(mockLog.warn).toHaveBeenCalledWith('Authentication failed: Token is missing after Bearer.');
    expect(jwt.verify).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test('should call sendError if jwt verification fails', async () => {
    mockRequest.headers.authorization = 'Bearer invalid-token';
    const errorMessage = 'jwt malformed';
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await authenticate(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(jwt.verify).toHaveBeenCalled();
    expect(sendError).toHaveBeenCalledWith(mockReply, 'Unauthorized: Invalid token.', 401);
    expect(mockLog.warn).toHaveBeenCalledWith(`Authentication failed: Invalid token. Error: ${errorMessage}`);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test('should log error and proceed if prisma.apiKey.update fails but not call sendError', async () => {
    const userId = 'test-user-id';
    const token = createToken(userId);
    mockRequest.headers.authorization = `Bearer ${token}`;
    const dbErrorMessage = 'Database update failed';

    (jwt.verify as jest.Mock).mockReturnValue({ id: userId });
    mockApiKeyUpdate.mockRejectedValue(new Error(dbErrorMessage));
    mockApiKeyUsageCreate.mockResolvedValue({ apiKeyId: userId, timestamp: new Date() });

    await authenticate(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(jwt.verify).toHaveBeenCalledWith(token, config.JWT_SECRET);
    expect(mockRequest.user).toEqual({ id: userId });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockApiKeyUpdate).toHaveBeenCalledWith({
      where: { id: userId },
      data: { usageCount: { increment: 1 } },
    });
    expect(mockApiKeyUsageCreate).not.toHaveBeenCalled(); // transaction should rollback if update fails
    expect(mockLog.error).toHaveBeenCalledWith(`Failed to track API key usage for key ID ${userId}: ${dbErrorMessage}`);
    expect(sendError).not.toHaveBeenCalled();
  });

  test('should log error and proceed if prisma.apiKeyUsage.create fails but not call sendError', async () => {
    const userId = 'test-user-id';
    const token = createToken(userId);
    mockRequest.headers.authorization = `Bearer ${token}`;
    const dbErrorMessage = 'Database create failed';

    (jwt.verify as jest.Mock).mockReturnValue({ id: userId });
    mockApiKeyUpdate.mockResolvedValue({ id: userId, usageCount: 1 });
    mockApiKeyUsageCreate.mockRejectedValue(new Error(dbErrorMessage));

    await authenticate(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(jwt.verify).toHaveBeenCalledWith(token, config.JWT_SECRET);
    expect(mockRequest.user).toEqual({ id: userId });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockApiKeyUpdate).toHaveBeenCalledWith({
      where: { id: userId },
      data: { usageCount: { increment: 1 } },
    });
    expect(mockApiKeyUsageCreate).toHaveBeenCalledWith({
      data: {
        apiKeyId: userId,
        timestamp: expect.any(Date),
      },
    });
    expect(mockLog.error).toHaveBeenCalledWith(`Failed to track API key usage for key ID ${userId}: ${dbErrorMessage}`);
    expect(sendError).not.toHaveBeenCalled();
  });

  test('should handle concurrent requests gracefully', async () => {
    const userId = 'concurrent-user';
    const token = createToken(userId);
    const numRequests = 5;

    (jwt.verify as jest.Mock).mockReturnValue({ id: userId });

    // Each call to $transaction will get its own set of mocked tx.apiKey.update and tx.apiKeyUsage.create
    // We need to keep track of calls to the *global* mocks for update and create here.
    mockApiKeyUpdate.mockResolvedValue({ id: userId, usageCount: 1 });
    mockApiKeyUsageCreate.mockResolvedValue({ apiKeyId: userId, timestamp: new Date() });

    const requests = Array.from({ length: numRequests }).map(() => {
      const req = { ...mockRequest, headers: { authorization: `Bearer ${token}` } } as FastifyRequest;
      return authenticate(req, mockReply as FastifyReply);
    });

    await Promise.all(requests);

    expect(jwt.verify).toHaveBeenCalledTimes(numRequests);
    expect(mockTransaction).toHaveBeenCalledTimes(numRequests);
    expect(mockApiKeyUpdate).toHaveBeenCalledTimes(numRequests);
    expect(mockApiKeyUsageCreate).toHaveBeenCalledTimes(numRequests);

    // Verify the arguments for each call
    for (let i = 0; i < numRequests; i++) {
      expect(mockApiKeyUpdate).toHaveBeenNthCalledWith(i + 1, {
        where: { id: userId },
        data: { usageCount: { increment: 1 } },
      });
      expect(mockApiKeyUsageCreate).toHaveBeenNthCalledWith(i + 1, {
        data: {
          apiKeyId: userId,
          timestamp: expect.any(Date),
        },
      });
    }

    expect(sendError).not.toHaveBeenCalled();
    expect(mockLog.error).not.toHaveBeenCalled();
  });
});
