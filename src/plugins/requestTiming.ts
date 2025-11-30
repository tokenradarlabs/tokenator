import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import logger from '../utils/logger';
import { recordLatency } from '../utils/telemetry';

declare module 'fastify' {
  interface FastifyRequest {
    requestStartTime: number;
  }
}

const requestTimingPlugin: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (request, reply) => {
    request.requestStartTime = Date.now();
  });

  app.addHook('onResponse', async (request, reply) => {
    const responseTime = Date.now() - request.requestStartTime;
    logger.info(`Request ${request.method}:${request.url} completed in ${responseTime}ms`);
    recordLatency(`${request.method}:${request.url}`, responseTime);
  });
};

export const requestTiming = fp(requestTimingPlugin, { name: 'requestTiming' });
