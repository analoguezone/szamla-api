# Prepaid Billing System Design

Design for prepaid invoice-based billing with Stripe integration and auto-recharge.

**Related**: [ARCHITECTURE.md](../ARCHITECTURE.md) | [DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md)

## Pricing Model

### Base Pricing
- **Per Invoice**: 50 HUF + ÁFA (27% VAT)
- **Total per invoice**: 63.5 HUF
- **Adjustable per client**: Custom pricing per organization

### Prepaid System
- **Initial topup required**: Organizations must add credit before creating invoices
- **Auto-recharge**: Automatically charge when balance drops to 20%
- **Recharge amount**: 100x unit price (default: 5,000 HUF)

## Architecture

### Balance Flow

```
Organization Balance
      ↓
Create Invoice → Check Balance → Deduct Cost
                       ↓
                 Balance < 20%? → Auto-recharge via Stripe
                       ↓
                 Balance OK → Create Invoice
```

### Database Schema Extensions

#### organizations table (add columns)

```sql
ALTER TABLE organizations ADD COLUMN
  -- Billing
  balance_huf DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
  price_per_invoice_huf DECIMAL(10, 2) DEFAULT 50.00 NOT NULL,
  auto_recharge_enabled BOOLEAN DEFAULT TRUE,
  auto_recharge_threshold_percent INTEGER DEFAULT 20,
  auto_recharge_amount_huf DECIMAL(10, 2) DEFAULT 5000.00,

  -- Stripe
  stripe_customer_id VARCHAR(255) UNIQUE,
  stripe_payment_method_id VARCHAR(255),
  payment_method_last4 VARCHAR(4),
  payment_method_brand VARCHAR(20),

  -- Limits
  minimum_balance_huf DECIMAL(10, 2) DEFAULT 100.00,
  low_balance_alert_sent_at TIMESTAMP,

  -- Status
  billing_status VARCHAR(20) DEFAULT 'active' -- active, suspended, payment_failed
```

#### transactions table (new)

```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id),

  -- Transaction Details
  type VARCHAR(20) NOT NULL, -- topup, invoice_charge, refund, adjustment
  amount_huf DECIMAL(15, 2) NOT NULL, -- Positive for credit, negative for debit
  balance_before_huf DECIMAL(15, 2) NOT NULL,
  balance_after_huf DECIMAL(15, 2) NOT NULL,

  -- Payment Details
  payment_provider VARCHAR(20), -- stripe, manual, system
  payment_reference VARCHAR(255), -- Stripe payment intent ID
  payment_status VARCHAR(20), -- pending, succeeded, failed

  -- Description
  description TEXT,
  metadata JSONB, -- Additional data (invoice count, etc.)

  -- Stripe
  stripe_payment_intent_id VARCHAR(255),
  stripe_charge_id VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP
);

CREATE INDEX idx_transactions_organization_id ON transactions(organization_id, created_at DESC);
CREATE INDEX idx_transactions_type ON transactions(organization_id, type);
CREATE INDEX idx_transactions_invoice_id ON transactions(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX idx_transactions_stripe_intent ON transactions(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
```

#### billing_alerts table (new)

```sql
CREATE TABLE billing_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  alert_type VARCHAR(50) NOT NULL, -- low_balance, auto_recharge_failed, payment_method_expiring
  severity VARCHAR(20) NOT NULL, -- info, warning, critical

  message TEXT NOT NULL,
  metadata JSONB,

  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_alerts_organization ON billing_alerts(organization_id, created_at DESC);
CREATE INDEX idx_billing_alerts_unread ON billing_alerts(organization_id, is_read) WHERE is_read = FALSE;
```

## Implementation

### 1. Check Balance Before Invoice Creation

