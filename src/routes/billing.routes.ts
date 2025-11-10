import { Router } from 'express';
import { billingController } from '@controllers/billing.controller';
import { authenticate } from '@middleware/auth.middleware';
import express from 'express';

/**
 * Billing Routes
 *
 * Defines API endpoints for billing and credit purchases
 *
 * Base path: /api/v1/billing
 */

const router = Router();

/**
 * @route   GET /api/v1/billing/packages
 * @desc    List available credit packages (public)
 * @access  Public
 */
router.get('/packages', billingController.listPackages.bind(billingController));

/**
 * @route   GET /api/v1/billing/packages/featured
 * @desc    Get featured credit packages (public)
 * @access  Public
 */
router.get('/packages/featured', billingController.getFeaturedPackages.bind(billingController));

/**
 * @route   POST /api/v1/billing/webhook
 * @desc    Stripe webhook endpoint
 * @access  Public (verified by Stripe signature)
 */
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  billingController.handleWebhook.bind(billingController)
);

// Apply authentication to remaining routes
router.use(authenticate);

/**
 * @route   POST /api/v1/billing/purchase-intent
 * @desc    Create payment intent for credit purchase
 * @access  Protected
 * @body    { packageCode: string }
 */
router.post('/purchase-intent', billingController.createPurchaseIntent.bind(billingController));

/**
 * @route   POST /api/v1/billing/checkout
 * @desc    Create Stripe checkout session for credit purchase
 * @access  Protected
 * @body    { packageCode: string, successUrl: string, cancelUrl: string }
 */
router.post('/checkout', billingController.createCheckoutSession.bind(billingController));

/**
 * @route   GET /api/v1/billing/transactions
 * @desc    List transactions for authenticated organization
 * @access  Protected
 * @query   type, paymentStatus, skip, take
 */
router.get('/transactions', billingController.listTransactions.bind(billingController));

/**
 * @route   GET /api/v1/billing/transactions/:id
 * @desc    Get transaction by ID
 * @access  Protected
 * @param   id - Transaction UUID
 */
router.get('/transactions/:id', billingController.getTransaction.bind(billingController));

/**
 * @route   GET /api/v1/billing/stats
 * @desc    Get purchase statistics for authenticated organization
 * @access  Protected
 */
router.get('/stats', billingController.getPurchaseStats.bind(billingController));

export default router;
