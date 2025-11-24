import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { priceAlertController } from './controllers/alerts/priceAlertController';

declare module 'fastify' {
  interface FastifyInstance {
    // You can add custom properties or methods to the Fastify instance here
  }
}

const routerPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.register(priceAlertController);
};

export const router = fp(routerPlugin, {
  name: 'router',
  dependencies: [], // Add any dependencies here if needed
});
