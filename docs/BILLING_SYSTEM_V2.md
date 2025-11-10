# Prepaid Billing System - Credit-Based Design v2

**UPDATED DESIGN**: Credit-based system instead of HUF-based for better flexibility.

**Related**: [ARCHITECTURE.md](../ARCHITECTURE.md) | [DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md)

## Why Credits?

✅ **Simpler discounts**: Just adjust credit packages
✅ **Future currency support**: Credits are currency-agnostic
✅ **Promotional campaigns**: Give free credits easily
✅ **Cleaner pricing**: 1 credit = 1 invoice (simple mental model)
✅ **Flexible tiers**: Different credit costs for different org types
✅ **Easier reporting**: Track credits, not currency conversions

## Credit System Overview

### Base Pricing

**1 Credit = 1 Invoice**

**Credit Packages** (all prices in HUF):

| Package | Credits | Price (HUF) | Price per Credit | Discount |
|---------|---------|-------------|------------------|----------|
| **Starter** | 10 | 635 HUF | 63.5 HUF | 0% |
| **Basic** | 100 | 6,350 HUF | 63.5 HUF | 0% |
| **Pro** | 1000 | 50,800 HUF | 50.8 HUF | **20%** |

**Calculation**:
- Base price: 50 HUF + 27% VAT = **63.5 HUF per invoice**
- 1000 credits at 20% discount: 1000 × 63.5 × 0.8 = **50,800 HUF**
- Savings on 1000 package: **12,700 HUF**

### Auto-Recharge

- **Trigger**: When credits < 20% of last purchase amount
- **Amount**: Same package as last purchase (or default to Basic 100)
- **Example**:
  - Bought Pro (1000 credits)
  - Auto-recharge triggers at 200 credits
  - Purchases another 1000 credits

## Database Schema

### organizations table (updated)

```sql
ALTER TABLE organizations
  -- Remove old HUF-based fields
  DROP COLUMN IF EXISTS balance_huf,
  DROP COLUMN IF EXISTS price_per_invoice_huf,
  DROP COLUMN IF EXISTS auto_recharge_amount_huf,
  DROP COLUMN IF EXISTS minimum_balance_huf,

  -- Add credit-based fields
  ADD COLUMN balance_credits INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN credits_per_invoice INTEGER DEFAULT 1 NOT NULL,

  -- Auto-recharge settings
  ADD COLUMN auto_recharge_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN auto_recharge_threshold_percent INTEGER DEFAULT 20,
  ADD COLUMN auto_recharge_package VARCHAR(20) DEFAULT 'basic', -- starter, basic, pro

  -- Stripe
  ADD COLUMN stripe_customer_id VARCHAR(255) UNIQUE,
  ADD COLUMN stripe_payment_method_id VARCHAR(255),
  ADD COLUMN payment_method_last4 VARCHAR(4),
  ADD COLUMN payment_method_brand VARCHAR(20),

  -- Status
  ADD COLUMN billing_status VARCHAR(20) DEFAULT 'active', -- active, suspended, payment_failed
  ADD COLUMN low_balance_alert_sent_at TIMESTAMP;

-- Index for low balance checks
CREATE INDEX idx_organizations_low_balance ON organizations(balance_credits)
  WHERE auto_recharge_enabled = TRUE;
```

### transactions table (updated for credits)

```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id),

  -- Transaction Details
  type VARCHAR(20) NOT NULL, -- credit_purchase, invoice_charge, refund, promo_credit, adjustment

  -- Credits
  credits_amount INTEGER NOT NULL, -- Positive for credit, negative for debit
  balance_before_credits INTEGER NOT NULL,
  balance_after_credits INTEGER NOT NULL,

  -- Payment Details (for purchases)
  package_type VARCHAR(20), -- starter, basic, pro
  price_huf DECIMAL(10, 2), -- Amount paid in HUF (if applicable)
  discount_percent INTEGER DEFAULT 0,

  payment_provider VARCHAR(20), -- stripe, manual, system, promo
  payment_reference VARCHAR(255), -- Stripe payment intent ID
  payment_status VARCHAR(20), -- pending, succeeded, failed

  -- Description
  description TEXT,
  metadata JSONB, -- Additional data

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
CREATE INDEX idx_transactions_stripe_intent ON transactions(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
```

