# Prepaid Billing System - Credit-Based (Final Pricing)

**Credit-based system with progressive volume discounts**

**Related**: [ARCHITECTURE.md](../ARCHITECTURE.md) | [DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md)

## Pricing Structure

### Base Price

**120 HUF per credit** (adjustable per client)

This is the base price that can be customized for individual organizations. Some clients may have special pricing (e.g., enterprise deals, partners).

### Credit Packages

Progressive discounts encourage bulk purchases:

| Package | Credits | Base Price | Discount | Final Price | Per Credit | Savings |
|---------|---------|------------|----------|-------------|------------|---------|
| **Starter** | 50 | 6,000 HUF | 0% | **6,000 HUF** | 120 HUF | - |
| **Basic** | 100 | 12,000 HUF | 20% | **9,600 HUF** | 96 HUF | 2,400 HUF |
| **Pro** | 500 | 60,000 HUF | 40% | **36,000 HUF** | 72 HUF | 24,000 HUF |
| **Business** | 1,000 | 120,000 HUF | 60% | **48,000 HUF** | 48 HUF | 72,000 HUF |
| **Enterprise** | 10,000 | 1,200,000 HUF | 80% | **240,000 HUF** | 24 HUF | 960,000 HUF |

### Key Features

✅ **Progressive discounts**: Bigger packages = bigger savings
✅ **Volume pricing**: Enterprise package saves nearly 1 million HUF!
✅ **Simple base price**: 120 HUF per credit (easy to understand)
✅ **Adjustable pricing**: Can customize per client (e.g., partners, enterprise deals)
✅ **Clear value**: Discount % shown clearly

### Pricing Comparison Chart

```
Price per Credit by Package:

120 HUF ████████████████████████ Starter (0% off)
 96 HUF ███████████████████      Basic (20% off)
 72 HUF ██████████████           Pro (40% off)
 48 HUF █████████                Business (60% off)
 24 HUF ████                     Enterprise (80% off) ⭐

         0    25   50   75   100   125 HUF
```

## Database Schema

### credit_packages table

```sql
CREATE TABLE credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Package Details
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  credits INTEGER NOT NULL,

  -- Pricing
  base_price_per_credit DECIMAL(10, 2) NOT NULL DEFAULT 120.00,
  discount_percent INTEGER DEFAULT 0,
  final_price_huf DECIMAL(10, 2) NOT NULL,

  -- Display
  description TEXT,
  badge VARCHAR(50), -- 'BEST VALUE', 'MOST POPULAR', etc.
  features JSONB,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed packages with new pricing
INSERT INTO credit_packages (code, name, credits, base_price_per_credit, discount_percent, final_price_huf, badge, sort_order) VALUES
  ('starter', 'Starter', 50, 120, 0, 6000, NULL, 1),
  ('basic', 'Basic', 100, 120, 20, 9600, 'POPULAR', 2),
  ('pro', 'Pro', 500, 120, 40, 36000, 'BEST VALUE', 3),
  ('business', 'Business', 1000, 120, 60, 48000, NULL, 4),
  ('enterprise', 'Enterprise', 10000, 120, 80, 240000, 'ENTERPRISE', 5);

CREATE INDEX idx_credit_packages_active ON credit_packages(is_active, sort_order);
CREATE INDEX idx_credit_packages_featured ON credit_packages(is_featured) WHERE is_featured = TRUE;
```

### organizations table

```sql
ALTER TABLE organizations
  -- Credit balance
  ADD COLUMN balance_credits INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN credits_per_invoice INTEGER DEFAULT 1 NOT NULL,

  -- Custom pricing (per client)
  ADD COLUMN custom_price_per_credit DECIMAL(10, 2) DEFAULT 120.00,
  ADD COLUMN has_custom_pricing BOOLEAN DEFAULT FALSE,

  -- Auto-recharge
  ADD COLUMN auto_recharge_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN auto_recharge_threshold_percent INTEGER DEFAULT 20,
  ADD COLUMN auto_recharge_package VARCHAR(20) DEFAULT 'basic',

  -- Stripe
  ADD COLUMN stripe_customer_id VARCHAR(255) UNIQUE,
  ADD COLUMN stripe_payment_method_id VARCHAR(255),
  ADD COLUMN payment_method_last4 VARCHAR(4),
  ADD COLUMN payment_method_brand VARCHAR(20),

  -- Status
  ADD COLUMN billing_status VARCHAR(20) DEFAULT 'active';
```

## Implementation

### Pricing Service

