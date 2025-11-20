import Fastify from 'fastify';
import { authenticate } from './plugins/authenticate';
import { requestTiming } from './plugins/requestTiming';
import { logger } from './utils/logger';

export function buildApp() {
  const app = Fastify({
    logger: true, // Enable Fastify's built-in logger
  });

  // Register plugins and middleware in the correct order
  // requestTiming should come first to log all requests
  app.register(requestTiming);
  // authenticate should come after timing, but before routes that require authentication
  app.register(authenticate);

  // Example route (for testing purposes)
  app.get('/health', async (request, reply) => {
    return { status: 'ok' };
  });

  app.get('/protected', { preHandler: [authenticate] }, async (request, reply) => {
    return { message: 'This is a protected route', user: request.user };
  });

  return app;
}

if (require.main === module) {
  const app = buildApp();

  app.listen({ port: 3000 }, (err, address) => {
    if (err) {
      logger.error(err);
      process.exit(1);
    }
    logger.info(`Server listening at ${address}`);
  });
}
