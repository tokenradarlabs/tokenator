import Fastify from 'fastify';
import { authenticate } from './plugins/authenticate';
import { requestTiming } from './plugins/requestTiming';
import logger from './utils/logger';
import { router } from './router';
import { indexController } from './controllers/indexController';
import { priceController } from './controllers/priceController';
import { rateLimiter } from './utils/rateLimiter';
import { HttpError } from './utils/httpErrors';

export function buildApp() {
  const app = Fastify({
    logger: true, // Enable Fastify's built-in logger
  });

  // Register plugins and middleware in the correct order
  // requestTiming should come first to log all requests
  app.register(requestTiming);
  // Register rate limiter before other routes
  app.register(rateLimiter);
  // authenticate should come after timing, but before routes that require authentication

  app.register(router);
  app.register(indexController);
  app.register(priceController);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      reply.status(error.statusCode).send({ message: error.message });
    } else {
      app.log.error(error); // Log unexpected errors
      reply.status(500).send({ message: 'Internal Server Error' });
    }
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