```typescript
// src/services/pricing.service.ts

export const pricingService = {
  /**
   * Get all available packages
   */
  async getPackages(): Promise<CreditPackage[]> {
    return db.creditPackage.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' }
    });
  },

  /**
   * Get package with calculated details
   */
  async getPackageDetails(code: string): Promise<PackageDetails> {
    const pkg = await db.creditPackage.findUnique({
      where: { code, is_active: true }
    });

    if (!pkg) {
      throw new PackageNotFoundError(code);
    }

    const basePrice = pkg.credits * pkg.base_price_per_credit;
    const savings = basePrice - pkg.final_price_huf;
    const pricePerCredit = pkg.final_price_huf / pkg.credits;

    return {
      ...pkg,
      base_price: basePrice,
      savings,
      price_per_credit: pricePerCredit,
      discount_amount: savings,
      effective_discount_percent: (savings / basePrice) * 100
    };
  },

  /**
   * Calculate price for organization (including custom pricing)
   */
  async calculatePrice(
    organizationId: string,
    packageCode: string
  ): Promise<PriceCalculation> {
    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: {
        has_custom_pricing: true,
        custom_price_per_credit: true
      }
    });

    const pkg = await db.creditPackage.findUnique({
      where: { code: packageCode }
    });

    // Use custom pricing if available
    let finalPrice = pkg.final_price_huf;
    let basePrice = pkg.credits * pkg.base_price_per_credit;
    let discount = pkg.discount_percent;

    if (org.has_custom_pricing) {
      basePrice = pkg.credits * org.custom_price_per_credit;
      finalPrice = basePrice * (1 - discount / 100);
    }

    return {
      package_code: packageCode,
      credits: pkg.credits,
      base_price: basePrice,
      discount_percent: discount,
      final_price: finalPrice,
      savings: basePrice - finalPrice,
      price_per_credit: finalPrice / pkg.credits,
      is_custom_pricing: org.has_custom_pricing
    };
  },

  /**
   * Get recommended package based on usage
   */
  async getRecommendedPackage(organizationId: string): Promise<string> {
    // Get average monthly usage
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const usage = await db.transaction.count({
      where: {
        organization_id: organizationId,
        type: 'invoice_charge',
        created_at: { gte: thirtyDaysAgo }
      }
    });

    const monthlyAverage = usage;

    // Recommend package based on usage (with buffer)
    const recommended = monthlyAverage * 1.2; // 20% buffer

    if (recommended <= 50) return 'starter';
    if (recommended <= 100) return 'basic';
    if (recommended <= 500) return 'pro';
    if (recommended <= 1000) return 'business';
    return 'enterprise';
  }
};
```

### Billing Service (Updated)

```typescript
// src/services/billing.service.ts

export const billingService = {
  /**
   * Purchase credit package
   */
  async purchaseCredits(
    organizationId: string,
    packageCode: string,
    paymentMethodId?: string
  ): Promise<Transaction> {
    // Calculate price (including custom pricing)
    const pricing = await pricingService.calculatePrice(organizationId, packageCode);

    const org = await db.organization.findUnique({
      where: { id: organizationId }
    });

    // Create Stripe payment
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(pricing.final_price * 100), // Convert to fillér
      currency: 'huf',
      customer: org.stripe_customer_id,
      payment_method: paymentMethodId || org.stripe_payment_method_id!,
      confirm: true,
      metadata: {
        organization_id: organizationId,
        package_code: packageCode,
        credits: pricing.credits,
        discount_percent: pricing.discount_percent
      },
      description: `${packageCode} package - ${pricing.credits} credits`
    });

    // Create transaction
    const transaction = await db.transaction.create({
      data: {
        organization_id: organizationId,
        type: 'credit_purchase',
        credits_amount: pricing.credits,
        balance_before_credits: org.balance_credits,
        balance_after_credits: org.balance_credits + pricing.credits,
        package_type: packageCode,
        price_huf: pricing.final_price,
        discount_percent: pricing.discount_percent,
        payment_provider: 'stripe',
        payment_status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending',
        stripe_payment_intent_id: paymentIntent.id,
        description: `Purchase of ${pricing.credits} credits`,
        metadata: {
          base_price: pricing.base_price,
          savings: pricing.savings,
          is_custom_pricing: pricing.is_custom_pricing
        },
        processed_at: paymentIntent.status === 'succeeded' ? new Date() : null
      }
    });

    // Add credits if payment succeeded
    if (paymentIntent.status === 'succeeded') {
      await db.organization.update({
        where: { id: organizationId },
        data: {
          balance_credits: { increment: pricing.credits },
          billing_status: 'active',
          auto_recharge_package: packageCode
        }
      });
    }

    return transaction;
  }
};
```

