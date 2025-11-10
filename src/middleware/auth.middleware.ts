import { Request, Response, NextFunction } from 'express';
import { apiKeyService, ValidatedApiKey } from '@services/api-key.service';
import { UnauthorizedError, ForbiddenError } from '@utils/errors';

/**
 * Extend Express Request to include authentication data
 */
declare global {
  namespace Express {
    interface Request {
      auth?: ValidatedApiKey;
      organizationId?: string;
    }
  }
}

/**
 * Authentication Middleware
 *
 * Validates API key from Authorization header
 * Adds auth data to request object
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get API key from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedError('Missing Authorization header');
    }

    // Check Bearer token format
    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Invalid Authorization header format. Expected: Bearer <api_key>');
    }

    // Extract API key
    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!apiKey) {
      throw new UnauthorizedError('Missing API key');
    }

    // Validate API key
    const validatedKey = await apiKeyService.validateApiKey(apiKey);

    // Attach auth data to request
    req.auth = validatedKey;
    req.organizationId = validatedKey.organizationId;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Scope-based authorization middleware factory
 *
 * @param requiredScope - Scope required to access the route (e.g., 'invoices:write')
 * @returns Middleware function
 */
export function requireScope(requiredScope: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      // Check if authenticated
      if (!req.auth) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check if has required scope
      if (!apiKeyService.hasScope(req.auth, requiredScope)) {
        throw new ForbiddenError(`Missing required scope: ${requiredScope}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Organization ownership middleware
 *
 * Ensures the authenticated organization matches the resource organization ID
 * Expects req.params.id or req.params.organizationId
 */
export function requireOrganizationOwnership(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    // Check if authenticated
    if (!req.auth || !req.organizationId) {
      throw new UnauthorizedError('Authentication required');
    }

    // Get organization ID from params
    const resourceOrgId = req.params.organizationId || req.params.id;

    if (!resourceOrgId) {
      throw new ForbiddenError('Organization ID not found in request');
    }

    // Check if matches authenticated organization
    if (req.organizationId !== resourceOrgId) {
      throw new ForbiddenError('Access denied: You can only access your own organization resources');
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication middleware
 *
 * Attempts to authenticate but doesn't fail if no credentials provided
 * Useful for endpoints that work both authenticated and unauthenticated
 */
export async function optionalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No auth provided, continue without authentication
      return next();
    }

    const apiKey = authHeader.substring(7);

    if (apiKey) {
      try {
        const validatedKey = await apiKeyService.validateApiKey(apiKey);
        req.auth = validatedKey;
        req.organizationId = validatedKey.organizationId;
      } catch (error) {
        // Invalid key, but continue anyway (optional auth)
        // Don't attach auth data
      }
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Admin-only middleware
 *
 * Requires admin:* or * scope
 */
export const requireAdmin = requireScope('admin:*');

/**
 * Common scope requirements
 */
export const requireInvoicesRead = requireScope('invoices:read');
export const requireInvoicesWrite = requireScope('invoices:write');
export const requirePartnersRead = requireScope('partners:read');
export const requirePartnersWrite = requireScope('partners:write');
