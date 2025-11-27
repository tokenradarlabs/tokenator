import { FastifyInstance } from 'fastify';
import { authenticate } from '../plugins/authenticate';
import { sendSuccess } from '../utils/responseHelper';

export async function indexController(fastify: FastifyInstance) {
  fastify.get('/health', async (request, reply) => {
    sendSuccess(reply, { status: 'ok' });
  });

  fastify.get('/protected', { preHandler: [authenticate] }, async (request, reply) => {
    sendSuccess(reply, { message: 'This is a protected route', user: request.user });
  });
}
