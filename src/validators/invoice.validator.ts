import { z } from 'zod';

/**
 * Invoice Validators
 *
 * Zod schemas for invoice creation and management
 * Supports:
 * - Multi-currency invoicing
 * - EU VAT exemptions (reverse charge)
 * - Storno (cancellation) invoices
 * - Multiple line items
 */

// Common currency codes (ISO 4217)
const CURRENCY_CODES = ['HUF', 'EUR', 'USD', 'GBP', 'CHF', 'PLN', 'CZK', 'RON'] as const;

// VAT exemption codes for Hungarian/EU invoicing
const VAT_CODES = [
  'AE',   // Article 138 - Intra-EU B2B supply (reverse charge)
  'K',    // Outside scope (reverse charge mechanism)
  'TAM',  // Tax exemption (Article 89)
  'AAM',  // Export outside EU
  'EUE',  // EU services (reverse charge)
  'EUFAD37', // EU goods Article 37
  'EUFADE',  // EU goods triangulation
  'HO',   // Domestic reverse charge
  'EAM',  // Customs procedure
] as const;

// Payment methods
const PAYMENT_METHODS = [
  'transfer',     // Bank transfer
  'cash',         // Cash payment
  'card',         // Card payment
  'compensation', // Debt compensation
  'voucher',      // Gift voucher
  'other',        // Other method
] as const;

// Payment status
const PAYMENT_STATUS = ['unpaid', 'partial', 'paid', 'overdue'] as const;

// Invoice types
const INVOICE_TYPES = ['normal', 'proforma', 'advance', 'final', 'correction'] as const;

// Invoice status
const INVOICE_STATUS = ['draft', 'finalized', 'sent', 'cancelled'] as const;

// Invoice item schema
export const invoiceItemSchema = z.object({
  name: z.string().min(1, 'Item name is required').max(255),
  description: z.string().max(5000).optional(),
  sku: z.string().max(100).optional(),

  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().max(20).default('db'), // 'db' = piece in Hungarian

  netUnitPrice: z.number().nonnegative('Unit price cannot be negative'),
  vatRate: z.number().min(0).max(100, 'VAT rate must be between 0 and 100'),
  vatCode: z.enum(VAT_CODES).optional(),

  comment: z.string().max(5000).optional(),
});

// Create invoice schema
export const createInvoiceSchema = z.object({
  partnerId: z.string().uuid('Invalid partner ID'),

  // Dates
  issueDate: z.string().datetime().transform(val => new Date(val)),
  fulfillmentDate: z.string().datetime().transform(val => new Date(val)),
  dueDate: z.string().datetime().transform(val => new Date(val)),

  // Currency
  currency: z.enum(CURRENCY_CODES).default('HUF'),
  exchangeRate: z.number().positive().default(1.0),

  // Items
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),

  // Payment
  paymentMethod: z.enum(PAYMENT_METHODS).default('transfer'),

  // Additional info
  language: z.enum(['hu', 'en', 'de', 'fr']).default('hu'),
  comment: z.string().max(5000).optional(),
  internalNote: z.string().max(5000).optional(),

  // Invoice type
  invoiceType: z.enum(INVOICE_TYPES).default('normal'),
}).refine(
  (data) => {
    // Fulfillment date should not be after due date
    return data.fulfillmentDate <= data.dueDate;
  },
  {
    message: 'Fulfillment date cannot be after due date',
    path: ['fulfillmentDate'],
  }
).refine(
  (data) => {
    // Issue date should not be after due date
    return data.issueDate <= data.dueDate;
  },
  {
    message: 'Issue date cannot be after due date',
    path: ['issueDate'],
  }
);

// Create storno invoice schema
export const createStornoInvoiceSchema = z.object({
  originalInvoiceId: z.string().uuid('Invalid original invoice ID'),

  // Dates
  issueDate: z.string().datetime().transform(val => new Date(val)),

  // Additional info
  comment: z.string().max(5000).optional(),
  internalNote: z.string().max(5000).optional(),
});

// Update invoice schema (for draft invoices only)
export const updateInvoiceSchema = z.object({
  partnerId: z.string().uuid().optional(),

  // Dates
  issueDate: z.string().datetime().transform(val => new Date(val)).optional(),
  fulfillmentDate: z.string().datetime().transform(val => new Date(val)).optional(),
  dueDate: z.string().datetime().transform(val => new Date(val)).optional(),

  // Currency
  currency: z.enum(CURRENCY_CODES).optional(),
  exchangeRate: z.number().positive().optional(),

  // Items
  items: z.array(invoiceItemSchema).min(1).optional(),

  // Payment
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),

  // Additional info
  language: z.enum(['hu', 'en', 'de', 'fr']).optional(),
  comment: z.string().max(5000).nullable().optional(),
  internalNote: z.string().max(5000).nullable().optional(),
});

// Update payment status schema
export const updatePaymentStatusSchema = z.object({
  paymentStatus: z.enum(PAYMENT_STATUS),
  paymentDate: z.string().datetime().transform(val => new Date(val)).optional(),
});

// List invoices query schema
export const listInvoicesQuerySchema = z.object({
  skip: z.string().regex(/^\d+$/).transform(Number).default('0'),
  take: z.string().regex(/^\d+$/).transform(Number).default('20'),

  // Filters
  partnerId: z.string().uuid().optional(),
  status: z.enum(INVOICE_STATUS).optional(),
  paymentStatus: z.enum(PAYMENT_STATUS).optional(),
  navStatus: z.enum(['pending', 'submitted', 'confirmed', 'rejected']).optional(),

  // Date filters
  issueDateFrom: z.string().datetime().transform(val => new Date(val)).optional(),
  issueDateTo: z.string().datetime().transform(val => new Date(val)).optional(),
  dueDateFrom: z.string().datetime().transform(val => new Date(val)).optional(),
  dueDateTo: z.string().datetime().transform(val => new Date(val)).optional(),

  // Search
  invoiceNumber: z.string().max(50).optional(),
  search: z.string().max(255).optional(),

  // Type filters
  invoiceType: z.enum(INVOICE_TYPES).optional(),
  currency: z.enum(CURRENCY_CODES).optional(),
  isStorned: z.string().optional().transform(val => val === 'true' ? true : val === 'false' ? false : undefined),
});

// Type exports
export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type CreateStornoInvoiceInput = z.infer<typeof createStornoInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type UpdatePaymentStatusInput = z.infer<typeof updatePaymentStatusSchema>;
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;

// Helper: Supported currencies
export { CURRENCY_CODES, VAT_CODES, PAYMENT_METHODS, PAYMENT_STATUS, INVOICE_TYPES, INVOICE_STATUS };
