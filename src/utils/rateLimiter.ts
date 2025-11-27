import { FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

interface RateLimiterOptions {
  tokensPerInterval: number;
  interval: number; // in milliseconds
  maxTokens: number;
}

class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(private options: RateLimiterOptions) {
    this.tokens = options.maxTokens;
    this.lastRefill = Date.now();
  }

  private refillTokens() {
    const now = Date.now();
    const timeElapsed = now - this.lastRefill;
    if (timeElapsed > 0) {
      const tokensToAdd = (timeElapsed / this.options.interval) * this.options.tokensPerInterval;
      this.tokens = Math.min(this.options.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  tryConsume(count: number = 1): boolean {
    this.refillTokens();
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }
}

const userBuckets = new Map<string, TokenBucket>();

const defaultRateLimiterOptions: RateLimiterOptions = {
  tokensPerInterval: 10, // 10 tokens per second
  interval: 1000, // 1 second
  maxTokens: 20, // Allow bursts up to 20 tokens
};

const rateLimiterPlugin: FastifyPluginAsync<RateLimiterOptions> = async (
  fastify,
  options
) => {
  const opts = { ...defaultRateLimiterOptions, ...options };

  fastify.addHook('preHandler', (request: FastifyRequest, reply: FastifyReply, done) => {
    const ip = request.ip; // Or use request.user.id if authenticated
    if (!ip) {
      reply.status(500).send({ message: 'Rate Limiter: Could not determine IP address.' });
      return done(new Error('Could not determine IP address for rate limiting.'));
    }

    if (!userBuckets.has(ip)) {
      userBuckets.set(ip, new TokenBucket(opts));
    }

    const bucket = userBuckets.get(ip)!;

    if (bucket.tryConsume()) {
      done();
    } else {
      reply.status(429).send({ message: 'Too Many Requests' });
      done(new Error('Too Many Requests'));
    }
  });
};

export const rateLimiter = fp(rateLimiterPlugin, {
  name: 'rateLimiter',
});