### credit_packages table (new)

```sql
CREATE TABLE credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Package Details
  code VARCHAR(20) UNIQUE NOT NULL, -- 'starter', 'basic', 'pro'
  name VARCHAR(100) NOT NULL, -- 'Starter Package', 'Basic Package', 'Pro Package'
  credits INTEGER NOT NULL,

  -- Pricing
  base_price_huf DECIMAL(10, 2) NOT NULL, -- Price without discount
  discount_percent INTEGER DEFAULT 0,
  final_price_huf DECIMAL(10, 2) NOT NULL, -- Actual price to charge

  -- Metadata
  description TEXT,
  features JSONB, -- Additional features/notes

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed default packages
INSERT INTO credit_packages (code, name, credits, base_price_huf, discount_percent, final_price_huf, sort_order) VALUES
  ('starter', 'Starter Package', 10, 635, 0, 635, 1),
  ('basic', 'Basic Package', 100, 6350, 0, 6350, 2),
  ('pro', 'Pro Package', 1000, 63500, 20, 50800, 3);

CREATE INDEX idx_credit_packages_active ON credit_packages(is_active, sort_order);
```

### promotional_credits table (new - for future promos)

```sql
CREATE TABLE promotional_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Promo Details
  promo_code VARCHAR(50),
  credits_granted INTEGER NOT NULL,
  reason TEXT,

  granted_by VARCHAR(100), -- admin user, system, campaign name
  expires_at TIMESTAMP,

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_promotional_credits_org ON promotional_credits(organization_id);
```

## Implementation

### 1. Billing Service (Updated)

