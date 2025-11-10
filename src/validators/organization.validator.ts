import { z } from 'zod';

/**
 * Organization Validators
 *
 * Zod schemas for validating organization-related requests
 */

// NAV Credentials Schema
export const navCredentialsSchema = z.object({
  login: z.string().min(1, 'NAV login is required'),
  password: z.string().min(1, 'NAV password is required'),
  signatureKey: z.string().min(1, 'NAV signature key is required'),
  exchangeKey: z.string().min(1, 'NAV exchange key is required'),
});

// Create Organization Schema
export const createOrganizationSchema = z.object({
  // Organization Details
  name: z.string().min(1, 'Organization name is required').max(255),
  taxNumber: z
    .string()
    .min(1, 'Tax number is required')
    .max(20)
    .regex(/^[0-9]{8}-[0-9]-[0-9]{2}$/, 'Invalid Hungarian tax number format (e.g., 12345678-1-23)'),
  email: z.string().email('Invalid email address').max(255),
  phone: z.string().max(50).optional(),

  // Address
  country: z.string().length(2, 'Country code must be 2 characters').default('HU'),
  postalCode: z.string().min(1, 'Postal code is required').max(10),
  city: z.string().min(1, 'City is required').max(100),
  address: z.string().min(1, 'Address is required').max(255),

  // Invoice Settings
  invoicePrefix: z.string().max(10).default('INV'),
  defaultCurrency: z.string().length(3, 'Currency code must be 3 characters').default('HUF'),
  defaultLanguage: z.string().length(2, 'Language code must be 2 characters').default('hu'),

  // Logo
  logoUrl: z.string().url('Invalid logo URL').max(500).optional(),

  // Software Details (for NAV)
  softwareDeveloper: z.string().min(1, 'Software developer name is required').max(100),
  softwareDeveloperEmail: z.string().email('Invalid software developer email').max(255),
  softwareDeveloperTaxNumber: z
    .string()
    .max(20)
    .regex(/^[0-9]{8}-[0-9]-[0-9]{2}$/, 'Invalid Hungarian tax number format')
    .optional(),

  // NAV Credentials (optional on creation, can be added later)
  navCredentials: navCredentialsSchema.optional(),

  // Billing
  autoRechargeEnabled: z.boolean().default(true),
  autoRechargeThresholdPercent: z.number().int().min(0).max(100).default(20),
  autoRechargePackage: z
    .enum(['starter', 'basic', 'pro', 'business', 'enterprise'])
    .default('basic'),
});

// Update Organization Schema (all fields optional)
export const updateOrganizationSchema = z.object({
  // Organization Details
  name: z.string().min(1).max(255).optional(),
  email: z.string().email('Invalid email address').max(255).optional(),
  phone: z.string().max(50).optional(),

  // Address
  country: z.string().length(2).optional(),
  postalCode: z.string().min(1).max(10).optional(),
  city: z.string().min(1).max(100).optional(),
  address: z.string().min(1).max(255).optional(),

  // Invoice Settings
  invoicePrefix: z.string().max(10).optional(),
  defaultCurrency: z.string().length(3).optional(),
  defaultLanguage: z.string().length(2).optional(),

  // Logo
  logoUrl: z.string().url('Invalid logo URL').max(500).optional(),

  // Software Details
  softwareDeveloper: z.string().min(1).max(100).optional(),
  softwareDeveloperEmail: z.string().email().max(255).optional(),
  softwareDeveloperTaxNumber: z
    .string()
    .max(20)
    .regex(/^[0-9]{8}-[0-9]-[0-9]{2}$/)
    .optional(),

  // Billing
  autoRechargeEnabled: z.boolean().optional(),
  autoRechargeThresholdPercent: z.number().int().min(0).max(100).optional(),
  autoRechargePackage: z.enum(['starter', 'basic', 'pro', 'business', 'enterprise']).optional(),
});

// Update NAV Credentials Schema
export const updateNAVCredentialsSchema = navCredentialsSchema;

// Query Parameters for Listing Organizations
export const listOrganizationsQuerySchema = z.object({
  skip: z.string().regex(/^\d+$/).transform(Number).default('0'),
  take: z.string().regex(/^\d+$/).transform(Number).default('20'),
  status: z.enum(['active', 'suspended', 'deleted']).optional(),
  search: z.string().max(255).optional(),
});

// Credits Schema
export const addCreditsSchema = z.object({
  credits: z.number().int().positive('Credits must be a positive integer'),
});

export const deductCreditsSchema = z.object({
  credits: z.number().int().positive('Credits must be a positive integer'),
});

// Stripe Customer Schema
export const updateStripeCustomerSchema = z.object({
  stripeCustomerId: z.string().min(1, 'Stripe customer ID is required'),
  paymentMethodId: z.string().optional(),
  last4: z.string().length(4).optional(),
  brand: z.string().max(20).optional(),
});

// Status Update Schema
export const updateStatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'deleted']),
});

export const updateBillingStatusSchema = z.object({
  billingStatus: z.enum(['active', 'suspended', 'delinquent']),
});

// Type exports for TypeScript
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type UpdateNAVCredentialsInput = z.infer<typeof updateNAVCredentialsSchema>;
export type ListOrganizationsQuery = z.infer<typeof listOrganizationsQuerySchema>;
export type AddCreditsInput = z.infer<typeof addCreditsSchema>;
export type DeductCreditsInput = z.infer<typeof deductCreditsSchema>;
export type UpdateStripeCustomerInput = z.infer<typeof updateStripeCustomerSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type UpdateBillingStatusInput = z.infer<typeof updateBillingStatusSchema>;
