import { FastifyPluginAsync } from 'fastify';
import fastifyRateLimit from '@fastify/rate-limit';
import Redis from 'ioredis';
import RedisStore from '@fastify/rate-limit-redis';
import { config } from '../config';

const rateLimiterPlugin: FastifyPluginAsync = async (fastify) => {
  let store: RedisStore | undefined;

  if (config.REDIS_URL) {
    let redisClient: Redis | undefined;
    try {
      redisClient = new Redis(config.REDIS_URL);
      redisClient.on('error', (err) => {
        fastify.log.error({ err }, 'Redis client error');
      });
      redisClient.on('connect', () => {
        fastify.log.info('Redis client connected.');
      });
      redisClient.on('reconnecting', () => {
        fastify.log.warn('Redis client reconnecting...');
      });
      store = new RedisStore(redisClient);
      fastify.log.info('Redis rate limiter enabled.');

      fastify.addHook('onClose', async () => {
        if (redisClient) {
          await redisClient.quit();
          fastify.log.info('Redis client quit successfully.');
        }
      });
    } catch (error) {
      fastify.log.error({ error }, 'Failed to initialize Redis rate limiter. Falling back to in-memory store.');
      // Fallback to in-memory store by not setting 'store'
    }
  } else {
    fastify.log.warn('Redis is not configured for rate limiting. Using in-memory store. Consider configuring REDIS_URL for distributed deployments.');
  }

  fastify.register(fastifyRateLimit, {
    max: 100, // Max requests per windowMs
    timeWindow: 60 * 1000, // 1 minute
    hook: 'preHandler', // Hook to apply the rate limit
    allowList: [], // IP addresses that are not rate limited
    store, // Use Redis store if configured, otherwise in-memory
    headers: true, // Add X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers
    continueExceeding: false, // Do not continue to process requests once the limit is reached
    keyGenerator: (request) => {
      return request.ip; // Use IP address as the key for rate limiting
    },
    errorResponseBuilder: (request, context) => {
      return {
        message: `You have exceeded the request limit of ${context.max} requests per ${context.after}.`,
      };
    },
  });
};

export default rateLimiterPlugin;
