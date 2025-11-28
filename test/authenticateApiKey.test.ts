import { FastifyInstance } from 'fastify';
import tap from 'tap';
import buildServer from '../src/app';
import jwt from 'jsonwebtoken';
import { config } from '../src/config';

declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: string };
  }
}

tap.test('Authentication Plugin', async (t) => {
  let app: FastifyInstance;

  t.beforeEach(async () => {
    app = buildServer();
    await app.ready();
  });

  t.afterEach(async () => {
    await app.close();
  });

  t.test('should return 401 if no authorization header is provided', async (t) => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected-route', // Assuming a protected route exists for testing
    });
    t.equal(response.statusCode, 401);
    t.deepEqual(JSON.parse(response.payload), { message: 'Unauthorized: No token provided.' });
  });

  t.test('should return 401 if authorization header is not Bearer', async (t) => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected-route',
      headers: {
        authorization: 'Basic someToken',
      },
    });
    t.equal(response.statusCode, 401);
    t.deepEqual(JSON.parse(response.payload), { message: 'Unauthorized: No token provided.' });
  });

  t.test('should return 401 if token is invalid', async (t) => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected-route',
      headers: {
        authorization: 'Bearer invalidToken',
      },
    });
    t.equal(response.statusCode, 401);
    t.deepEqual(JSON.parse(response.payload), { message: 'Unauthorized: Invalid token.' });
  });

  t.test('should return 200 if token is valid', async (t) => {
    const userId = 'testUserId';
    const token = jwt.sign({ id: userId }, config.JWT_SECRET, { expiresIn: '1h' });

    // Register a dummy protected route for testing
    app.get('/protected-route', { preHandler: [app.authenticate] }, async (request, reply) => {
      reply.send({ message: 'Access granted', user: request.user });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/protected-route',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    t.equal(response.statusCode, 200);
    t.deepEqual(JSON.parse(response.payload), { message: 'Access granted', user: { id: userId } });
  });
});
