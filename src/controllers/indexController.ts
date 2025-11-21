import { FastifyInstance } from 'fastify';
import { authenticate } from '../plugins/authenticate';

export async function indexController(fastify: FastifyInstance) {
  fastify.get('/health', async (request, reply) => {
    return { status: 'ok' };
  });

  fastify.get('/protected', { preHandler: [authenticate] }, async (request, reply) => {
    return { message: 'This is a protected route', user: request.user };
  });
}