```typescript
// src/services/billing.service.ts
export const billingService = {
  /**
   * Check if organization has sufficient credits
   */
  async checkCredits(organizationId: string, requiredCredits: number = 1): Promise<CreditCheck> {
    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: {
        balance_credits: true,
        credits_per_invoice: true
      }
    });

    const hasCredits = org.balance_credits >= requiredCredits;
    const creditsAfter = org.balance_credits - requiredCredits;

    return {
      hasCredits,
      currentBalance: org.balance_credits,
      required: requiredCredits,
      balanceAfter: creditsAfter,
      needsTopup: !hasCredits
    };
  },

  /**
   * Deduct credits for invoice creation
   */
  async chargeCredits(
    organizationId: string,
    invoiceId: string,
    credits: number = 1
  ): Promise<Transaction> {
    return await db.$transaction(async (tx) => {
      // 1. Lock organization row
      const org = await tx.organization.findUnique({
        where: { id: organizationId },
        select: {
          balance_credits: true,
          credits_per_invoice: true,
          auto_recharge_enabled: true,
          auto_recharge_threshold_percent: true,
          auto_recharge_package: true
        }
      });

      if (org.balance_credits < credits) {
        throw new InsufficientCreditsError(org.balance_credits, credits);
      }

      // 2. Deduct credits
      const newBalance = org.balance_credits - credits;

      await tx.organization.update({
        where: { id: organizationId },
        data: { balance_credits: newBalance }
      });

      // 3. Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          organization_id: organizationId,
          invoice_id: invoiceId,
          type: 'invoice_charge',
          credits_amount: -credits,
          balance_before_credits: org.balance_credits,
          balance_after_credits: newBalance,
          payment_provider: 'system',
          payment_status: 'succeeded',
          description: `Charge for invoice creation`,
          processed_at: new Date()
        }
      });

      // 4. Check if auto-recharge needed
      await this.checkAutoRecharge(organizationId, org, newBalance);

      return transaction;
    });
  },

  /**
   * Check and trigger auto-recharge if needed
   */
  async checkAutoRecharge(
    organizationId: string,
    org: Organization,
    currentBalance: number
  ): Promise<void> {
    if (!org.auto_recharge_enabled) return;

    // Get last purchase to determine threshold
    const lastPurchase = await db.transaction.findFirst({
      where: {
        organization_id: organizationId,
        type: 'credit_purchase',
        payment_status: 'succeeded'
      },
      orderBy: { created_at: 'desc' }
    });

    if (!lastPurchase) return;

    const threshold = (org.auto_recharge_threshold_percent / 100) * lastPurchase.credits_amount;

    if (currentBalance <= threshold) {
      // Trigger auto-recharge
      await autoRechargeQueue.add('recharge', {
        organizationId,
        packageCode: org.auto_recharge_package
      });
    }
  },

  /**
   * Purchase credit package
   */
  async purchaseCredits(
    organizationId: string,
    packageCode: string,
    paymentMethodId?: string
  ): Promise<Transaction> {
    // 1. Get package details
    const package = await db.creditPackage.findUnique({
      where: { code: packageCode, is_active: true }
    });

    if (!package) {
      throw new InvalidPackageError(packageCode);
    }

    const org = await db.organization.findUnique({
      where: { id: organizationId }
    });

    // 2. Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(package.final_price_huf * 100), // Convert to fillér
      currency: 'huf',
      customer: org.stripe_customer_id,
      payment_method: paymentMethodId || org.stripe_payment_method_id!,
      confirm: true,
      metadata: {
        organization_id: organizationId,
        package_code: packageCode,
        credits: package.credits,
        type: 'credit_purchase'
      },
      description: `${package.name} - ${package.credits} credits`
    });

    // 3. Create transaction record
    const transaction = await db.transaction.create({
      data: {
        organization_id: organizationId,
        type: 'credit_purchase',
        credits_amount: package.credits,
        balance_before_credits: org.balance_credits,
        balance_after_credits: org.balance_credits + package.credits,
        package_type: packageCode,
        price_huf: package.final_price_huf,
        discount_percent: package.discount_percent,
        payment_provider: 'stripe',
        payment_status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending',
        stripe_payment_intent_id: paymentIntent.id,
        description: `Purchase of ${package.name}`,
        processed_at: paymentIntent.status === 'succeeded' ? new Date() : null
      }
    });

    // 4. Add credits if payment succeeded
    if (paymentIntent.status === 'succeeded') {
      await db.organization.update({
        where: { id: organizationId },
        data: {
          balance_credits: { increment: package.credits },
          billing_status: 'active',
          auto_recharge_package: packageCode // Remember for auto-recharge
        }
      });
    }

    return transaction;
  },

  /**
   * Get available packages
   */
  async getPackages(): Promise<CreditPackage[]> {
    return db.creditPackage.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' }
    });
  },

  /**
   * Calculate savings for package
   */
  calculateSavings(package: CreditPackage): number {
    const baseCost = package.base_price_huf;
    const finalCost = package.final_price_huf;
    return baseCost - finalCost;
  }
};
```

### 2. Invoice Service (Updated)

```typescript
// src/services/invoice.service.ts
export const invoiceService = {
  async create(organizationId: string, data: CreateInvoiceDTO): Promise<Invoice> {
    // 1. Check credits
    const creditCheck = await billingService.checkCredits(organizationId);

    if (!creditCheck.hasCredits) {
      throw new InsufficientCreditsError(
        creditCheck.currentBalance,
        1
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

    // 3. Charge credits (only after successful creation)
    if (data.auto_finalize) {
      await billingService.chargeCredits(organizationId, invoice.id);
    }

    return invoice;
  },

  async finalize(invoiceId: string, organizationId: string): Promise<Invoice> {
    // Check credits before finalizing
    const creditCheck = await billingService.checkCredits(organizationId);

    if (!creditCheck.hasCredits) {
      throw new InsufficientCreditsError(
        creditCheck.currentBalance,
        1
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

    // Charge credits
    await billingService.chargeCredits(organizationId, invoiceId);

    // Submit to NAV
    await navService.submitInvoice(invoice);

    return invoice;
  }
};
```

