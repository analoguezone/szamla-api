import { Request, Response, NextFunction } from 'express';
import { billingService } from '@services/billing.service';
import { creditPackageService } from '@services/credit-package.service';
import { stripeService } from '@services/stripe.service';
import { successResponse, errorResponse } from '@utils/response';
import { ForbiddenError } from '@utils/errors';
import { z } from 'zod';

/**
 * Billing Controller
 *
 * Handles HTTP requests for billing and credit purchases
 */

const createPurchaseIntentSchema = z.object({
  packageCode: z.string().min(1),
});

const createCheckoutSessionSchema = z.object({
  packageCode: z.string().min(1),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export class BillingController {
  /**
   * List available credit packages
   * GET /api/v1/billing/packages
   */
  async listPackages(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const packages = await creditPackageService.listActivePackages();

      successResponse(res, { packages });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get featured packages
   * GET /api/v1/billing/packages/featured
   */
  async getFeaturedPackages(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const packages = await creditPackageService.getFeaturedPackages();

      successResponse(res, { packages });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create payment intent for purchase
   * POST /api/v1/billing/purchase-intent
   */
  async createPurchaseIntent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      // Validate request body
      const { packageCode } = createPurchaseIntentSchema.parse(req.body);

      // Create payment intent
      const result = await billingService.createPurchaseIntent({
        organizationId: req.organizationId,
        packageCode,
      });

      successResponse(res, result, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        errorResponse(res, 'VALIDATION_ERROR', 'Invalid request data', 400, error.errors);
        return;
      }
      next(error);
    }
  }

  /**
   * Create checkout session for purchase
   * POST /api/v1/billing/checkout
   */
  async createCheckoutSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      // Validate request body
      const { packageCode, successUrl, cancelUrl } = createCheckoutSessionSchema.parse(req.body);

      // Create checkout session
      const result = await billingService.createCheckoutSession({
        organizationId: req.organizationId,
        packageCode,
        successUrl,
        cancelUrl,
      });

      successResponse(res, result, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        errorResponse(res, 'VALIDATION_ERROR', 'Invalid request data', 400, error.errors);
        return;
      }
      next(error);
    }
  }

  /**
   * Get transaction by ID
   * GET /api/v1/billing/transactions/:id
   */
  async getTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const transactionId = req.params.id;
      if (!transactionId) {
        errorResponse(res, 'VALIDATION_ERROR', 'Transaction ID is required', 400);
        return;
      }

      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      const transaction = await billingService.getTransaction(transactionId, req.organizationId);

      successResponse(res, { transaction });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List transactions for organization
   * GET /api/v1/billing/transactions
   */
  async listTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      const { type, paymentStatus, skip, take } = req.query;

      const result = await billingService.listTransactions({
        organizationId: req.organizationId,
        type: type as string,
        paymentStatus: paymentStatus as string,
        skip: skip ? parseInt(skip as string) : undefined,
        take: take ? parseInt(take as string) : undefined,
      });

      successResponse(res, {
        transactions: result.transactions,
        pagination: {
          total: result.total,
          skip: skip ? parseInt(skip as string) : 0,
          take: take ? parseInt(take as string) : 20,
          hasMore: (skip ? parseInt(skip as string) : 0) + (take ? parseInt(take as string) : 20) < result.total,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get purchase statistics
   * GET /api/v1/billing/stats
   */
  async getPurchaseStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      const stats = await billingService.getPurchaseStats(req.organizationId);

      successResponse(res, { stats });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle Stripe webhooks
   * POST /api/v1/billing/webhook
   */
  async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signature = req.headers['stripe-signature'] as string;

      if (!signature) {
        errorResponse(res, 'WEBHOOK_ERROR', 'Missing Stripe signature', 400);
        return;
      }

      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error('STRIPE_WEBHOOK_SECRET not configured');
        errorResponse(res, 'WEBHOOK_ERROR', 'Webhook not configured', 500);
        return;
      }

      // Verify webhook signature and construct event
      const event = stripeService.constructWebhookEvent(
        req.body,
        signature,
        webhookSecret
      );

      // Handle different event types
      switch (event.type) {
        case 'payment_intent.succeeded':
          {
            const paymentIntent = event.data.object as any;
            await billingService.handleSuccessfulPayment(paymentIntent.id);
            console.log(`✅ Payment succeeded: ${paymentIntent.id}`);
          }
          break;

        case 'payment_intent.payment_failed':
          {
            const paymentIntent = event.data.object as any;
            const reason = paymentIntent.last_payment_error?.message;
            await billingService.handleFailedPayment(paymentIntent.id, reason);
            console.log(`❌ Payment failed: ${paymentIntent.id}`);
          }
          break;

        case 'checkout.session.completed':
          {
            const session = event.data.object as any;
            await billingService.handleCheckoutSessionCompleted(session.id);
            console.log(`✅ Checkout completed: ${session.id}`);
          }
          break;

        case 'checkout.session.expired':
          {
            const session = event.data.object as any;
            console.log(`⏰ Checkout expired: ${session.id}`);
          }
          break;

        default:
          console.log(`ℹ️  Unhandled event type: ${event.type}`);
      }

      // Return 200 to acknowledge receipt
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Webhook error:', error);
      next(error);
    }
  }
}

// Export singleton instance
export const billingController = new BillingController();