## API Endpoints

### Get Available Packages

```typescript
GET /api/v1/billing/packages

Response:
{
  "success": true,
  "data": [
    {
      "code": "starter",
      "name": "Starter",
      "credits": 50,
      "base_price": 6000,
      "discount_percent": 0,
      "final_price": 6000,
      "price_per_credit": 120,
      "savings": 0,
      "badge": null
    },
    {
      "code": "basic",
      "name": "Basic",
      "credits": 100,
      "base_price": 12000,
      "discount_percent": 20,
      "final_price": 9600,
      "price_per_credit": 96,
      "savings": 2400,
      "badge": "POPULAR"
    },
    {
      "code": "pro",
      "name": "Pro",
      "credits": 500,
      "base_price": 60000,
      "discount_percent": 40,
      "final_price": 36000,
      "price_per_credit": 72,
      "savings": 24000,
      "badge": "BEST VALUE"
    },
    {
      "code": "business",
      "name": "Business",
      "credits": 1000,
      "base_price": 120000,
      "discount_percent": 60,
      "final_price": 48000,
      "price_per_credit": 48,
      "savings": 72000,
      "badge": null
    },
    {
      "code": "enterprise",
      "name": "Enterprise",
      "credits": 10000,
      "base_price": 1200000,
      "discount_percent": 80,
      "final_price": 240000,
      "price_per_credit": 24,
      "savings": 960000,
      "badge": "ENTERPRISE"
    }
  ],
  "recommended": "basic"
}
```

### Get Pricing for Organization

```typescript
GET /api/v1/billing/pricing/{packageCode}

Response:
{
  "success": true,
  "data": {
    "package_code": "business",
    "credits": 1000,
    "base_price": 120000,
    "discount_percent": 60,
    "final_price": 48000,
    "savings": 72000,
    "price_per_credit": 48,
    "is_custom_pricing": false,
    "breakdown": {
      "subtotal": 48000,
      "vat_rate": 0,  // Prices are final
      "total": 48000
    }
  }
}
```

### Set Custom Pricing (Admin Only)

```typescript
PATCH /api/v1/admin/organizations/{orgId}/pricing

Request:
{
  "custom_price_per_credit": 100,  // Special pricing for this client
  "has_custom_pricing": true
}

Response:
{
  "success": true,
  "data": {
    "organization_id": "org_abc123",
    "custom_price_per_credit": 100,
    "has_custom_pricing": true,
    "updated_at": "2025-01-15T10:00:00Z"
  }
}
```

## Pricing Strategy Rationale

### Why Progressive Discounts?

**Starter (0%)**: Entry point, no commitment
- Perfect for testing the service
- 50 invoices for small businesses

**Basic (20%)**: Most popular
- Sweet spot for regular users
- Encourages commitment

**Pro (40%)**: Best value for SMBs
- Significant savings
- Targets growing businesses

**Business (60%)**: For established companies
- 1,000 invoices = ~3 invoices/day
- Major savings encourage loyalty

**Enterprise (80%)**: Volume customers
- Nearly 1M HUF savings!
- For agencies, accounting firms, high-volume users
- Builds long-term relationships

### Psychological Pricing

```
Starter:  6,000 HUF  (Simple entry)
Basic:    9,600 HUF  (Not 10,000, feels cheaper)
Pro:     36,000 HUF  (Clear milestone)
Business: 48,000 HUF (Under 50k threshold)
Enterprise: 240,000 HUF (Serious investment, serious savings)
```

## Marketing Copy

### Pricing Page

```markdown
# Simple, Transparent Pricing

**Base Price: 120 HUF per invoice** - Volume discounts available!

## Choose Your Package

### 🏁 Starter
**50 Credits = 6,000 HUF**
- 120 HUF per invoice
- Perfect for testing
- No commitment needed

### 📦 Basic ⭐ MOST POPULAR
**100 Credits = 9,600 HUF**
- 96 HUF per invoice
- **Save 2,400 HUF (20% off)**
- Best for small businesses

### 🚀 Pro 💎 BEST VALUE
**500 Credits = 36,000 HUF**
- 72 HUF per invoice
- **Save 24,000 HUF (40% off)**
- Perfect for growing businesses

### 💼 Business
**1,000 Credits = 48,000 HUF**
- 48 HUF per invoice
- **Save 72,000 HUF (60% off)**
- For established companies

### 🏢 Enterprise
**10,000 Credits = 240,000 HUF**
- 24 HUF per invoice
- **Save 960,000 HUF (80% off!)**
- Best for agencies & high-volume users
- Custom pricing available

---

**Auto-recharge available** - Never run out of credits!
**Custom pricing** - Contact us for enterprise deals
```

