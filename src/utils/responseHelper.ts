
import { FastifyReply } from 'fastify';

interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  error?: {
    message: string;
    details?: any;
  };
}

export function sendSuccess<T>(reply: FastifyReply, data: T, statusCode: number = 200) {
  reply.status(statusCode).send({
    status: 'success',
    data,
  } as ApiResponse<T>);
}

export function sendError(reply: FastifyReply, message: string, statusCode: number = 500, details?: any) {
  reply.status(statusCode).send({
    status: 'error',
    error: {
      message,
      details,
    },
  } as ApiResponse<any>);
}
