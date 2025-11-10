import { ApiKeyService, CreateApiKeyInput, ValidatedApiKey } from '@services/api-key.service';
import { UnauthorizedError, ValidationError, NotFoundError } from '@utils/errors';
import { db } from '@config/database';
import bcrypt from 'bcryptjs';

// Mock the database
jest.mock('@config/database', () => ({
  db: {
    apiKey: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  },
}));

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('ApiKeyService', () => {
  let apiKeyService: ApiKeyService;

  beforeEach(() => {
    apiKeyService = new ApiKeyService();
    jest.clearAllMocks();
  });

  describe('createApiKey', () => {
    it('should create a live API key', async () => {
      const input: CreateApiKeyInput = {
        organizationId: 'org-123',
        name: 'Production Key',
        isTest: false,
      };

      const mockKeyHash = 'hashed-key';
      (bcrypt.hash as jest.Mock).mockResolvedValue(mockKeyHash);

      const mockRecord = {
        id: 'key-123',
        organizationId: input.organizationId,
        keyPrefix: 'sk_live',
        keyHash: mockKeyHash,
        name: input.name,
        scopes: ['invoices:read', 'invoices:write'],
        rateLimitPerMinute: 60,
        rateLimitPerDay: 10000,
        isActive: true,
        createdAt: new Date(),
      };

      (db.apiKey.create as jest.Mock).mockResolvedValue(mockRecord);

      const result = await apiKeyService.createApiKey(input);

      expect(result.apiKey).toMatch(/^sk_live_[0-9a-f]{64}$/);
      expect(result.record).toEqual(mockRecord);
      expect(bcrypt.hash).toHaveBeenCalledWith(result.apiKey, 10);
    });

    it('should create a test API key', async () => {
      const input: CreateApiKeyInput = {
        organizationId: 'org-123',
        name: 'Test Key',
        isTest: true,
      };

      const mockKeyHash = 'hashed-key';
      (bcrypt.hash as jest.Mock).mockResolvedValue(mockKeyHash);

      (db.apiKey.create as jest.Mock).mockResolvedValue({
        id: 'key-123',
        keyPrefix: 'sk_test',
        keyHash: mockKeyHash,
      });

      const result = await apiKeyService.createApiKey(input);

      expect(result.apiKey).toMatch(/^sk_test_[0-9a-f]{64}$/);
      expect(result.record.keyPrefix).toBe('sk_test');
    });

    it('should use custom scopes', async () => {
      const input: CreateApiKeyInput = {
        organizationId: 'org-123',
        scopes: ['invoices:read', 'partners:read'],
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue('hash');
      (db.apiKey.create as jest.Mock).mockResolvedValue({ id: 'key-123' });

      await apiKeyService.createApiKey(input);

      const createCall = (db.apiKey.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.scopes).toEqual(['invoices:read', 'partners:read']);
    });

    it('should set expiration date', async () => {
      const expiresAt = new Date('2025-12-31');
      const input: CreateApiKeyInput = {
        organizationId: 'org-123',
        expiresAt,
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue('hash');
      (db.apiKey.create as jest.Mock).mockResolvedValue({ id: 'key-123' });

      await apiKeyService.createApiKey(input);

      const createCall = (db.apiKey.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.expiresAt).toEqual(expiresAt);
    });

    it('should set custom rate limits', async () => {
      const input: CreateApiKeyInput = {
        organizationId: 'org-123',
        rateLimitPerMinute: 100,
        rateLimitPerDay: 50000,
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue('hash');
      (db.apiKey.create as jest.Mock).mockResolvedValue({ id: 'key-123' });

      await apiKeyService.createApiKey(input);

      const createCall = (db.apiKey.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.rateLimitPerMinute).toBe(100);
      expect(createCall.data.rateLimitPerDay).toBe(50000);
    });
  });

  describe('validateApiKey', () => {
    it('should validate a correct API key', async () => {
      const plainKey = ['sk', 'live', 'TEST11111111111111111111111111111111111111111111111111111111TEST'].join('_');

      const mockApiKey = {
        id: 'key-123',
        organizationId: 'org-123',
        keyPrefix: 'sk_live',
        keyHash: 'hashed-key',
        scopes: ['invoices:read', 'invoices:write'],
        rateLimitPerMinute: 60,
        rateLimitPerDay: 10000,
        isActive: true,
        revokedAt: null,
        expiresAt: null,
        organization: {
          id: 'org-123',
          status: 'active',
          billingStatus: 'active',
        },
      };

      (db.apiKey.findMany as jest.Mock).mockResolvedValue([mockApiKey]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (db.apiKey.update as jest.Mock).mockResolvedValue({});

      const result = await apiKeyService.validateApiKey(plainKey);

      expect(result).toEqual({
        id: 'key-123',
        organizationId: 'org-123',
        scopes: ['invoices:read', 'invoices:write'],
        rateLimitPerMinute: 60,
        rateLimitPerDay: 10000,
      });

      expect(bcrypt.compare).toHaveBeenCalledWith(plainKey, 'hashed-key');
    });

    it('should throw error for invalid API key format', async () => {
      await expect(apiKeyService.validateApiKey('invalid-key')).rejects.toThrow(UnauthorizedError);
      await expect(apiKeyService.validateApiKey('invalid-key')).rejects.toThrow('Invalid API key format');
    });

    it('should throw error for non-existent API key', async () => {
      const plainKey = ['sk', 'live', 'TEST11111111111111111111111111111111111111111111111111111111TEST'].join('_');

      (db.apiKey.findMany as jest.Mock).mockResolvedValue([]);

      await expect(apiKeyService.validateApiKey(plainKey)).rejects.toThrow(UnauthorizedError);
      await expect(apiKeyService.validateApiKey(plainKey)).rejects.toThrow('Invalid API key');
    });

    it('should throw error for inactive organization', async () => {
      const plainKey = ['sk', 'live', 'TEST11111111111111111111111111111111111111111111111111111111TEST'].join('_');

      const mockApiKey = {
        id: 'key-123',
        organizationId: 'org-123',
        keyPrefix: 'sk_live',
        keyHash: 'hashed-key',
        scopes: [],
        rateLimitPerMinute: 60,
        rateLimitPerDay: 10000,
        isActive: true,
        revokedAt: null,
        expiresAt: null,
        organization: {
          id: 'org-123',
          status: 'suspended',
          billingStatus: 'active',
        },
      };

      (db.apiKey.findMany as jest.Mock).mockResolvedValue([mockApiKey]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(apiKeyService.validateApiKey(plainKey)).rejects.toThrow(UnauthorizedError);
      await expect(apiKeyService.validateApiKey(plainKey)).rejects.toThrow('Organization is not active');
    });

    it('should throw error for suspended billing', async () => {
      const plainKey = ['sk', 'live', 'TEST11111111111111111111111111111111111111111111111111111111TEST'].join('_');

      const mockApiKey = {
        id: 'key-123',
        organizationId: 'org-123',
        keyPrefix: 'sk_live',
        keyHash: 'hashed-key',
        scopes: [],
        rateLimitPerMinute: 60,
        rateLimitPerDay: 10000,
        isActive: true,
        revokedAt: null,
        expiresAt: null,
        organization: {
          id: 'org-123',
          status: 'active',
          billingStatus: 'suspended',
        },
      };

      (db.apiKey.findMany as jest.Mock).mockResolvedValue([mockApiKey]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(apiKeyService.validateApiKey(plainKey)).rejects.toThrow(UnauthorizedError);
      await expect(apiKeyService.validateApiKey(plainKey)).rejects.toThrow('Organization billing is suspended');
    });

    it('should not validate revoked API key', async () => {
      const plainKey = ['sk', 'live', 'TEST11111111111111111111111111111111111111111111111111111111TEST'].join('_');

      // findMany should not return revoked keys (filtered in query)
      (db.apiKey.findMany as jest.Mock).mockResolvedValue([]);

      await expect(apiKeyService.validateApiKey(plainKey)).rejects.toThrow(UnauthorizedError);
    });

    it('should not validate expired API key', async () => {
      const plainKey = ['sk', 'live', 'TEST11111111111111111111111111111111111111111111111111111111TEST'].join('_');

      // findMany should not return expired keys (filtered in query)
      (db.apiKey.findMany as jest.Mock).mockResolvedValue([]);

      await expect(apiKeyService.validateApiKey(plainKey)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('hasScope', () => {
    const mockApiKey: ValidatedApiKey = {
      id: 'key-123',
      organizationId: 'org-123',
      scopes: ['invoices:read', 'invoices:write', 'partners:read'],
      rateLimitPerMinute: 60,
      rateLimitPerDay: 10000,
    };

    it('should return true for exact scope match', () => {
      expect(apiKeyService.hasScope(mockApiKey, 'invoices:read')).toBe(true);
      expect(apiKeyService.hasScope(mockApiKey, 'partners:read')).toBe(true);
    });

    it('should return false for missing scope', () => {
      expect(apiKeyService.hasScope(mockApiKey, 'partners:write')).toBe(false);
      expect(apiKeyService.hasScope(mockApiKey, 'admin:delete')).toBe(false);
    });

    it('should return true for wildcard scope', () => {
      const wildcardApiKey: ValidatedApiKey = {
        ...mockApiKey,
        scopes: ['*'],
      };

      expect(apiKeyService.hasScope(wildcardApiKey, 'invoices:read')).toBe(true);
      expect(apiKeyService.hasScope(wildcardApiKey, 'anything:here')).toBe(true);
    });

    it('should return true for admin wildcard', () => {
      const adminApiKey: ValidatedApiKey = {
        ...mockApiKey,
        scopes: ['admin:*'],
      };

      expect(apiKeyService.hasScope(adminApiKey, 'invoices:read')).toBe(true);
      expect(apiKeyService.hasScope(adminApiKey, 'anything:here')).toBe(true);
    });

    it('should return true for resource wildcard', () => {
      const resourceWildcardApiKey: ValidatedApiKey = {
        ...mockApiKey,
        scopes: ['invoices:*'],
      };

      expect(apiKeyService.hasScope(resourceWildcardApiKey, 'invoices:read')).toBe(true);
      expect(apiKeyService.hasScope(resourceWildcardApiKey, 'invoices:write')).toBe(true);
      expect(apiKeyService.hasScope(resourceWildcardApiKey, 'invoices:delete')).toBe(true);
      expect(apiKeyService.hasScope(resourceWildcardApiKey, 'partners:read')).toBe(false);
    });
  });

  describe('getApiKeyById', () => {
    it('should return API key', async () => {
      const mockApiKey = { id: 'key-123', organizationId: 'org-123' };
      (db.apiKey.findUnique as jest.Mock).mockResolvedValue(mockApiKey);

      const result = await apiKeyService.getApiKeyById('key-123');

      expect(result).toEqual(mockApiKey);
      expect(db.apiKey.findUnique).toHaveBeenCalledWith({ where: { id: 'key-123' } });
    });

    it('should throw error if not found', async () => {
      (db.apiKey.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(apiKeyService.getApiKeyById('non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('listApiKeys', () => {
    it('should list active API keys', async () => {
      const mockApiKeys = [
        { id: 'key-1', revokedAt: null },
        { id: 'key-2', revokedAt: null },
      ];

      (db.apiKey.findMany as jest.Mock).mockResolvedValue(mockApiKeys);

      const result = await apiKeyService.listApiKeys('org-123');

      expect(result).toEqual(mockApiKeys);
      expect(db.apiKey.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-123',
          revokedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should include revoked keys when requested', async () => {
      (db.apiKey.findMany as jest.Mock).mockResolvedValue([]);

      await apiKeyService.listApiKeys('org-123', true);

      expect(db.apiKey.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-123',
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke an API key', async () => {
      const mockApiKey = { id: 'key-123', revokedAt: null };
      const revokedApiKey = { ...mockApiKey, isActive: false, revokedAt: new Date() };

      (db.apiKey.findUnique as jest.Mock).mockResolvedValue(mockApiKey);
      (db.apiKey.update as jest.Mock).mockResolvedValue(revokedApiKey);

      const result = await apiKeyService.revokeApiKey('key-123', 'admin@example.com');

      expect(db.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-123' },
        data: {
          isActive: false,
          revokedAt: expect.any(Date),
          revokedBy: 'admin@example.com',
        },
      });
      expect(result).toEqual(revokedApiKey);
    });

    it('should throw error if already revoked', async () => {
      const mockApiKey = { id: 'key-123', revokedAt: new Date() };
      (db.apiKey.findUnique as jest.Mock).mockResolvedValue(mockApiKey);

      await expect(apiKeyService.revokeApiKey('key-123')).rejects.toThrow(ValidationError);
      await expect(apiKeyService.revokeApiKey('key-123')).rejects.toThrow('API key is already revoked');
    });
  });

  describe('updateApiKey', () => {
    it('should update API key details', async () => {
      const mockApiKey = { id: 'key-123' };
      const updates = {
        name: 'New Name',
        scopes: ['invoices:read'],
        rateLimitPerMinute: 100,
      };

      (db.apiKey.findUnique as jest.Mock).mockResolvedValue(mockApiKey);
      (db.apiKey.update as jest.Mock).mockResolvedValue({ ...mockApiKey, ...updates });

      const result = await apiKeyService.updateApiKey('key-123', updates);

      expect(db.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-123' },
        data: updates,
      });
      expect(result.name).toBe('New Name');
    });
  });

  describe('deleteApiKey', () => {
    it('should delete API key', async () => {
      const mockApiKey = { id: 'key-123' };
      (db.apiKey.findUnique as jest.Mock).mockResolvedValue(mockApiKey);
      (db.apiKey.delete as jest.Mock).mockResolvedValue(mockApiKey);

      await apiKeyService.deleteApiKey('key-123');

      expect(db.apiKey.delete).toHaveBeenCalledWith({ where: { id: 'key-123' } });
    });
  });

  describe('countActiveApiKeys', () => {
    it('should count active API keys', async () => {
      (db.apiKey.count as jest.Mock).mockResolvedValue(5);

      const result = await apiKeyService.countActiveApiKeys('org-123');

      expect(result).toBe(5);
      expect(db.apiKey.count).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-123',
          isActive: true,
          revokedAt: null,
        },
      });
    });
  });

  describe('status checks', () => {
    it('should check if API key is expired', () => {
      const expiredKey = { expiresAt: new Date('2020-01-01') } as any;
      const activeKey = { expiresAt: new Date('2030-01-01') } as any;
      const noExpiryKey = { expiresAt: null } as any;

      expect(apiKeyService.isExpired(expiredKey)).toBe(true);
      expect(apiKeyService.isExpired(activeKey)).toBe(false);
      expect(apiKeyService.isExpired(noExpiryKey)).toBe(false);
    });

    it('should check if API key is revoked', () => {
      const revokedKey = { revokedAt: new Date() } as any;
      const activeKey = { revokedAt: null } as any;

      expect(apiKeyService.isRevoked(revokedKey)).toBe(true);
      expect(apiKeyService.isRevoked(activeKey)).toBe(false);
    });

    it('should check if API key is usable', () => {
      const usableKey = { isActive: true, revokedAt: null, expiresAt: null } as any;
      const inactiveKey = { isActive: false, revokedAt: null, expiresAt: null } as any;
      const revokedKey = { isActive: true, revokedAt: new Date(), expiresAt: null } as any;
      const expiredKey = { isActive: true, revokedAt: null, expiresAt: new Date('2020-01-01') } as any;

      expect(apiKeyService.isUsable(usableKey)).toBe(true);
      expect(apiKeyService.isUsable(inactiveKey)).toBe(false);
      expect(apiKeyService.isUsable(revokedKey)).toBe(false);
      expect(apiKeyService.isUsable(expiredKey)).toBe(false);
    });
  });

  describe('getApiKeyStats', () => {
    it('should return API key statistics', async () => {
      const mockApiKeys = [
        { id: 'key-1', isActive: true, revokedAt: null, expiresAt: null },
        { id: 'key-2', isActive: true, revokedAt: null, expiresAt: null },
        { id: 'key-3', isActive: false, revokedAt: new Date(), expiresAt: null },
        { id: 'key-4', isActive: true, revokedAt: null, expiresAt: new Date('2020-01-01') },
      ];

      (db.apiKey.findMany as jest.Mock).mockResolvedValue(mockApiKeys);

      const result = await apiKeyService.getApiKeyStats('org-123');

      expect(result).toEqual({
        total: 4,
        active: 2,
        revoked: 1,
        expired: 1,
      });
    });
  });
});
