import { z } from 'zod';

/**
 * Partner Validators
 *
 * Zod schemas for validating partner-related requests
 * Partners can be customers or suppliers for invoicing
 */

// Hungarian tax number regex: 12345678-1-23
const HUNGARIAN_TAX_NUMBER_REGEX = /^[0-9]{8}-[0-9]-[0-9]{2}$/;

// EU VAT number regex (simplified - varies by country)
const EU_VAT_NUMBER_REGEX = /^[A-Z]{2}[0-9A-Z]{2,13}$/;

// SWIFT/BIC code regex
const SWIFT_BIC_REGEX = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

// Create Partner Schema
export const createPartnerSchema = z.object({
  // Partner Details
  name: z.string().min(1, 'Partner name is required').max(255),
  taxNumber: z
    .string()
    .max(20)
    .regex(HUNGARIAN_TAX_NUMBER_REGEX, 'Invalid Hungarian tax number format (e.g., 12345678-1-23)')
    .optional(),
  taxNumberEu: z
    .string()
    .max(20)
    .regex(EU_VAT_NUMBER_REGEX, 'Invalid EU VAT number format (e.g., DE123456789)')
    .optional(),
  isIndividual: z.boolean().default(false),
  isForeign: z.boolean().default(false),

  // Contact
  email: z.string().email('Invalid email address').max(255).optional(),
  phone: z.string().max(50).optional(),

  // Address
  country: z.string().length(2, 'Country code must be 2 characters').default('HU'),
  postalCode: z.string().min(1, 'Postal code is required').max(10),
  city: z.string().min(1, 'City is required').max(100),
  address: z.string().min(1, 'Address is required').max(255),

  // Banking
  bankAccountNumber: z.string().max(50).optional(),
  bankName: z.string().max(100).optional(),
  swiftBic: z
    .string()
    .max(11)
    .regex(SWIFT_BIC_REGEX, 'Invalid SWIFT/BIC code format')
    .optional(),

  // Metadata
  notes: z.string().max(5000).optional(),
});

// Update Partner Schema (all fields optional except those that should remain required)
export const updatePartnerSchema = z.object({
  // Partner Details
  name: z.string().min(1).max(255).optional(),
  taxNumber: z
    .string()
    .max(20)
    .regex(HUNGARIAN_TAX_NUMBER_REGEX, 'Invalid Hungarian tax number format')
    .nullable()
    .optional(),
  taxNumberEu: z
    .string()
    .max(20)
    .regex(EU_VAT_NUMBER_REGEX, 'Invalid EU VAT number format')
    .nullable()
    .optional(),
  isIndividual: z.boolean().optional(),
  isForeign: z.boolean().optional(),

  // Contact
  email: z.string().email('Invalid email address').max(255).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),

  // Address
  country: z.string().length(2).optional(),
  postalCode: z.string().min(1).max(10).optional(),
  city: z.string().min(1).max(100).optional(),
  address: z.string().min(1).max(255).optional(),

  // Banking
  bankAccountNumber: z.string().max(50).nullable().optional(),
  bankName: z.string().max(100).nullable().optional(),
  swiftBic: z
    .string()
    .max(11)
    .regex(SWIFT_BIC_REGEX, 'Invalid SWIFT/BIC code format')
    .nullable()
    .optional(),

  // Metadata
  notes: z.string().max(5000).nullable().optional(),
});

// List Partners Query Schema
export const listPartnersQuerySchema = z.object({
  skip: z.string().regex(/^\d+$/).transform(Number).default('0'),
  take: z.string().regex(/^\d+$/).transform(Number).default('20'),
  search: z.string().max(255).optional(),
  isIndividual: z
    .string()
    .optional()
    .transform((val) => val === 'true' ? true : val === 'false' ? false : undefined),
  isForeign: z
    .string()
    .optional()
    .transform((val) => val === 'true' ? true : val === 'false' ? false : undefined),
  country: z.string().length(2).optional(),
});

// Type exports
export type CreatePartnerInput = z.infer<typeof createPartnerSchema>;
export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>;
export type ListPartnersQuery = z.infer<typeof listPartnersQuerySchema>;