```typescript
// src/services/billing.service.ts
export const billingService = {
  /**
   * Check if organization has sufficient balance
   */
  async checkBalance(organizationId: string): Promise<BalanceCheck> {
    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: {
        balance_huf: true,
        price_per_invoice_huf: true,
        minimum_balance_huf: true
      }
    });

    const cost = this.calculateInvoiceCost(org.price_per_invoice_huf);
    const hasBalance = org.balance_huf >= cost;
    const balanceAfter = org.balance_huf - cost;

    return {
      hasBalance,
      currentBalance: org.balance_huf,
      cost,
      balanceAfter,
      needsTopup: balanceAfter < org.minimum_balance_huf
    };
  },

  /**
   * Calculate invoice cost with VAT
   */
  calculateInvoiceCost(basePriceHuf: number): number {
    const vatRate = 0.27; // 27% Hungarian VAT
    return basePriceHuf * (1 + vatRate);
  },

  /**
   * Deduct invoice cost from balance
   */
  async chargeInvoice(organizationId: string, invoiceId: string): Promise<Transaction> {
    return await db.$transaction(async (tx) => {
      // 1. Lock organization row
      const org = await tx.organization.findUnique({
        where: { id: organizationId },
        select: {
          balance_huf: true,
          price_per_invoice_huf: true,
          auto_recharge_enabled: true,
          auto_recharge_threshold_percent: true
        }
      });

      const cost = this.calculateInvoiceCost(org.price_per_invoice_huf);

      if (org.balance_huf < cost) {
        throw new InsufficientBalanceError(org.balance_huf, cost);
      }

      // 2. Deduct balance
      const newBalance = org.balance_huf - cost;

      await tx.organization.update({
        where: { id: organizationId },
        data: { balance_huf: newBalance }
      });

      // 3. Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          organization_id: organizationId,
          invoice_id: invoiceId,
          type: 'invoice_charge',
          amount_huf: -cost,
          balance_before_huf: org.balance_huf,
          balance_after_huf: newBalance,
          payment_provider: 'system',
          payment_status: 'succeeded',
          description: `Charge for invoice creation`,
          processed_at: new Date()
        }
      });

      // 4. Check if auto-recharge needed
      const threshold = org.auto_recharge_threshold_percent / 100;
      const rechargeThreshold = org.price_per_invoice_huf * 100 * threshold;

      if (org.auto_recharge_enabled && newBalance <= rechargeThreshold) {
        await this.triggerAutoRecharge(organizationId);
      }

      return transaction;
    });
  },

  /**
   * Trigger auto-recharge
   */
  async triggerAutoRecharge(organizationId: string): Promise<void> {
    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: {
        auto_recharge_amount_huf: true,
        stripe_payment_method_id: true
      }
    });

    if (!org.stripe_payment_method_id) {
      await this.sendLowBalanceAlert(organizationId);
      return;
    }

    // Queue auto-recharge job
    await autoRechargeQueue.add('recharge', {
      organizationId,
      amount: org.auto_recharge_amount_huf
    });
  }
};
```

### 2. Stripe Integration