### 3. Stripe Service (Updated)

```typescript
// src/services/stripe.service.ts
export const stripeService = {
  /**
   * Handle successful payment
   */
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
          stripe_charge_id: paymentIntent.latest_charge as string,
          processed_at: new Date()
        }
      });

      // Add credits
      await tx.organization.update({
        where: { id: transaction.organization_id },
        data: {
          balance_credits: { increment: transaction.credits_amount },
          billing_status: 'active'
        }
      });
    });
  },

  /**
   * Handle payment failure
   */
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
        alert_type: transaction.type === 'credit_purchase'
          ? 'payment_failed'
          : 'auto_recharge_failed',
        severity: 'critical',
        message: 'Credit purchase payment failed. Please update your payment method.',
        metadata: { payment_intent_id: paymentIntent.id }
      }
    });
  }
};
```

## API Endpoints (Updated)

### Get Available Packages

```typescript
GET /api/v1/billing/packages

Response:
{
  "success": true,
  "data": [
    {
      "code": "starter",
      "name": "Starter Package",
      "credits": 10,
      "price_huf": 635,
      "price_per_credit": 63.5,
      "discount_percent": 0,
      "savings_huf": 0
    },
    {
      "code": "basic",
      "name": "Basic Package",
      "credits": 100,
      "price_huf": 6350,
      "price_per_credit": 63.5,
      "discount_percent": 0,
      "savings_huf": 0
    },
    {
      "code": "pro",
      "name": "Pro Package ⭐ Best Value",
      "credits": 1000,
      "price_huf": 50800,
      "price_per_credit": 50.8,
      "discount_percent": 20,
      "savings_huf": 12700,
      "badge": "20% OFF"
    }
  ]
}
```

### Get Balance

```typescript
GET /api/v1/billing/balance

Response:
{
  "success": true,
  "data": {
    "balance_credits": 250,
    "credits_per_invoice": 1,
    "invoices_remaining": 250,
    "last_purchase": {
      "package": "pro",
      "credits": 1000,
      "date": "2025-01-15T10:00:00Z"
    },
    "auto_recharge": {
      "enabled": true,
      "threshold_percent": 20,
      "trigger_at_credits": 200,
      "package": "pro"
    }
  }
}
```

### Purchase Credits

```typescript
POST /api/v1/billing/purchase

Request:
{
  "package_code": "pro",
  "payment_method_id": "pm_xxx" // Optional if already saved
}

Response:
{
  "success": true,
  "data": {
    "transaction_id": "trans_abc123",
    "package": "pro",
    "credits_purchased": 1000,
    "price_paid_huf": 50800,
    "discount_percent": 20,
    "savings_huf": 12700,
    "new_balance": 1250,
    "payment_status": "succeeded"
  }
}
```

### Transaction History

```typescript
GET /api/v1/billing/transactions?page=1&limit=25

Response:
{
  "success": true,
  "data": [
    {
      "id": "trans_1",
      "type": "credit_purchase",
      "credits_amount": 1000,
      "package": "pro",
      "price_huf": 50800,
      "discount_percent": 20,
      "balance_after": 1250,
      "created_at": "2025-01-15T10:00:00Z"
    },
    {
      "id": "trans_2",
      "type": "invoice_charge",
      "credits_amount": -1,
      "invoice_id": "inv_123",
      "balance_after": 1249,
      "created_at": "2025-01-15T11:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

## Benefits of Credit System

### 1. **Simple Mental Model**
```
1 credit = 1 invoice
Easy to understand, easy to communicate
```

### 2. **Flexible Discounts**
```
Instead of: "Pay 50,800 HUF for something worth 63,500 HUF"
Now: "Get 1000 credits for 20% off!"
Much clearer!
```

### 3. **Future Currency Support**
```typescript
// Easy to add USD, EUR later
const packages = {
  HUF: { pro: 50800 },
  USD: { pro: 135 }, // ~$135 for 1000 credits
  EUR: { pro: 125 }  // ~€125 for 1000 credits
};

