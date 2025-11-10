import { Request, Response, NextFunction } from 'express';
import { apiKeyService } from '@services/api-key.service';
import {
  createApiKeySchema,
  updateApiKeySchema,
  listApiKeysQuerySchema,
} from '@validators/api-key.validator';
import { successResponse, errorResponse } from '@utils/response';
import { ForbiddenError } from '@utils/errors';
import { z } from 'zod';

/**
 * API Key Controller
 *
 * Handles HTTP requests for API key management
 * All endpoints require authentication
 */

export class ApiKeyController {
  /**
   * Create a new API key
   * POST /api/v1/api-keys
   */
  async createApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      // Validate request body
      const validatedData = createApiKeySchema.parse(req.body);

      // Create API key for authenticated organization
      const { apiKey, record } = await apiKeyService.createApiKey({
        organizationId: req.organizationId,
        ...validatedData,
      });

      // Return the plain API key (only time it's shown!)
      successResponse(
        res,
        {
          apiKey, // Plain key - user must save this!
          keyId: record.id,
          keyPrefix: record.keyPrefix,
          name: record.name,
          scopes: record.scopes,
          rateLimitPerMinute: record.rateLimitPerMinute,
          rateLimitPerDay: record.rateLimitPerDay,
          expiresAt: record.expiresAt,
          createdAt: record.createdAt,
          warning: 'This is the only time the API key will be shown. Please save it securely.',
        },
        201
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        errorResponse(res, 'VALIDATION_ERROR', 'Invalid request data', 400, error.errors);
        return;
      }
      next(error);
    }
  }

  /**
   * List API keys for authenticated organization
   * GET /api/v1/api-keys
   */
  async listApiKeys(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      // Validate query parameters
      const { includeRevoked } = listApiKeysQuerySchema.parse(req.query);

      // List API keys for authenticated organization
      const apiKeys = await apiKeyService.listApiKeys(req.organizationId, includeRevoked);

      // Return API keys (without hashes)
      successResponse(res, {
        apiKeys: apiKeys.map((key) => ({
          id: key.id,
          keyPrefix: key.keyPrefix,
          name: key.name,
          scopes: key.scopes,
          rateLimitPerMinute: key.rateLimitPerMinute,
          rateLimitPerDay: key.rateLimitPerDay,
          isActive: key.isActive,
          lastUsedAt: key.lastUsedAt,
          expiresAt: key.expiresAt,
          revokedAt: key.revokedAt,
          revokedBy: key.revokedBy,
          createdAt: key.createdAt,
        })),
        total: apiKeys.length,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400, error.errors);
        return;
      }
      next(error);
    }
  }

  /**
   * Get API key by ID
   * GET /api/v1/api-keys/:id
   */
  async getApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) {
        errorResponse(res, 'VALIDATION_ERROR', 'API key ID is required', 400);
        return;
      }

      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      // Get API key
      const apiKey = await apiKeyService.getApiKeyById(id);

      // Ensure API key belongs to authenticated organization
      if (apiKey.organizationId !== req.organizationId) {
        throw new ForbiddenError('You can only access your own API keys');
      }

      // Return API key details (without hash)
      successResponse(res, {
        apiKey: {
          id: apiKey.id,
          keyPrefix: apiKey.keyPrefix,
          name: apiKey.name,
          scopes: apiKey.scopes,
          rateLimitPerMinute: apiKey.rateLimitPerMinute,
          rateLimitPerDay: apiKey.rateLimitPerDay,
          isActive: apiKey.isActive,
          lastUsedAt: apiKey.lastUsedAt,
          expiresAt: apiKey.expiresAt,
          revokedAt: apiKey.revokedAt,
          revokedBy: apiKey.revokedBy,
          createdAt: apiKey.createdAt,
          createdBy: apiKey.createdBy,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update API key
   * PATCH /api/v1/api-keys/:id
   */
  async updateApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) {
        errorResponse(res, 'VALIDATION_ERROR', 'API key ID is required', 400);
        return;
      }

      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      // Validate request body
      const validatedData = updateApiKeySchema.parse(req.body);

      // Get API key to verify ownership
      const existingKey = await apiKeyService.getApiKeyById(id);

      // Ensure API key belongs to authenticated organization
      if (existingKey.organizationId !== req.organizationId) {
        throw new ForbiddenError('You can only update your own API keys');
      }

      // Update API key
      const apiKey = await apiKeyService.updateApiKey(id, validatedData);

      successResponse(res, {
        apiKey: {
          id: apiKey.id,
          keyPrefix: apiKey.keyPrefix,
          name: apiKey.name,
          scopes: apiKey.scopes,
          rateLimitPerMinute: apiKey.rateLimitPerMinute,
          rateLimitPerDay: apiKey.rateLimitPerDay,
          expiresAt: apiKey.expiresAt,
        },
        message: 'API key updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        errorResponse(res, 'VALIDATION_ERROR', 'Invalid request data', 400, error.errors);
        return;
      }
      next(error);
    }
  }

  /**
   * Revoke API key
   * DELETE /api/v1/api-keys/:id
   */
  async revokeApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) {
        errorResponse(res, 'VALIDATION_ERROR', 'API key ID is required', 400);
        return;
      }

      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      // Get API key to verify ownership
      const existingKey = await apiKeyService.getApiKeyById(id);

      // Ensure API key belongs to authenticated organization
      if (existingKey.organizationId !== req.organizationId) {
        throw new ForbiddenError('You can only revoke your own API keys');
      }

      // Revoke API key
      await apiKeyService.revokeApiKey(id, req.auth?.id);

      successResponse(res, {
        message: 'API key revoked successfully',
        revokedAt: new Date(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get API key statistics
   * GET /api/v1/api-keys/stats
   */
  async getApiKeyStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      // Get stats
      const stats = await apiKeyService.getApiKeyStats(req.organizationId);

      successResponse(res, { stats });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const apiKeyController = new ApiKeyController();
