import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getApiKeys } from '../lib/api/getApiKeys';
import { BadRequestError, InternalServerError } from '../utils/httpErrors';

interface GetApiKeysQuery {
  cursor?: string;
  limit?: string;
}

export async function getApiKeysController(fastify: FastifyInstance) {
  fastify.get<{ Querystring: GetApiKeysQuery }>('/api-keys', async (request, reply) => {
    const { cursor, limit } = request.query;

    let parsedLimit: number | undefined;
    if (limit !== undefined) {
      parsedLimit = parseInt(limit, 10);
      if (isNaN(parsedLimit) || parsedLimit <= 0) {
        throw new BadRequestError('Limit must be a positive integer.');
      }
    }

    try {
      const result = await getApiKeys({
        cursor,
        limit: parsedLimit,
      });
      reply.send(result);
    } catch (error) {
      fastify.log.error('Error fetching API keys:', error);
      throw new InternalServerError('Failed to retrieve API keys.');
    }
  });
}
