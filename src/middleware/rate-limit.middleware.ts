import rateLimit from 'express-rate-limit';

/**
 * Rate Limiting Middleware
 *
 * Provides different rate limiters for various endpoints
 */

/**
 * Standard API rate limiter
 * Applied to most authenticated endpoints
 */
export const standardRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute default
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60', 10), // 60 requests per minute default
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Use IP address as the key
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
});

/**
 * Strict rate limiter for signup endpoint
 * Prevents signup abuse and bot registrations
 */
export const signupRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 signup attempts per 15 minutes from same IP
  message: {
    error: 'SIGNUP_RATE_LIMIT_EXCEEDED',
    message: 'Too many signup attempts from this IP. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count successful signups too
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
});

/**
 * Strict rate limiter for authentication endpoints
 * Prevents brute force attacks
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 login attempts per 15 minutes
  message: {
    error: 'AUTH_RATE_LIMIT_EXCEEDED',
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
});

/**
 * Strict rate limiter for payment/billing endpoints
 * Prevents payment spam and abuse
 */
export const billingRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Max 10 billing requests per minute
  message: {
    error: 'BILLING_RATE_LIMIT_EXCEEDED',
    message: 'Too many billing requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
});

/**
 * Lenient rate limiter for public endpoints
 * Used for endpoints that don't require strict limits
 */
export const publicRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
});
