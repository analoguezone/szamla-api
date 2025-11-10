import { Response } from 'express';

interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    request_id?: string;
    timestamp: string;
    [key: string]: unknown;
  };
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    request_id?: string;
    timestamp: string;
  };
}

export function successResponse<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  meta?: Record<string, unknown>
): Response<SuccessResponse<T>> {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: {
      ...meta,
      timestamp: new Date().toISOString(),
    },
  });
}

export function errorResponse(
  res: Response,
  code: string,
  message: string,
  statusCode: number = 500,
  details?: unknown,
  requestId?: string
): Response<ErrorResponse> {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      request_id: requestId,
      timestamp: new Date().toISOString(),
    },
  });
}
