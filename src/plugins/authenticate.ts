import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config'; // Assuming named export
import { sendError } from '../utils/responseHelper';

declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: string };
  }
}

export const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(reply, 'Unauthorized: No token provided.', 401);
    return;
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as { id: string };
    request.user = { id: decoded.id };
  } catch (err) {
    sendError(reply, 'Unauthorized: Invalid token.', 401);
    return;
  }
};
