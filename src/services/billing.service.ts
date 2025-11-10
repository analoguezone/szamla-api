import { db } from '@config/database';
import { creditPackageService } from './credit-package.service';
import { stripeService } from './stripe.service';
import { organizationService } from './organization.service';
import { ValidationError, NotFoundError } from '@utils/errors';

/**
 * Billing Service
 *
 * Handles credit purchases and payment processing
 */

export interface PurchaseIntentParams {
  organizationId: string;
  packageCode: string;
}

export interface PurchaseResult {
  transactionId: string;
  credits: number;
  amount: number;
  status: string;
}

export class BillingService {
  /**
   * Create payment intent for credit purchase
   */
  async createPurchaseIntent(params: PurchaseIntentParams): Promise<{
    clientSecret: string;
    paymentIntentId: string;
    transactionId: string;
    amount: number;
    credits: number;
  }> {
    // Get organization
    const organization = await organizationService.getOrganizationById(params.organizationId);

    // Get credit package
    const pkg = await creditPackageService.getPackageByCode(params.packageCode);

    // Calculate amount
    const amount = Number(pkg.finalPriceHuf);

    // Create pending transaction
    const transaction = await db.transaction.create({
      data: {
        organizationId: params.organizationId,
        type: 'credit_purchase',
        creditsAmount: pkg.credits,
        balanceBeforeCredits: organization.balanceCredits,
        balanceAfterCredits: organization.balanceCredits, // Will be updated on success
        packageType: pkg.code,
        priceHuf: pkg.finalPriceHuf,
        discountPercent: pkg.discountPercent,
        paymentProvider: 'stripe',
        paymentStatus: 'pending',
        description: `Credit purchase: ${pkg.name}`,
        metadata: {
          packageId: pkg.id,
          packageName: pkg.name,
        },
      },
    });

    // Create Stripe payment intent
    const paymentIntent = await stripeService.createPaymentIntent({
      amount,
      currency: 'HUF',
      organizationId: params.organizationId,
      packageCode: pkg.code,
      credits: pkg.credits,
      metadata: {
        transactionId: transaction.id,
        organizationName: organization.name,
      },
    });

    // Update transaction with Stripe payment intent ID
    await db.transaction.update({
      where: { id: transaction.id },
      data: {
        stripePaymentIntentId: paymentIntent.id,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
      transactionId: transaction.id,
      amount,
      credits: pkg.credits,
    };
  }

  /**
   * Create checkout session for credit purchase
   */
  async createCheckoutSession(params: {
    organizationId: string;
    packageCode: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{
    sessionId: string;
    url: string;
    transactionId: string;
  }> {
    // Get organization
    const organization = await organizationService.getOrganizationById(params.organizationId);

    // Get credit package
    const pkg = await creditPackageService.getPackageByCode(params.packageCode);

    // Calculate amount
    const amount = Number(pkg.finalPriceHuf);

    // Create pending transaction
    const transaction = await db.transaction.create({
      data: {
        organizationId: params.organizationId,
        type: 'credit_purchase',
        creditsAmount: pkg.credits,
        balanceBeforeCredits: organization.balanceCredits,
        balanceAfterCredits: organization.balanceCredits, // Will be updated on success
        packageType: pkg.code,
        priceHuf: pkg.finalPriceHuf,
        discountPercent: pkg.discountPercent,
        paymentProvider: 'stripe',
        paymentStatus: 'pending',
        description: `Credit purchase: ${pkg.name}`,
        metadata: {
          packageId: pkg.id,
          packageName: pkg.name,
        },
      },
    });

    // Create Stripe checkout session
    const session = await stripeService.createCheckoutSession({
      amount,
      currency: 'HUF',
      organizationId: params.organizationId,
      packageCode: pkg.code,
      credits: pkg.credits,
      packageName: pkg.name,
      successUrl: params.successUrl,
      cancelUrl: params.cancelUrl,
    });

    // Update transaction with session ID
    await db.transaction.update({
      where: { id: transaction.id },
      data: {
        paymentReference: session.id,
      },
    });

    return {
      sessionId: session.id,
      url: session.url!,
      transactionId: transaction.id,
    };
  }

  /**
   * Handle successful payment (called from webhook)
   */
  async handleSuccessfulPayment(paymentIntentId: string): Promise<PurchaseResult> {
    // Find transaction by payment intent ID
    const transaction = await db.transaction.findFirst({
      where: {
        stripePaymentIntentId: paymentIntentId,
        paymentStatus: 'pending',
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction', paymentIntentId);
    }

    // Get payment intent details from Stripe
    const paymentIntent = await stripeService.retrievePaymentIntent(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      throw new ValidationError('Payment has not succeeded');
    }

    // Process payment in transaction
    const result = await db.$transaction(async (tx) => {
      // Add credits to organization
      const updatedOrg = await tx.organization.update({
        where: { id: transaction.organizationId },
        data: {
          balanceCredits: {
            increment: transaction.creditsAmount,
          },
        },
      });

      // Update transaction status
      const updatedTransaction = await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          paymentStatus: 'completed',
          balanceAfterCredits: updatedOrg.balanceCredits,
          stripeChargeId: paymentIntent.latest_charge as string,
          metadata: {
            ...(transaction.metadata as any),
            completedAt: new Date().toISOString(),
            stripePaymentIntentStatus: paymentIntent.status,
          },
        },
      });

      return {
        transactionId: updatedTransaction.id,
        credits: updatedTransaction.creditsAmount,
        amount: Number(updatedTransaction.priceHuf),
        status: 'completed',
      };
    });

    return result;
  }

  /**
   * Handle failed payment (called from webhook)
   */
  async handleFailedPayment(paymentIntentId: string, reason?: string): Promise<void> {
    const transaction = await db.transaction.findFirst({
      where: {
        stripePaymentIntentId: paymentIntentId,
      },
    });

    if (!transaction) {
      console.warn(`Transaction not found for payment intent: ${paymentIntentId}`);
      return;
    }

    // Update transaction status
    await db.transaction.update({
      where: { id: transaction.id },
      data: {
        paymentStatus: 'failed',
        metadata: {
          ...(transaction.metadata as any),
          failedAt: new Date().toISOString(),
          failureReason: reason || 'Unknown',
        },
      },
    });
  }

  /**
   * Handle checkout session completion (called from webhook)
   */
  async handleCheckoutSessionCompleted(sessionId: string): Promise<PurchaseResult> {
    // Find transaction by session ID
    const transaction = await db.transaction.findFirst({
      where: {
        paymentReference: sessionId,
        paymentStatus: 'pending',
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction', sessionId);
    }

    // Get session details from Stripe
    const session = await stripeService.retrieveCheckoutSession(sessionId);

    if (session.payment_status !== 'paid') {
      throw new ValidationError('Payment has not been completed');
    }

    // Process payment in transaction
    const result = await db.$transaction(async (tx) => {
      // Add credits to organization
      const updatedOrg = await tx.organization.update({
        where: { id: transaction.organizationId },
        data: {
          balanceCredits: {
            increment: transaction.creditsAmount,
          },
        },
      });

      // Update transaction status
      const updatedTransaction = await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          paymentStatus: 'completed',
          balanceAfterCredits: updatedOrg.balanceCredits,
          stripePaymentIntentId: session.payment_intent as string,
          metadata: {
            ...(transaction.metadata as any),
            completedAt: new Date().toISOString(),
            checkoutSessionStatus: session.payment_status,
          },
        },
      });

      return {
        transactionId: updatedTransaction.id,
        credits: updatedTransaction.creditsAmount,
        amount: Number(updatedTransaction.priceHuf),
        status: 'completed',
      };
    });

    return result;
  }

  /**
   * Get transaction by ID
   */
  async getTransaction(transactionId: string, organizationId: string): Promise<any> {
    const transaction = await db.transaction.findFirst({
      where: {
        id: transactionId,
        organizationId,
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction', transactionId);
    }

    return transaction;
  }

  /**
   * List transactions for organization
   */
  async listTransactions(params: {
    organizationId: string;
    type?: string;
    paymentStatus?: string;
    skip?: number;
    take?: number;
  }): Promise<{ transactions: any[]; total: number }> {
    const { organizationId, type, paymentStatus, skip = 0, take = 20 } = params;

    const where: any = {
      organizationId,
      ...(type && { type }),
      ...(paymentStatus && { paymentStatus }),
    };

    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      db.transaction.count({ where }),
    ]);

    return { transactions, total };
  }

  /**
   * Get purchase statistics
   */
  async getPurchaseStats(organizationId: string): Promise<{
    totalPurchases: number;
    totalCreditsPurchased: number;
    totalSpent: number;
    pendingPurchases: number;
  }> {
    const transactions = await db.transaction.findMany({
      where: {
        organizationId,
        type: 'credit_purchase',
      },
    });

    return {
      totalPurchases: transactions.filter((t) => t.paymentStatus === 'completed').length,
      totalCreditsPurchased: transactions
        .filter((t) => t.paymentStatus === 'completed')
        .reduce((sum, t) => sum + t.creditsAmount, 0),
      totalSpent: transactions
        .filter((t) => t.paymentStatus === 'completed')
        .reduce((sum, t) => sum + Number(t.priceHuf || 0), 0),
      pendingPurchases: transactions.filter((t) => t.paymentStatus === 'pending').length,
    };
  }
}

// Export singleton instance
export const billingService = new BillingService();
