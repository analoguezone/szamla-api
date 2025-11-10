import { Router } from 'express';
import { invoiceController } from '@controllers/invoice.controller';
import { authenticate, requireInvoicesRead, requireInvoicesWrite } from '@middleware/auth.middleware';
import { standardRateLimiter } from '@middleware/rate-limit.middleware';

/**
 * Invoice Routes
 *
 * Defines API endpoints for invoice management with:
 * - Multi-currency support (HUF, EUR, USD, GBP, etc.)
 * - EU VAT compliance (reverse charge, Article 138)
 * - Storno (cancellation) invoices
 * - NAV integration support
 *
 * Base path: /api/v1/invoices
 * All endpoints require authentication
 */

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @route   GET /api/v1/invoices/stats
 * @desc    Get invoice statistics for authenticated organization
 * @access  Protected (invoices:read scope)
 */
router.get('/stats', requireInvoicesRead, invoiceController.getInvoiceStats.bind(invoiceController));

/**
 * @route   GET /api/v1/invoices
 * @desc    List all invoices for authenticated organization
 * @access  Protected (invoices:read scope)
 * @query   skip, take, partnerId, status, paymentStatus, navStatus, issueDateFrom, issueDateTo,
 *          dueDateFrom, dueDateTo, invoiceNumber, search, invoiceType, currency, isStorned
 */
router.get('/', requireInvoicesRead, invoiceController.listInvoices.bind(invoiceController));

/**
 * @route   POST /api/v1/invoices
 * @desc    Create a new invoice (deducts 1 credit)
 * @access  Protected (invoices:write scope)
 * @body    CreateInvoiceInput (including multi-currency, EU VAT codes)
 * @ratelimit 60 requests per minute per IP
 */
router.post('/', standardRateLimiter, requireInvoicesWrite, invoiceController.createInvoice.bind(invoiceController));

/**
 * @route   GET /api/v1/invoices/:id
 * @desc    Get invoice by ID with items
 * @access  Protected (invoices:read scope)
 * @param   id - Invoice UUID
 */
router.get('/:id', requireInvoicesRead, invoiceController.getInvoice.bind(invoiceController));

/**
 * @route   POST /api/v1/invoices/:id/storno
 * @desc    Create storno (cancellation) invoice (deducts 1 credit)
 * @access  Protected (invoices:write scope)
 * @param   id - Original invoice UUID
 * @body    { issueDate, comment?, internalNote? }
 * @ratelimit 60 requests per minute per IP
 */
router.post('/:id/storno', standardRateLimiter, requireInvoicesWrite, invoiceController.createStornoInvoice.bind(invoiceController));

/**
 * @route   POST /api/v1/invoices/:id/finalize
 * @desc    Finalize invoice (make immutable and ready for NAV submission)
 * @access  Protected (invoices:write scope)
 * @param   id - Invoice UUID
 */
router.post('/:id/finalize', requireInvoicesWrite, invoiceController.finalizeInvoice.bind(invoiceController));

/**
 * @route   PATCH /api/v1/invoices/:id/payment
 * @desc    Update payment status and payment date
 * @access  Protected (invoices:write scope)
 * @param   id - Invoice UUID
 * @body    { paymentStatus: 'unpaid' | 'partially_paid' | 'paid' | 'overdue', paymentDate?: Date }
 */
router.patch('/:id/payment', requireInvoicesWrite, invoiceController.updatePaymentStatus.bind(invoiceController));

/**
 * @route   DELETE /api/v1/invoices/:id
 * @desc    Delete invoice (soft delete - only drafts)
 * @access  Protected (invoices:write scope)
 * @param   id - Invoice UUID
 */
router.delete('/:id', requireInvoicesWrite, invoiceController.deleteInvoice.bind(invoiceController));

export default router;
