import { FastifyPluginAsync } from 'fastify';
import fastifyRateLimit from '@fastify/rate-limit';

const rateLimiterPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.register(fastifyRateLimit, {
    max: 100, // Max requests per windowMs
    timeWindow: 60 * 1000, // 1 minute
    hook: 'preHandler', // Hook to apply the rate limit
    allowList: [], // IP addresses that are not rate limited
    redis: undefined, // No redis by default, in-memory store
    headers: true, // Add X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers
    continueExceeding: false, // Do not continue to process requests once the limit is reached
    keyGenerator: (request) => {
      return request.ip; // Use IP address as the key for rate limiting
    },
    errorResponseBuilder: (request, context) => {
      return {
        code: 429,
        message: 'Too Many Requests',
        data: `You have exceeded the request limit of ${context.max} requests per ${context.timeWindow}ms.`,
      };
    },
  });
};

export default rateLimiterPlugin;
