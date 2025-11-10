import { Router } from 'express';
import { navController } from '@controllers/nav.controller';
import { authenticate, requireInvoicesWrite } from '@middleware/auth.middleware';

/**
 * NAV Routes
 *
 * Defines API endpoints for NAV (Hungarian Tax Authority) integration
 *
 * Base path: /api/v1/nav
 * All endpoints require authentication and invoices:write scope
 */

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @route   POST /api/v1/nav/test-connection
 * @desc    Test connection to NAV with organization credentials
 * @access  Protected (invoices:write scope)
 */
router.post('/test-connection', requireInvoicesWrite, navController.testConnection.bind(navController));

/**
 * @route   POST /api/v1/nav/invoices/:id/submit
 * @desc    Submit invoice to NAV for reporting
 * @access  Protected (invoices:write scope)
 * @param   id - Invoice UUID
 */
router.post('/invoices/:id/submit', requireInvoicesWrite, navController.submitInvoice.bind(navController));

/**
 * @route   GET /api/v1/nav/invoices/:id/status
 * @desc    Query invoice submission status from NAV
 * @access  Protected (invoices:write scope)
 * @param   id - Invoice UUID
 */
router.get('/invoices/:id/status', requireInvoicesWrite, navController.queryInvoiceStatus.bind(navController));

export default router;
