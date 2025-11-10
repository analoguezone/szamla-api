# Billing System: HUF vs Credits Comparison

## Summary: Why Credits Won

Your suggestion to use credits instead of HUF amounts is **much better**! Here's why:

## Side-by-Side Comparison

| Aspect | HUF-Based (v1) | Credit-Based (v2) ✅ |
|--------|----------------|---------------------|
| **Mental Model** | "You have 6,350 HUF" | "You have 100 credits" ✨ |
| **Per Invoice** | "63.5 HUF (50+VAT)" | "1 credit" ✨ |
| **Discounts** | "20% off, pay 50,800 HUF instead of 63,500" | "1000 credits for 20% off!" ✨ |
| **Future Currencies** | Need to convert everything | Credits stay same, just change HUF/USD/EUR price ✨ |
| **Promotional Credits** | "Add 3,175 HUF bonus" | "Add 50 bonus credits" ✨ |
| **Pricing Display** | Complex with VAT | Simple: 1 credit = 1 invoice ✨ |
| **Database Queries** | DECIMAL comparisons | INTEGER comparisons (faster) ✨ |
| **Reporting** | Currency conversions | Count credits (simpler) ✨ |
| **Tiered Pricing** | Change HUF amounts | Just change credits_per_invoice ✨ |

## Credit Packages

### Package Structure

| Package | Credits | Price (HUF) | Per Credit | Discount | Savings |
|---------|---------|-------------|------------|----------|---------|
| **Starter** | 10 | 635 HUF | 63.5 HUF | 0% | - |
| **Basic** | 100 | 6,350 HUF | 63.5 HUF | 0% | - |
| **Pro** ⭐ | 1,000 | 50,800 HUF | 50.8 HUF | **20%** | **12,700 HUF** |

### Why This Works Better

**Old way (HUF-based)**:
```typescript
// Check balance
if (org.balance_huf >= 63.5) { ... }

// Confusing: Why 63.5? Need to calculate VAT each time
// Hard to explain discounts
// Currency-dependent
```

**New way (Credits)**:
```typescript
// Check balance
if (org.balance_credits >= 1) { ... }

// Clear: 1 credit = 1 invoice
// Discounts are in package pricing
// Currency-agnostic
```

## User Experience Improvements

### Dashboard Display

**Before (HUF)**:
```
Your Balance: 6,350 HUF
Price per invoice: 63.5 HUF
Invoices remaining: ~100
```

**After (Credits)**:
```
Credits: 100
Invoices remaining: 100
(1 credit = 1 invoice)
```

### Purchase Flow

**Before (HUF)**:
```
Topup Amount: ___ HUF
(Minimum 635 HUF = 10 invoices)

At 63.5 HUF per invoice:
- 6,350 HUF = ~100 invoices
- 63,500 HUF = ~1000 invoices (no discount!)
```

**After (Credits)**:
```
Choose Package:
○ Starter: 10 credits - 635 HUF
○ Basic: 100 credits - 6,350 HUF
● Pro: 1,000 credits - 50,800 HUF [20% OFF! Save 12,700 HUF]
```

## Technical Benefits

### 1. Database Performance

```sql
-- Old (HUF): DECIMAL comparisons
SELECT * FROM organizations WHERE balance_huf >= 63.5;

-- New (Credits): INTEGER comparisons (faster!)
SELECT * FROM organizations WHERE balance_credits >= 1;
```

### 2. Simpler Calculations

```typescript
// Old (HUF): Need to calculate VAT every time
const cost = 50 * 1.27; // 63.5 HUF
if (balance >= cost) { ... }

// New (Credits): Simple integer
const cost = 1; // 1 credit
if (balance >= cost) { ... }
```

### 3. Future Multi-Currency

```typescript
// Credits system makes this trivial:
const packages = {
  pro: {
    credits: 1000,
    prices: {
      HUF: 50800,
      USD: 135,
      EUR: 125
    }
  }
};

// User pays in their currency, gets same credits
// No conversion logic needed in the core system!
```

### 4. Promotional Campaigns

```typescript
// Old (HUF): Awkward
"Get 3,175 HUF bonus on your first purchase!"
// How many invoices is that? User needs to calculate

// New (Credits): Clear
"Get 50 bonus credits on signup!"
// = 50 invoices, immediately clear
```

### 5. Tiered Pricing (Future)

```typescript
// VIP customers: 2 invoices per credit
org.credits_per_invoice = 0.5;

// Enterprise bulk: 1.5 invoices per credit
org.credits_per_invoice = 0.67;

// Standard: 1 invoice per credit
org.credits_per_invoice = 1.0;

// Same credit balance, different value per customer tier!
```

## Auto-Recharge Logic

### Old (HUF)
```typescript
// Complicated: What's 20% of last purchase in HUF?
const lastPurchaseHUF = 50800;
const threshold = lastPurchaseHUF * 0.2; // 10,160 HUF
if (balance_huf < threshold) {
  recharge(50800); // Recharge same HUF amount
}
```

### New (Credits)
```typescript
// Simple: Track credits purchased
const lastPurchaseCredits = 1000;
const threshold = lastPurchaseCredits * 0.2; // 200 credits
if (balance_credits < threshold) {
  recharge('pro'); // Recharge same package
}
```

## Marketing Benefits

### Pricing Page Copy

