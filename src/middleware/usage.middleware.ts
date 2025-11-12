import { Request, Response, NextFunction } from 'express';
import { usageService } from '@services/usage.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Usage Tracking Middleware
 *
 * Automatically logs API usage for analytics and billing
 */

// Extend Express Request to include usage tracking
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

/**
 * Middleware to track API usage
 */
export function usageTrackingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip tracking for health checks and internal endpoints
  if (req.path === '/health' || req.path === '/metrics' || req.path.startsWith('/_')) {
    return next();
  }

  // Generate request ID
  req.requestId = uuidv4();
  req.startTime = Date.now();

  // Get request size
  const requestSize = req.get('content-length') ? parseInt(req.get('content-length')!, 10) : 0;

  // Capture response on finish
  const originalSend = res.send;
  let responseSize = 0;

  res.send = function (data: any): Response {
    // Calculate response size
    if (data) {
      responseSize = Buffer.byteLength(JSON.stringify(data));
    }

    return originalSend.call(this, data);
  };

  // Log usage when response is finished
  res.on('finish', async () => {
    try {
      // Only log if we have an organization ID (authenticated requests)
      if (!req.organizationId) {
        return;
      }

      const responseTimeMs = Date.now() - (req.startTime || Date.now());

      // Determine resource type and ID from path
      const pathParts = req.path.split('/').filter(Boolean);
      let resourceType: string | undefined;
      let resourceId: string | undefined;

      // Extract resource type from path (e.g., /api/v1/invoices/:id)
      if (pathParts.length >= 3) {
        resourceType = pathParts[2]; // e.g., 'invoices', 'partners'
        if (pathParts.length >= 4 && pathParts[3]!.match(/^[0-9a-f-]{36}$/i)) {
          resourceId = pathParts[3]; // UUID
        }
      }

      // Determine operation cost (for billing)
      let operationCost = 0;
      if (resourceType === 'invoices' && req.method === 'POST') {
        operationCost = 1; // Creating invoice costs 1 credit
      }

      // Determine error info
      let errorCode: string | undefined;
      let errorMessage: string | undefined;
      if (res.statusCode >= 400) {
        errorCode = `HTTP_${res.statusCode}`;
        // Error message would be in response body, but we don't want to parse it here
      }

      // Log usage asynchronously (don't block response)
      await usageService.logUsage({
        organizationId: req.organizationId,
        apiKeyId: req.auth?.id,
        endpoint: req.path,
        httpMethod: req.method,
        httpStatus: res.statusCode,
        requestTimestamp: new Date(req.startTime || Date.now()),
        responseTimeMs,
        requestSizeBytes: requestSize,
        responseSizeBytes: responseSize,
        clientIp: req.ip,
        userAgent: req.get('user-agent'),
        resourceType,
        resourceId,
        operationCost,
        errorCode,
        errorMessage,
        requestId: req.requestId,
      });
    } catch (error) {
      // Silently fail - usage tracking shouldn't break the API
      console.error('Failed to log usage:', error);
    }
  });

  next();
}
