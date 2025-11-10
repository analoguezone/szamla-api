import { db } from '@config/database';
import { encryptionService } from './encryption.service';
import { ValidationError, UnauthorizedError, NotFoundError } from '@utils/errors';
import { ApiKey } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * API Key Service
 *
 * Handles API key management:
 * - Generation and hashing
 * - Validation and authentication
 * - Scope-based permissions
 * - Rate limiting tracking
 * - Lifecycle management (revoke, expire)
 */

export interface CreateApiKeyInput {
  organizationId: string;
  name?: string;
  scopes?: string[];
  rateLimitPerMinute?: number;
  rateLimitPerDay?: number;
  expiresAt?: Date;
  createdBy?: string;
  isTest?: boolean;
}

export interface ValidatedApiKey {
  id: string;
  organizationId: string;
  scopes: string[];
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
}

export class ApiKeyService {
  /**
   * Generate a new API key
   * Returns the plain API key (only shown once!) and the stored record
   */
  async createApiKey(input: CreateApiKeyInput): Promise<{ apiKey: string; record: ApiKey }> {
    // Generate random API key
    const plainKey = encryptionService.generateAPIKey(input.isTest ?? false);

    // Extract prefix (e.g., "sk_live" or "sk_test")
    const keyPrefix = plainKey.split('_').slice(0, 2).join('_');

    // Hash the API key using bcrypt
    const keyHash = await bcrypt.hash(plainKey, 10);

    // Create API key record
    const record = await db.apiKey.create({
      data: {
        organizationId: input.organizationId,
        keyPrefix,
        keyHash,
        name: input.name,
        scopes: input.scopes ?? ['invoices:read', 'invoices:write'],
        rateLimitPerMinute: input.rateLimitPerMinute ?? 60,
        rateLimitPerDay: input.rateLimitPerDay ?? 10000,
        expiresAt: input.expiresAt,
        createdBy: input.createdBy,
        isActive: true,
      },
    });

    return {
      apiKey: plainKey,
      record,
    };
  }

  /**
   * Validate an API key and return organization info
   * This is used by the authentication middleware
   */
  async validateApiKey(plainKey: string): Promise<ValidatedApiKey> {
    if (!plainKey || !plainKey.startsWith('sk_')) {
      throw new UnauthorizedError('Invalid API key format');
    }

    // Extract prefix
    const keyPrefix = plainKey.split('_').slice(0, 2).join('_');

    // Find API keys with matching prefix (performance optimization)
    const apiKeys = await db.apiKey.findMany({
      where: {
        keyPrefix,
        isActive: true,
        revokedAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        organization: {
          select: {
            id: true,
            status: true,
            billingStatus: true,
          },
        },
      },
    });

    // Check each key with matching prefix using bcrypt
    for (const apiKey of apiKeys) {
      const isValid = await bcrypt.compare(plainKey, apiKey.keyHash);

      if (isValid) {
        // Check organization status
        if (apiKey.organization.status !== 'active') {
          throw new UnauthorizedError('Organization is not active');
        }

        if (apiKey.organization.billingStatus === 'suspended') {
          throw new UnauthorizedError('Organization billing is suspended');
        }

        // Update last used timestamp (async, don't wait)
        this.updateLastUsed(apiKey.id).catch(() => {
          // Silently fail - last used is not critical
        });

        return {
          id: apiKey.id,
          organizationId: apiKey.organizationId,
          scopes: apiKey.scopes,
          rateLimitPerMinute: apiKey.rateLimitPerMinute,
          rateLimitPerDay: apiKey.rateLimitPerDay,
        };
      }
    }

    throw new UnauthorizedError('Invalid API key');
  }

