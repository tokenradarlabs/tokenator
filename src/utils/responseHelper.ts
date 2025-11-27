
import { FastifyReply } from 'fastify';

export interface ApiSuccess<T> {
  status: 'success';
  data: T;
}

export interface ApiError {
  status: 'error';
  error: {
    message: string;
    details?: any;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function sendSuccess<T>(reply: FastifyReply, data: T, statusCode: number = 200) {
  reply.status(statusCode).send({
    status: 'success',
    data,
  } as ApiSuccess<T>);
}

export function sendError(reply: FastifyReply, message: string, statusCode: number = 500, details?: any) {
  reply.status(statusCode).send({
    status: 'error',
    error: {
      message,
      details,
    },
  } as ApiError);
