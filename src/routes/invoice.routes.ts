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
 * @swagger
 * /invoices:
 *   get:
 *     summary: List all invoices
 *     description: Returns a paginated list of invoices for the authenticated organization
 *     tags: [Invoices]
 *     parameters:
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: take
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: partnerId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: navStatus
 *         schema:
 *           type: string
 *           enum: [draft, pending, submitted, failed]
 *       - in: query
 *         name: invoiceType
 *         schema:
 *           type: string
 *           enum: [normal, proforma, deposit, final, corrective, storno]
 *     responses:
 *       200:
 *         description: Invoices retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 invoices:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Invoice'
 *                 total:
 *                   type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *   post:
 *     summary: Create a new invoice
 *     description: Create a new invoice (deducts 1 credit from organization balance)
 *     tags: [Invoices]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - partnerId
 *               - invoiceType
 *               - issuedAt
 *               - dueAt
 *               - paymentMethod
 *               - items
 *             properties:
 *               partnerId:
 *                 type: string
 *                 format: uuid
 *               invoiceType:
 *                 type: string
 *                 enum: [normal, proforma, deposit, final, corrective]
 *               issuedAt:
 *                 type: string
 *                 format: date-time
 *               dueAt:
 *                 type: string
 *                 format: date-time
 *               paymentMethod:
 *                 type: string
 *                 enum: [cash, transfer, card, other]
 *               currency:
 *                 type: string
 *                 default: HUF
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - description
 *                     - quantity
 *                     - unitPrice
 *                     - vatRate
 *                   properties:
 *                     description:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     unitPrice:
 *                       type: number
 *                     vatRate:
 *                       type: number
 *     responses:
 *       201:
 *         description: Invoice created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Invoice'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 */
router.get('/', requireInvoicesRead, invoiceController.listInvoices.bind(invoiceController));
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

/**
 * @route   GET /api/v1/invoices/:id/pdf
 * @desc    Download invoice PDF (generates if not exists)
 * @access  Protected (invoices:read scope)
 * @param   id - Invoice UUID
 */
router.get('/:id/pdf', requireInvoicesRead, invoiceController.downloadPDF.bind(invoiceController));

/**
 * @route   POST /api/v1/invoices/:id/submit-to-nav
 * @desc    Submit invoice to NAV (Hungarian Tax Authority)
 * @access  Protected (invoices:write scope)
 * @param   id - Invoice UUID
 */
router.post('/:id/submit-to-nav', standardRateLimiter, requireInvoicesWrite, invoiceController.submitToNAV.bind(invoiceController));

export default router;