  /**
   * Check if API key has required scope
   */
  hasScope(apiKey: ValidatedApiKey, requiredScope: string): boolean {
    // Check for wildcard scope
    if (apiKey.scopes.includes('*') || apiKey.scopes.includes('admin:*')) {
      return true;
    }

    // Check for exact match
    if (apiKey.scopes.includes(requiredScope)) {
      return true;
    }

    // Check for wildcard in scope (e.g., "invoices:*" matches "invoices:read")
    const scopePrefix = requiredScope.split(':')[0];
    if (apiKey.scopes.includes(`${scopePrefix}:*`)) {
      return true;
    }

    return false;
  }

  /**
   * Update last used timestamp
   */
  private async updateLastUsed(apiKeyId: string): Promise<void> {
    await db.apiKey.update({
      where: { id: apiKeyId },
      data: { lastUsedAt: new Date() },
    });
  }

  /**
   * Get API key by ID (without hash)
   */
  async getApiKeyById(id: string): Promise<ApiKey> {
    const apiKey = await db.apiKey.findUnique({
      where: { id },
    });

    if (!apiKey) {
      throw new NotFoundError('API key', id);
    }

    return apiKey;
  }

  /**
   * List API keys for an organization
   */
  async listApiKeys(organizationId: string, includeRevoked: boolean = false): Promise<ApiKey[]> {
    return db.apiKey.findMany({
      where: {
        organizationId,
        ...(includeRevoked ? {} : { revokedAt: null }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(id: string, revokedBy?: string): Promise<ApiKey> {
    const apiKey = await this.getApiKeyById(id);

    if (apiKey.revokedAt) {
      throw new ValidationError('API key is already revoked');
    }

    return db.apiKey.update({
      where: { id },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedBy,
      },
    });
  }

  /**
   * Update API key details (name, scopes, rate limits)
   */
  async updateApiKey(
    id: string,
    updates: {
      name?: string;
      scopes?: string[];
      rateLimitPerMinute?: number;
      rateLimitPerDay?: number;
      expiresAt?: Date | null;
    }
  ): Promise<ApiKey> {
    await this.getApiKeyById(id);

    return db.apiKey.update({
      where: { id },
      data: updates,
    });
  }

  /**
   * Delete API key (hard delete)
   * Use this carefully - prefer revoke for audit trail
   */
  async deleteApiKey(id: string): Promise<void> {
    await this.getApiKeyById(id);

    await db.apiKey.delete({
      where: { id },
    });
  }

  /**
   * Count active API keys for an organization
   */
  async countActiveApiKeys(organizationId: string): Promise<number> {
    return db.apiKey.count({
      where: {
        organizationId,
        isActive: true,
        revokedAt: null,
      },
    });
  }

  /**
   * Check if API key is expired
   */
  isExpired(apiKey: ApiKey): boolean {
    if (!apiKey.expiresAt) {
      return false;
    }
    return apiKey.expiresAt < new Date();
  }

  /**
   * Check if API key is revoked
   */
  isRevoked(apiKey: ApiKey): boolean {
    return apiKey.revokedAt !== null;
  }

  /**
   * Check if API key is usable (active, not expired, not revoked)
   */
  isUsable(apiKey: ApiKey): boolean {
    return apiKey.isActive && !this.isExpired(apiKey) && !this.isRevoked(apiKey);
  }

  /**
   * Get API key statistics for an organization
   */
  async getApiKeyStats(organizationId: string): Promise<{
    total: number;
    active: number;
    revoked: number;
    expired: number;
  }> {
    const apiKeys = await db.apiKey.findMany({
      where: { organizationId },
    });

    const now = new Date();

    return {
      total: apiKeys.length,
      active: apiKeys.filter(k => k.isActive && !k.revokedAt && (!k.expiresAt || k.expiresAt > now)).length,
      revoked: apiKeys.filter(k => k.revokedAt !== null).length,
      expired: apiKeys.filter(k => k.expiresAt && k.expiresAt < now && !k.revokedAt).length,
    };
  }
}

// Export singleton instance
export const apiKeyService = new ApiKeyService();
