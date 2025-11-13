import { Request, Response, NextFunction } from 'express';
import mongoSanitize from 'express-mongo-sanitize';

/**
 * Sanitization Middleware
 *
 * Sanitizes user input to prevent injection attacks
 */

/**
 * Sanitize strings to remove potentially dangerous HTML/script tags
 */
function sanitizeString(value: any): any {
  if (typeof value === 'string') {
    // Remove null bytes
    value = value.replace(/\0/g, '');

    // Basic XSS protection - strip script tags and event handlers
    value = value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript:/gi, '');

    return value.trim();
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeString);
  }

  if (value && typeof value === 'object') {
    const sanitized: any = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        sanitized[key] = sanitizeString(value[key]);
      }
    }
    return sanitized;
  }

  return value;
}

/**
 * Request sanitization middleware
 *
 * Sanitizes req.body, req.query, and req.params
 */
export function sanitizeMiddleware(req: Request, _res: Response, next: NextFunction): void {
  try {
    // Sanitize MongoDB query operators (prevent NoSQL injection)
    mongoSanitize.sanitize(req.body, { replaceWith: '_' });
    mongoSanitize.sanitize(req.query, { replaceWith: '_' });
    mongoSanitize.sanitize(req.params, { replaceWith: '_' });

    // Sanitize strings (XSS protection)
    if (req.body) {
      req.body = sanitizeString(req.body);
    }
    if (req.query) {
      req.query = sanitizeString(req.query);
    }
    if (req.params) {
      req.params = sanitizeString(req.params);
    }

    next();
  } catch (error) {
    // If sanitization fails, pass error to error handler
    next(error);
  }
}

/**
 * Strict sanitization for sensitive fields
 *
 * Use this for fields that should only contain alphanumeric characters
 */
export function strictSanitize(value: string): string {
  // Only allow alphanumeric, spaces, and common punctuation
  return value.replace(/[^a-zA-Z0-9\s\-_.,@]/g, '');
}

/**
 * Email sanitization
 */
export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * URL sanitization
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}
