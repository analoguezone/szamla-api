import { z } from 'zod';

/**
 * API Key Validators
 *
 * Zod schemas for validating API key-related requests
 */

// Available scopes
export const AVAILABLE_SCOPES = [
  'invoices:read',
  'invoices:write',
  'partners:read',
  'partners:write',
  'credits:read',
  'admin:*',
  '*',
] as const;

// Create API Key Schema
export const createApiKeySchema = z.object({
  name: z.string().min(1, 'API key name is required').max(100).optional(),
  scopes: z
    .array(z.string())
    .min(1, 'At least one scope is required')
    .default(['invoices:read', 'invoices:write']),
  rateLimitPerMinute: z.number().int().min(1).max(1000).default(60),
  rateLimitPerDay: z.number().int().min(1).max(100000).default(10000),
  expiresAt: z
    .string()
    .datetime()
    .transform((val) => new Date(val))
    .optional(),
  isTest: z.boolean().default(false),
});

// Update API Key Schema
export const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  scopes: z.array(z.string()).min(1, 'At least one scope is required').optional(),
  rateLimitPerMinute: z.number().int().min(1).max(1000).optional(),
  rateLimitPerDay: z.number().int().min(1).max(100000).optional(),
  expiresAt: z
    .string()
    .datetime()
    .transform((val) => new Date(val))
    .nullable()
    .optional(),
});

// List API Keys Query Schema
export const listApiKeysQuerySchema = z.object({
  includeRevoked: z
    .string()
    .optional()
    .transform((val) => val === 'true')
    .default('false'),
});

// Type exports
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type UpdateApiKeyInput = z.infer<typeof updateApiKeySchema>;
export type ListApiKeysQuery = z.infer<typeof listApiKeysQuerySchema>;
