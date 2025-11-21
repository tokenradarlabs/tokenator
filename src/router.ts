import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyInstance {
    // You can add custom properties or methods to the Fastify instance here
  }
}

const routerPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // This is where routes will be registered
  // For now, it's empty, but controllers will add routes here
};

export const router = fp(routerPlugin, {
  name: 'router',
  dependencies: [], // Add any dependencies here if needed
});
