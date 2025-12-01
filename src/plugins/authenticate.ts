import { FastifyRequest, FastifyReply, HookHandlerDoneFunction, FastifyBaseLogger } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config'; // Assuming named export
import { sendError } from '../utils/responseHelper';
import prisma from '../utils/prisma'; // Import prisma client

declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: string };
  }
}

export const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    request.log.warn('Authentication failed: No Authorization header provided.');
    sendError(reply, 'Unauthorized: No token provided.', 401);
    return;
  }

  if (!authHeader.startsWith('Bearer ')) {
    request.log.warn('Authentication failed: Authorization header does not start with Bearer.');
    sendError(reply, 'Unauthorized: Invalid authentication scheme.', 401);
    return;
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    request.log.warn('Authentication failed: Token is missing after Bearer.');
    sendError(reply, 'Unauthorized: Token missing.', 401);
    return;
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as { id: string };
    request.user = { id: decoded.id };

    // API Key Usage Tracking (non-blocking)
    const trackApiKeyUsage = async (apiKeyId: string, log: FastifyBaseLogger) => {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.apiKey.update({
            where: { id: apiKeyId },
            data: { usageCount: { increment: 1 } },
          });

          await tx.apiKeyUsage.create({
            data: {
              apiKeyId: apiKeyId,
              timestamp: new Date(),
            },
          });
        });
      } catch (dbError: any) {
        log.error(`Failed to track API key usage for key ID ${apiKeyId}: ${dbError.message}`);
      }
    };
    trackApiKeyUsage(decoded.id, request.log);

  } catch (err) {
    request.log.warn(`Authentication failed: Invalid token. Error: ${err.message}`);
    sendError(reply, 'Unauthorized: Invalid token.', 401);
    return;
  }
};

