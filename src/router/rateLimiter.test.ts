import Fastify from 'fastify';
import { rateLimiter } from '../utils/rateLimiter'; // Adjust path as needed
import { FastifyInstance } from 'fastify';

describe('Rate Limiter', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    jest.useFakeTimers();
    app = Fastify();
    app.register(rateLimiter, {
      tokensPerInterval: 10,
      interval: 1000, // 1 second
      maxTokens: 20,
    });

    app.get('/', async (request, reply) => {
      reply.send({ message: 'OK' });
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    jest.useRealTimers();
  });

  it('should allow requests within the rate limit', async () => {
    for (let i = 0; i < 10; i++) {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      });
      expect(response.statusCode).toBe(200);
    }
  });

  it('should block requests exceeding the burst limit', async () => {
    // Consume initial burst capacity
    for (let i = 0; i < 20; i++) {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      });
      expect(response.statusCode).toBe(200);
    }

    // Next request should be blocked
    const response = await app.inject({
      method: 'GET',
      url: '/',
    });
    expect(response.statusCode).toBe(429);
  });

  it('should allow requests after interval has passed and tokens refilled', async () => {
    // Consume initial burst capacity
    for (let i = 0; i < 20; i++) {
      await app.inject({
        method: 'GET',
        url: '/',
      });
    }

    // Advance time by 1 second (interval)
    jest.advanceTimersByTime(1000);

    // Should have refilled 10 tokens, so 10 requests should be allowed
    for (let i = 0; i < 10; i++) {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      });
      expect(response.statusCode).toBe(200);
    }

    // Next request should be blocked
    const response = await app.inject({
      method: 'GET',
      url: '/',
    });
    expect(response.statusCode).toBe(429);
  });

  it('should handle bursty traffic correctly', async () => {
    // Consume 15 tokens
    for (let i = 0; i < 15; i++) {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      });
      expect(response.statusCode).toBe(200);
    }

    // Advance time by half an interval (500ms), 5 tokens should refill
    jest.advanceTimersByTime(500);

    // Should have 5 + 5 = 10 tokens now (maxTokens is 20, but only 5 refilled)
    for (let i = 0; i < 10; i++) {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      });
      expect(response.statusCode).toBe(200);
    }

    // Next request should be blocked
    const response = await app.inject({
      method: 'GET',
      url: '/',
    });
    expect(response.statusCode).toBe(429);
  });

  it('should reset tokens after a long period of inactivity', async () => {
    // Consume some tokens
    for (let i = 0; i < 5; i++) {
      await app.inject({
        method: 'GET',
        url: '/',
      });
    }

    // Advance time by a very long period, ensuring full refill
    jest.advanceTimersByTime(10000); // 10 seconds

    // Should be able to consume maxTokens again
    for (let i = 0; i < 20; i++) {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      });
      expect(response.statusCode).toBe(200);
    }

    const response = await app.inject({
      method: 'GET',
      url: '/',
    });
    expect(response.statusCode).toBe(429);
  });
});
