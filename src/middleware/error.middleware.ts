import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { errorResponse } from '../utils/response';
import { logger } from '../config/logger';
import { Prisma } from '@prisma/client';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  logger.error(
    {
      err,
      method: req.method,
      url: req.url,
      body: req.body,
    },
    'Error occurred'
  );

  // Handle known application errors
  if (err instanceof AppError) {
    return errorResponse(res, err.code, err.message, err.statusCode, err.details);
  }

  // Handle Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation
    if (err.code === 'P2002') {
      const field = (err.meta?.target as string[])?.join(', ') || 'field';
      return errorResponse(
        res,
        'CONFLICT',
        `A record with this ${field} already exists`,
        409,
        { field }
      );
    }

    // Record not found
    if (err.code === 'P2025') {
      return errorResponse(res, 'NOT_FOUND', 'Record not found', 404);
    }

    // Foreign key constraint failed
    if (err.code === 'P2003') {
      return errorResponse(res, 'BAD_REQUEST', 'Referenced record does not exist', 400);
    }
  }

  // Handle validation errors from Prisma
  if (err instanceof Prisma.PrismaClientValidationError) {
    return errorResponse(res, 'VALIDATION_ERROR', 'Invalid data provided', 400);
  }

  // Handle unknown errors
  return errorResponse(
    res,
    'INTERNAL_ERROR',
    process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
    500
  );
}

// 404 handler
export function notFoundHandler(req: Request, res: Response) {
  return errorResponse(res, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`, 404);
}
