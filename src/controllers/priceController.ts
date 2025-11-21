import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { fetchTokenPriceDetailed } from '../utils/coinGecko';
import { NotFoundError, InternalServerError, BadRequestError } from '../utils/httpErrors';

interface PriceRequestParams {
  token: string;
}

export async function priceController(fastify: FastifyInstance) {
  fastify.get<{ Params: PriceRequestParams }>('/price/:token', async (request, reply) => {
    const { token } = request.params;

    const result = await fetchTokenPriceDetailed(token);

    if (!result.ok) {
      switch (result.errorType) {
        case 'invalid_token':
          throw new NotFoundError(result.message);
        case 'bad_request':
          throw new BadRequestError(result.message);
        default:
          throw new InternalServerError(result.message);
      }
    }

    reply.send({ token, price: result.data.usd });
  });
}