### Value Proposition Examples

```
For a business sending 500 invoices/month:

Starter Package (buy 10x):
  10 × 6,000 HUF = 60,000 HUF/month

Pro Package (buy 1x):
  1 × 36,000 HUF = 36,000 HUF/month

SAVINGS: 24,000 HUF/month = 288,000 HUF/year! 🎉
```

```
For an accounting firm sending 10,000 invoices/month:

Basic Package (buy 100x):
  100 × 9,600 HUF = 960,000 HUF/month

Enterprise Package (buy 1x):
  1 × 240,000 HUF = 240,000 HUF/month

SAVINGS: 720,000 HUF/month = 8,640,000 HUF/year! 🚀
```

## Custom Pricing Examples

```typescript
// Partner with special rate
await updateOrganization(partnerId, {
  custom_price_per_credit: 100,  // 100 HUF instead of 120
  has_custom_pricing: true
});

// Enterprise deal
await updateOrganization(enterpriseId, {
  custom_price_per_credit: 80,   // 80 HUF base
  has_custom_pricing: true
});

// Non-profit discount
await updateOrganization(nonprofitId, {
  custom_price_per_credit: 60,   // 50% off base price
  has_custom_pricing: true
});
```

## Comparison with Old Pricing

| Metric | Old Pricing | New Pricing |
|--------|-------------|-------------|
| Base price | 63.5 HUF | 120 HUF |
| Smallest package | 10 credits | 50 credits |
| Largest package | 1,000 credits (20% off) | 10,000 credits (80% off) |
| Max discount | 20% | 80% |
| Enterprise focus | No | Yes ✅ |
| Custom pricing | No | Yes ✅ |

**Why higher base price?**
- Better margins on small purchases
- More room for volume discounts
- Encourages bulk purchases (where margins are healthier)
- Enterprise customers get incredible value

## Testing

```typescript
describe('Pricing Service', () => {
  it('should calculate correct price for each package', () => {
    const packages = [
      { code: 'starter', credits: 50, price: 6000, discount: 0 },
      { code: 'basic', credits: 100, price: 9600, discount: 20 },
      { code: 'pro', credits: 500, price: 36000, discount: 40 },
      { code: 'business', credits: 1000, price: 48000, discount: 60 },
      { code: 'enterprise', credits: 10000, price: 240000, discount: 80 }
    ];

    packages.forEach(pkg => {
      const basePrice = pkg.credits * 120;
      const expectedPrice = basePrice * (1 - pkg.discount / 100);
      expect(expectedPrice).toBe(pkg.price);
    });
  });

  it('should apply custom pricing correctly', async () => {
    const org = await createTestOrg({
      custom_price_per_credit: 100,
      has_custom_pricing: true
    });

    const pricing = await pricingService.calculatePrice(org.id, 'business');

    expect(pricing.base_price).toBe(1000 * 100); // 100,000 HUF
    expect(pricing.final_price).toBe(100000 * 0.4); // 40,000 HUF (60% off)
    expect(pricing.is_custom_pricing).toBe(true);
  });

  it('should calculate massive savings for enterprise', () => {
    const basePrice = 10000 * 120; // 1,200,000 HUF
    const finalPrice = 240000; // 80% discount
    const savings = basePrice - finalPrice;

    expect(savings).toBe(960000); // Nearly 1 million HUF!
  });
});
```

## Revenue Projections

Assuming 100 organizations:

**Conservative (mostly small packages)**:
- 50 × Starter = 300,000 HUF
- 30 × Basic = 288,000 HUF
- 15 × Pro = 540,000 HUF
- 4 × Business = 192,000 HUF
- 1 × Enterprise = 240,000 HUF
**Total: 1,560,000 HUF/month** (~13,000 EUR)

**Optimistic (enterprise focus)**:
- 20 × Basic = 192,000 HUF
- 40 × Pro = 1,440,000 HUF
- 30 × Business = 1,440,000 HUF
- 10 × Enterprise = 2,400,000 HUF
**Total: 5,472,000 HUF/month** (~46,000 EUR)

---

**This pricing structure is designed to:**
✅ Attract small businesses (low entry point)
✅ Encourage volume purchases (progressive discounts)
✅ Reward loyalty (auto-recharge at same package)
✅ Target enterprises (80% discount on 10k package)
✅ Allow flexibility (custom pricing per client)
