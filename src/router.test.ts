import Fastify from 'fastify';
import { router } from './router';
import { indexController } from './controllers/indexController';
import { authenticate } from './plugins/authenticate';

describe('Router', () => {
  let app: Fastify.FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    app.register(authenticate); // Register authenticate plugin as it's used by indexController
    app.register(router);
    app.register(indexController);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  test('should register health route', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  test('should register protected route and require authentication', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
    });
    expect(response.statusCode).toBe(401);
  });
});