**Old (HUF-based)**:
```
Pay 50,800 HUF and get 1,000 invoices!
(Regular price: 63,500 HUF - Save 12,700 HUF!)

Base: 50 HUF + 27% VAT = 63.5 HUF per invoice
With discount: 50.8 HUF per invoice

Confusing! Too many numbers!
```

**New (Credits)**:
```
Pro Package: 1,000 Credits
Regular: 63,500 HUF
Special: 50,800 HUF
YOU SAVE: 12,700 HUF (20% OFF!)

1 credit = 1 invoice
Clear and simple!
```

## Migration Path

If we had HUF-based system already:

```typescript
// Simple conversion
async function migrateToCredits() {
  const CREDIT_VALUE_HUF = 63.5;

  const orgs = await db.organization.findMany();

  for (const org of orgs) {
    const credits = Math.floor(org.balance_huf / CREDIT_VALUE_HUF);

    await db.organization.update({
      where: { id: org.id },
      data: {
        balance_credits: credits,
        balance_huf: 0 // Clear old field
      }
    });

    console.log(`Migrated ${org.name}: ${org.balance_huf} HUF → ${credits} credits`);
  }
}
```

## Real-World Examples

### Scenario 1: Small Business

**User**: "I need to send about 50 invoices per month"

**HUF System Response**:
"That will cost you 3,175 HUF per month (50 × 63.5 HUF)"
*Math required, VAT confusing*

**Credit System Response**:
"You need 50 credits per month. Get the Basic package (100 credits) for 6,350 HUF - 2 months covered!"
*Clear and simple*

### Scenario 2: Agency with Variable Load

**User**: "Some months I send 200 invoices, some months 50. What's the best option?"

**HUF System Response**:
"Set auto-recharge to 12,700 HUF when your balance drops below 2,540 HUF"
*Confusing numbers*

**Credit System Response**:
"Get the Pro package (1,000 credits with 20% discount). Set auto-recharge at 20% (200 credits). You'll save money on high-volume months!"
*Clear strategy*

### Scenario 3: Promotional Campaign

**Marketing wants**: "Let's give new users some free invoices!"

**HUF System**:
"Give them 1,270 HUF credit"
*How many invoices? Not immediately clear*

**Credit System**:
"Give them 20 free credits = 20 free invoices"
*Perfectly clear, great marketing message*

## Database Schema Changes

### Organizations Table

```sql
-- Remove
balance_huf DECIMAL(15, 2)
price_per_invoice_huf DECIMAL(10, 2)

-- Add
balance_credits INTEGER NOT NULL DEFAULT 0
credits_per_invoice INTEGER NOT NULL DEFAULT 1
```

### Transactions Table

```sql
-- Remove
amount_huf DECIMAL(15, 2)
balance_before_huf DECIMAL(15, 2)
balance_after_huf DECIMAL(15, 2)

-- Add
credits_amount INTEGER NOT NULL
balance_before_credits INTEGER NOT NULL
balance_after_credits INTEGER NOT NULL
price_huf DECIMAL(10, 2) -- Only for purchase transactions
package_type VARCHAR(20) -- starter, basic, pro
```

### New Tables

```sql
-- Credit packages (configurable pricing)
CREATE TABLE credit_packages (
  code VARCHAR(20) PRIMARY KEY,
  credits INTEGER NOT NULL,
  price_huf DECIMAL(10, 2) NOT NULL,
  discount_percent INTEGER DEFAULT 0
);

-- Promotional credits (future campaigns)
CREATE TABLE promotional_credits (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  credits_granted INTEGER NOT NULL,
  promo_code VARCHAR(50)
);
```

## Implementation Complexity

### HUF-Based: ⭐⭐⭐ (Medium)
- Need to calculate VAT everywhere
- DECIMAL precision concerns
- Currency conversion logic for future
- Complex discount calculations

### Credit-Based: ⭐ (Simple!)
- Integer operations only
- No VAT in core logic (only at purchase)
- Discounts in package definitions
- Easy to add features later

## Cost for You (as Service Provider)

Both systems have same revenue:

**1,000 invoices at full price**:
- HUF: 1,000 × 63.5 = 63,500 HUF
- Credits: 1,000 credits × 63.5 HUF = 63,500 HUF ✅

**1,000 invoices with Pro package (20% off)**:
- HUF: 1,000 × 50.8 = 50,800 HUF
- Credits: 1,000 credits = 50,800 HUF ✅

Same revenue, better UX!

## Recommendation

✅ **Use Credit System (v2)**

**Reasons**:
1. ✅ **Simpler mental model** for users
2. ✅ **Better marketing** (clearer packages, discounts)
3. ✅ **Easier implementation** (integer math)
4. ✅ **More flexible** (promos, tiers, currencies)
5. ✅ **Professional** (how SaaS companies do it: Twilio, SendGrid, AWS all use credits/units)
6. ✅ **Future-proof** (easy to add features)

**Industry Examples**:
- Twilio: Credits for SMS/calls
- SendGrid: Credits for emails
- AWS: Credits for services
- OpenAI: Credits (tokens) for API calls

**Documentation**:
- ✅ Created: `docs/BILLING_SYSTEM_V2.md` (credit-based)
- ⚠️ Deprecated: `docs/BILLING_SYSTEM.md` (HUF-based, for reference)

---

**Your suggestion was spot on! Credits are the way to go.** 🎯
