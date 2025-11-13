import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { ValidationError } from '@utils/errors';

/**
 * Validation Middleware
 *
 * Validates request data against Zod schemas
 */

type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Create validation middleware for a Zod schema
 *
 * @param schema - Zod schema to validate against
 * @param target - Which part of the request to validate (body, query, params)
 * @returns Express middleware function
 */
export function validate(schema: ZodSchema, target: ValidationTarget = 'body') {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req[target];
      const validated = await schema.parseAsync(data);

      // Replace request data with validated data
      req[target] = validated;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format Zod errors for API response
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        next(new ValidationError('Validation failed', errors));
      } else {
        next(error);
      }
    }
  };
}

/**
 * Common validation schemas
 */

// UUID validation
export const uuidSchema = z.string().uuid('Invalid UUID format');

// Pagination schemas
export const paginationSchema = z.object({
  skip: z.coerce.number().int().min(0).optional().default(0),
  take: z.coerce.number().int().min(1).max(100).optional().default(10),
});

// Date range schemas
export const dateRangeSchema = z.object({
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

// Hungarian tax number validation (8 digits)
export const hungarianTaxNumberSchema = z.string().regex(/^\d{8}$/, 'Tax number must be 8 digits');

// Email validation
export const emailSchema = z.string().email('Invalid email format');

// Organization schemas
export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  taxNumber: hungarianTaxNumberSchema,
  address: z.string().min(1).max(500),
  city: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  country: z.string().length(2).default('HU'),
  email: emailSchema,
  phone: z.string().max(50).optional(),
  bankAccountNumber: z.string().max(100).optional(),
});

export const updateOrganizationSchema = createOrganizationSchema.partial();

// Partner schemas
export const createPartnerSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['customer', 'supplier', 'both']),
  taxNumber: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().length(2).default('HU'),
  email: emailSchema.optional(),
  phone: z.string().max(50).optional(),
  isIndividual: z.boolean().optional().default(false),
  isForeign: z.boolean().optional().default(false),
});

export const updatePartnerSchema = createPartnerSchema.partial();

// Invoice item schema
const invoiceItemSchema = z.object({
  lineNumber: z.number().int().positive(),
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unitOfMeasure: z.string().max(50).default('db'),
  unitPrice: z.number(),
  vatRate: z.number().min(0).max(100),
});

// Invoice schemas
export const createInvoiceSchema = z.object({
  partnerId: uuidSchema,
  invoiceType: z.enum(['normal', 'proforma', 'deposit', 'final', 'corrective']),
  issuedAt: z.string().datetime(),
  dueAt: z.string().datetime(),
  paymentMethod: z.enum(['cash', 'transfer', 'card', 'other']),
  currency: z.string().length(3).default('HUF'),
  exchangeRate: z.number().positive().optional(),
  comment: z.string().max(1000).optional(),
  internalNote: z.string().max(1000).optional(),
  items: z.array(invoiceItemSchema).min(1),
}).refine(
  (data) => {
    // If currency is not HUF, exchange rate is required
    if (data.currency !== 'HUF' && !data.exchangeRate) {
      return false;
    }
    return true;
  },
  {
    message: 'Exchange rate is required for non-HUF currencies',
    path: ['exchangeRate'],
  }
);

// API Key schemas
export const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  scopes: z.array(z.string()).min(1),
  expiresAt: z.string().datetime().optional(),
});

// NAV credentials schema
export const updateNAVCredentialsSchema = z.object({
  technicalUser: z.string().min(1),
  technicalPassword: z.string().min(1),
  signingKey: z.string().min(1),
  exchangeKey: z.string().min(1),
});

// Query parameter schemas
export const listOrganizationsQuerySchema = paginationSchema.extend({
  status: z.enum(['active', 'suspended', 'deleted']).optional(),
  search: z.string().optional(),
});

export const listPartnersQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  type: z.enum(['customer', 'supplier', 'both']).optional(),
  isIndividual: z.coerce.boolean().optional(),
  isForeign: z.coerce.boolean().optional(),
  country: z.string().length(2).optional(),
});

export const listInvoicesQuerySchema = paginationSchema.extend({
  partnerId: uuidSchema.optional(),
  navStatus: z.enum(['draft', 'pending', 'submitted', 'failed']).optional(),
  invoiceType: z.enum(['normal', 'proforma', 'deposit', 'final', 'corrective', 'storno']).optional(),
  paymentStatus: z.enum(['unpaid', 'partial', 'paid', 'overdue']).optional(),
  issueDateFrom: z.string().datetime().optional(),
  issueDateTo: z.string().datetime().optional(),
  dueDateFrom: z.string().datetime().optional(),
  dueDateTo: z.string().datetime().optional(),
  invoiceNumber: z.string().optional(),
  search: z.string().optional(),
  currency: z.string().length(3).optional(),
  isStorned: z.coerce.boolean().optional(),
});

export const usageStatsQuerySchema = dateRangeSchema.required();

export const usageHistoryQuerySchema = dateRangeSchema.required().extend({
  groupBy: z.enum(['day', 'month']).default('day'),
});

export const usageLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional().default(100),
});