```typescript
// src/services/stripe.service.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia'
});

export const stripeService = {
  /**
   * Create Stripe customer for organization
   */
  async createCustomer(organization: Organization): Promise<string> {
    const customer = await stripe.customers.create({
      name: organization.name,
      email: organization.email,
      metadata: {
        organization_id: organization.id,
        tax_number: organization.tax_number
      }
    });

    await db.organization.update({
      where: { id: organization.id },
      data: { stripe_customer_id: customer.id }
    });

    return customer.id;
  },

  /**
   * Save payment method for auto-recharge
   */
  async savePaymentMethod(
    organizationId: string,
    paymentMethodId: string
  ): Promise<void> {
    const org = await db.organization.findUnique({
      where: { id: organizationId }
    });

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: org.stripe_customer_id!
    });

    // Set as default
    await stripe.customers.update(org.stripe_customer_id!, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });

    // Get payment method details
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);

    // Save to database
    await db.organization.update({
      where: { id: organizationId },
      data: {
        stripe_payment_method_id: paymentMethodId,
        payment_method_last4: pm.card?.last4,
        payment_method_brand: pm.card?.brand
      }
    });
  },

  /**
   * Process topup payment
   */
  async processTopup(
    organizationId: string,
    amountHuf: number,
    paymentMethodId?: string
  ): Promise<Transaction> {
    const org = await db.organization.findUnique({
      where: { id: organizationId }
    });

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amountHuf * 100), // Convert to fillér (cents)
      currency: 'huf',
      customer: org.stripe_customer_id,
      payment_method: paymentMethodId || org.stripe_payment_method_id!,
      confirm: true,
      automatic_payment_methods: paymentMethodId ? undefined : { enabled: true },
      metadata: {
        organization_id: organizationId,
        type: 'topup'
      }
    });

    // Create transaction record
    const transaction = await db.transaction.create({
      data: {
        organization_id: organizationId,
        type: 'topup',
        amount_huf: amountHuf,
        balance_before_huf: org.balance_huf,
        balance_after_huf: org.balance_huf + amountHuf,
        payment_provider: 'stripe',
        payment_status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending',
        stripe_payment_intent_id: paymentIntent.id,
        description: 'Balance topup',
        processed_at: paymentIntent.status === 'succeeded' ? new Date() : null
      }
    });

    // Update balance if payment succeeded
    if (paymentIntent.status === 'succeeded') {
      await db.organization.update({
        where: { id: organizationId },
        data: {
          balance_huf: { increment: amountHuf },
          billing_status: 'active'
        }
      });
    }

    return transaction;
  },

  /**
   * Handle Stripe webhook
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
        break;

      case 'customer.subscription.deleted':
        // Handle if you add subscriptions later
        break;
    }
  },

  async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const transaction = await db.transaction.findFirst({
      where: { stripe_payment_intent_id: paymentIntent.id }
    });

    if (!transaction) return;

    await db.$transaction(async (tx) => {
      // Update transaction
      await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          payment_status: 'succeeded',
          processed_at: new Date()
        }
      });

      // Add balance
      await tx.organization.update({
        where: { id: transaction.organization_id },
        data: {
          balance_huf: { increment: transaction.amount_huf },
          billing_status: 'active'
        }
      });
    });
  },

  async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const transaction = await db.transaction.findFirst({
      where: { stripe_payment_intent_id: paymentIntent.id }
    });

    if (!transaction) return;

    await db.transaction.update({
      where: { id: transaction.id },
      data: { payment_status: 'failed' }
    });

    // Create alert
    await db.billingAlert.create({
      data: {
        organization_id: transaction.organization_id,
        alert_type: 'auto_recharge_failed',
        severity: 'critical',
        message: 'Auto-recharge payment failed. Please update your payment method.',
        metadata: { payment_intent_id: paymentIntent.id }
      }
    });

    // If balance is critical, suspend
    const org = await db.organization.findUnique({
      where: { id: transaction.organization_id }
    });

    if (org.balance_huf < org.minimum_balance_huf) {
      await db.organization.update({
        where: { id: transaction.organization_id },
        data: { billing_status: 'payment_failed' }
      });
    }
  }
};
```

### 3. Modified Invoice Creation Flow

```typescript
// src/services/invoice.service.ts
export const invoiceService = {
  async create(organizationId: string, data: CreateInvoiceDTO): Promise<Invoice> {
    // 1. Check balance
    const balanceCheck = await billingService.checkBalance(organizationId);

    if (!balanceCheck.hasBalance) {
      throw new InsufficientBalanceError(
        balanceCheck.currentBalance,
        balanceCheck.cost
      );
    }

    // 2. Create invoice
    const invoice = await db.invoice.create({
      data: {
        organization_id: organizationId,
        partner_id: data.partnerId,
        // ... other fields
      }
    });

    // 3. Charge for invoice (only after successful creation)
    if (data.auto_finalize) {
      await billingService.chargeInvoice(organizationId, invoice.id);
    }

    return invoice;
  },

  async finalize(invoiceId: string, organizationId: string): Promise<Invoice> {
    // Check balance before finalizing
    const balanceCheck = await billingService.checkBalance(organizationId);

    if (!balanceCheck.hasBalance) {
      throw new InsufficientBalanceError(
        balanceCheck.currentBalance,
        balanceCheck.cost
      );
    }

    // Finalize invoice
    const invoice = await db.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'finalized',
        finalized_at: new Date()
      }
    });

    // Charge for invoice
    await billingService.chargeInvoice(organizationId, invoiceId);

    // Submit to NAV
    if (data.auto_submit_to_nav) {
      await navService.submitInvoice(invoice);
    }

    return invoice;
  }
};
```

## API Endpoints

### Billing Endpoints

