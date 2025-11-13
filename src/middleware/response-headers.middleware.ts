import { Request, Response, NextFunction } from 'express';

/**
 * Response Headers Middleware
 *
 * Adds security and tracking headers to all responses
 */

export function responseHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Add request ID to response headers for tracing
  if (req.requestId) {
    res.setHeader('X-Request-ID', req.requestId);
  }

  // Add API version header
  res.setHeader('X-API-Version', 'v1');

  // Prevent caching of API responses (except for static assets)
  if (!req.path.startsWith('/api/docs')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }

  // Rate limit information (if available)
  if (res.locals.rateLimit) {
    res.setHeader('X-RateLimit-Limit', res.locals.rateLimit.limit);
    res.setHeader('X-RateLimit-Remaining', res.locals.rateLimit.remaining);
    res.setHeader('X-RateLimit-Reset', res.locals.rateLimit.reset);
  }

  next();
}
