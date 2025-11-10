import Stripe from 'stripe';
import { ValidationError } from '@utils/errors';

/**
 * Stripe Service
 *
 * Handles Stripe API integration for payments
 */

export class StripeService {
  private stripe: Stripe;

  constructor() {
    const apiKey = process.env.STRIPE_SECRET_KEY;

    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }

    this.stripe = new Stripe(apiKey, {
      apiVersion: '2025-02-24.acacia',
      typescript: true,
    });
  }

  /**
   * Create payment intent for credit purchase
   */
  async createPaymentIntent(params: {
    amount: number; // Amount in HUF (smallest currency unit - fillér)
    currency: string;
    organizationId: string;
    packageCode: string;
    credits: number;
    metadata?: Record<string, string>;
  }): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(params.amount * 100), // Convert HUF to fillér
        currency: params.currency.toLowerCase(),
        metadata: {
          organizationId: params.organizationId,
          packageCode: params.packageCode,
          credits: params.credits.toString(),
          ...params.metadata,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return paymentIntent;
    } catch (error: any) {
      console.error('Stripe payment intent creation failed:', error);
      throw new ValidationError(`Payment intent creation failed: ${error.message}`);
    }
  }

  /**
   * Retrieve payment intent
   */
  async retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error: any) {
      console.error('Stripe payment intent retrieval failed:', error);
      throw new ValidationError(`Payment intent retrieval failed: ${error.message}`);
    }
  }

  /**
   * Create checkout session for credit purchase
   */
  async createCheckoutSession(params: {
    amount: number;
    currency: string;
    organizationId: string;
    packageCode: string;
    credits: number;
    packageName: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<Stripe.Checkout.Session> {
    try {
      const session = await this.stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: params.currency.toLowerCase(),
              product_data: {
                name: params.packageName,
                description: `${params.credits} credits for invoice generation`,
              },
              unit_amount: Math.round(params.amount * 100), // Convert to fillér
            },
            quantity: 1,
          },
        ],
        metadata: {
          organizationId: params.organizationId,
          packageCode: params.packageCode,
          credits: params.credits.toString(),
        },
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        customer_email: undefined, // Can be set from organization
      });

      return session;
    } catch (error: any) {
      console.error('Stripe checkout session creation failed:', error);
      throw new ValidationError(`Checkout session creation failed: ${error.message}`);
    }
  }

  /**
   * Retrieve checkout session
   */
  async retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    try {
      return await this.stripe.checkout.sessions.retrieve(sessionId);
    } catch (error: any) {
      console.error('Stripe checkout session retrieval failed:', error);
      throw new ValidationError(`Checkout session retrieval failed: ${error.message}`);
    }
  }

  /**
   * Construct webhook event from payload and signature
   */
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
    webhookSecret: string
  ): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error: any) {
      console.error('Stripe webhook signature verification failed:', error);
      throw new ValidationError(`Webhook verification failed: ${error.message}`);
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(paymentIntentId: string, amount?: number): Promise<Stripe.Refund> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined,
      });

      return refund;
    } catch (error: any) {
      console.error('Stripe refund failed:', error);
      throw new ValidationError(`Refund failed: ${error.message}`);
    }
  }

  /**
   * Get Stripe instance for advanced operations
   */
  getStripeInstance(): Stripe {
    return this.stripe;
  }
}

// Export singleton instance
export const stripeService = new StripeService();