// Credits remain the same: 1 credit = 1 invoice
```

### 4. **Promotional Campaigns**
```typescript
// Give 50 bonus credits for signup
await givePromotionalCredits(orgId, 50, 'signup_bonus');

// Double credits on Black Friday
await updatePackage('pro', { credits: 2000, price_huf: 50800 });
```

### 5. **Tiered Pricing**
```typescript
// Different orgs can have different credit costs
// Enterprise: 1 credit = 2 invoices
// Agencies: 1 credit = 1.5 invoices
// Small business: 1 credit = 1 invoice

organization.credits_per_invoice = 1; // Standard
organization.credits_per_invoice = 0.5; // VIP (2 invoices per credit!)
```

## Pricing Table (for Marketing)

| Package | Credits | Price | Per Invoice | Savings | Best For |
|---------|---------|-------|-------------|---------|----------|
| 🏁 Starter | 10 | 635 HUF | 63.5 HUF | - | Testing |
| 📦 Basic | 100 | 6,350 HUF | 63.5 HUF | - | Small business |
| ⭐ Pro | 1,000 | 50,800 HUF | 50.8 HUF | **20% off** | High volume |

**Base price**: 50 HUF + 27% VAT = 63.5 HUF
**Pro discount**: 12,700 HUF savings on 1,000 invoices!

## Migration from HUF-based

If you had already implemented HUF-based:

```typescript
// Convert existing HUF balances to credits
async function migrateToCredits() {
  const orgs = await db.organization.findMany({
    where: { balance_huf: { gt: 0 } }
  });

  for (const org of orgs) {
    const credits = Math.floor(org.balance_huf / 63.5);

    await db.organization.update({
      where: { id: org.id },
      data: { balance_credits: credits }
    });
  }
}
```

## Testing

```typescript
describe('Credit System', () => {
  it('should deduct 1 credit per invoice', async () => {
    const org = await createTestOrg({ balance_credits: 100 });

    await invoiceService.create(org.id, invoiceData);

    const updated = await db.organization.findUnique({ where: { id: org.id } });
    expect(updated.balance_credits).toBe(99);
  });

  it('should apply 20% discount on pro package', async () => {
    const proPackage = await db.creditPackage.findUnique({ where: { code: 'pro' } });

    expect(proPackage.credits).toBe(1000);
    expect(proPackage.final_price_huf).toBe(50800);
    expect(proPackage.discount_percent).toBe(20);

    const savings = proPackage.base_price_huf - proPackage.final_price_huf;
    expect(savings).toBe(12700);
  });

  it('should trigger auto-recharge at 20% threshold', async () => {
    const org = await createTestOrg({
      balance_credits: 200,
      auto_recharge_enabled: true,
      auto_recharge_threshold_percent: 20,
      auto_recharge_package: 'pro'
    });

    // Last purchase was 1000 credits, so threshold is 200
    await invoiceService.create(org.id, invoiceData); // Balance now 199

    // Verify auto-recharge job was queued
    expect(autoRechargeQueue.add).toHaveBeenCalledWith('recharge', {
      organizationId: org.id,
      packageCode: 'pro'
    });
  });
});
```

## Next Steps

1. ✅ Update database schema with credit tables
2. ✅ Implement credit-based billing service
3. ✅ Update API endpoints
4. ✅ Seed credit packages
5. ✅ Update frontend to show credits
6. ✅ Marketing page showing package comparison

---

**Much better design!** Credits make everything simpler and more flexible. 🎯