```typescript
// Get current balance
GET /api/v1/billing/balance

// Get transaction history
GET /api/v1/billing/transactions?page=1&limit=25

// Add credit (topup)
POST /api/v1/billing/topup
{
  "amount_huf": 5000,
  "payment_method_id": "pm_xxx" // Optional, uses saved method if not provided
}

// Save payment method for auto-recharge
POST /api/v1/billing/payment-method
{
  "payment_method_id": "pm_xxx"
}

// Update billing settings
PATCH /api/v1/billing/settings
{
  "auto_recharge_enabled": true,
  "auto_recharge_threshold_percent": 20,
  "auto_recharge_amount_huf": 10000
}

// Get billing alerts
GET /api/v1/billing/alerts

// Stripe webhook
POST /webhooks/stripe
```

## Testing Strategy

### Test Scenarios

1. **Sufficient Balance**: Create invoice with adequate balance
2. **Insufficient Balance**: Reject invoice creation
3. **Auto-recharge Trigger**: Verify auto-recharge at 20% threshold
4. **Payment Failure**: Handle failed auto-recharge
5. **Balance Calculation**: Verify VAT calculation
6. **Concurrent Requests**: Test race conditions in balance deduction

### Mock Stripe in Tests

```typescript
jest.mock('stripe');

describe('Billing Service', () => {
  it('should deduct balance on invoice creation', async () => {
    const org = await createTestOrg({ balance_huf: 1000 });

    const invoice = await invoiceService.create(org.id, invoiceData);

    const updatedOrg = await db.organization.findUnique({
      where: { id: org.id }
    });

    expect(updatedOrg.balance_huf).toBe(1000 - 63.5); // 50 HUF + 27% VAT
  });

  it('should trigger auto-recharge at 20% threshold', async () => {
    const org = await createTestOrg({
      balance_huf: 1270, // 20 invoices worth
      price_per_invoice_huf: 50,
      auto_recharge_enabled: true,
      auto_recharge_threshold_percent: 20,
      auto_recharge_amount_huf: 5000
    });

    // Create invoices until balance < 20%
    for (let i = 0; i < 16; i++) {
      await invoiceService.create(org.id, invoiceData);
    }

    // Verify auto-recharge was triggered
    expect(autoRechargeQueue.add).toHaveBeenCalledWith('recharge', {
      organizationId: org.id,
      amount: 5000
    });
  });
});
```

## Monitoring

### Metrics to Track

1. **Balance Health**:
   - Organizations with balance < 1 invoice cost
   - Organizations with auto-recharge disabled and low balance

2. **Payment Metrics**:
   - Auto-recharge success rate
   - Average topup amount
   - Payment failure rate

3. **Revenue**:
   - Daily invoice count
   - Revenue per organization
   - Total revenue (HUF)

### Alerts

```typescript
// Daily cron job
async function checkBillingHealth() {
  // Organizations with critical balance
  const criticalOrgs = await db.organization.findMany({
    where: {
      balance_huf: { lt: db.raw('price_per_invoice_huf * 1.27') },
      billing_status: 'active'
    }
  });

  for (const org of criticalOrgs) {
    await sendLowBalanceAlert(org.id);
  }
}
```

## Pricing Configuration

### Default Pricing

```typescript
// src/config/pricing.ts
export const pricing = {
  default: {
    perInvoiceHuf: 50,
    vatRate: 0.27,
    autoRechargeThresholdPercent: 20,
    autoRechargeAmountMultiplier: 100 // 100x unit price
  },

  minimumTopup: 500, // HUF
  maximumTopup: 1000000, // HUF

  // Special pricing tiers (optional)
  tiers: {
    basic: { perInvoiceHuf: 50 },
    volume: { perInvoiceHuf: 40 }, // > 1000 invoices/month
    enterprise: { perInvoiceHuf: 30 } // > 10000 invoices/month
  }
};
```

## Next Steps

1. **Add to database migrations**
2. **Implement billing service**
3. **Integrate Stripe**
4. **Add billing endpoints to API**
5. **Create billing dashboard UI**
6. **Test auto-recharge flow**
7. **Setup Stripe webhook handling**

---

**Estimated Implementation**: 1-2 weeks (Phase 7 in development plan)
