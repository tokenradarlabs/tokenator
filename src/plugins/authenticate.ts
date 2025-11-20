import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config'; // Assuming named export

declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: string };
  }
}

export const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Unauthorized: No token provided.' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as { id: string };
    request.user = { id: decoded.id };
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized: Invalid token.' });
  }
};
