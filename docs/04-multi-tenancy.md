# Multi-tenancy Guide

Understanding organization isolation and data scoping.

**Related docs**: [Authentication](./05-authentication.md) | [Database Guide](./06-database.md) | [Security](./15-production.md)

## Overview

The Számlázó NAV API is a **multi-tenant SaaS** application where:
- Each **organization** (tenant) operates in complete isolation
- Organizations have their own NAV credentials
- Data is strictly segregated at the database level
- Each organization has independent API keys

## Architecture

### Tenant Identification

Every request is scoped to an organization via API key:

```
Request → API Key → Organization ID → Scoped Data Access
```

### Data Isolation Strategy

**Row-Level Security**: Every tenant-scoped table has an `organization_id` column.

```sql
-- All queries automatically filtered
SELECT * FROM invoices
WHERE organization_id = '<current-org-id>';
```

## Implementation

### 1. Middleware Flow

```typescript
// src/middleware/auth.middleware.ts
export async function authMiddleware(req, res, next) {
  // 1. Extract API key from Authorization header
  const apiKey = req.headers.authorization?.replace('Bearer ', '');

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing API key' });
  }

  // 2. Validate and retrieve organization
  const apiKeyRecord = await db.apiKey.findFirst({
    where: {
      key_hash: hashApiKey(apiKey),
      is_active: true,
      revoked_at: null
    },
    include: { organization: true }
  });

  if (!apiKeyRecord) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // 3. Attach organization to request
  req.organizationId = apiKeyRecord.organization_id;
  req.organization = apiKeyRecord.organization;
  req.apiKeyId = apiKeyRecord.id;

  next();
}
```

### 2. Service Layer Scoping

**Always** pass `organizationId` to service methods:

```typescript
// src/controllers/invoice.controller.ts
export const invoiceController = {
  async list(req: Request, res: Response) {
    const { organizationId } = req; // From auth middleware

    const invoices = await invoiceService.list(organizationId, {
      page: req.query.page,
      limit: req.query.limit
    });

    return successResponse(res, invoices);
  }
};

// src/services/invoice.service.ts
export const invoiceService = {
  async list(organizationId: string, options: ListOptions) {
    return db.invoice.findMany({
      where: {
        organization_id: organizationId, // ALWAYS filter by org
        deleted_at: null
      },
      skip: (options.page - 1) * options.limit,
      take: options.limit,
      orderBy: { created_at: 'desc' }
    });
  },

  async get(organizationId: string, invoiceId: string) {
    const invoice = await db.invoice.findFirst({
      where: {
        id: invoiceId,
        organization_id: organizationId // Prevent access to other orgs
      }
    });

    if (!invoice) {
      throw new InvoiceNotFoundError(invoiceId);
    }

    return invoice;
  }
};
```

### 3. Database Queries

**❌ Wrong - No organization filter:**
```typescript
// SECURITY RISK: Returns data from all organizations!
const invoice = await db.invoice.findUnique({
  where: { id: invoiceId }
});
```

**✅ Correct - Always filter by organization:**
```typescript
const invoice = await db.invoice.findFirst({
  where: {
    id: invoiceId,
    organization_id: organizationId
  }
});
```

### 4. Creating Records

**Always** set `organization_id` when creating:

```typescript
async function createInvoice(organizationId: string, data: CreateInvoiceDTO) {
  return db.invoice.create({
    data: {
      organization_id: organizationId, // Required
      partner_id: data.partnerId,
      issue_date: data.issueDate,
      // ...
    }
  });
}
```

### 5. Joins and Relations

When joining tables, ensure both tables filter by organization:

```typescript
async function getInvoiceWithPartner(organizationId: string, invoiceId: string) {
  return db.invoice.findFirst({
    where: {
      id: invoiceId,
      organization_id: organizationId
    },
    include: {
      partner: {
        where: {
          organization_id: organizationId // Also filter related tables
        }
      },
      items: true
    }
  });
}
```

## Organization-Specific Features

### NAV Credentials

Each organization has its own NAV credentials:

```typescript
async function submitToNav(organizationId: string, invoice: Invoice) {
  // 1. Get organization's NAV credentials
  const org = await db.organization.findUnique({
    where: { id: organizationId }
  });

  // 2. Decrypt credentials
  const navCredentials = {
    login: org.nav_login,
    password: decrypt(org.nav_password_encrypted),
    taxNumber: org.tax_number,
    signatureKey: decrypt(org.nav_signature_key_encrypted),
    exchangeKey: decrypt(org.nav_exchange_key_encrypted)
  };

  // 3. Create NAV client for this organization
  const navClient = new NavConnector({
    user: navCredentials,
    software: {
      softwareId: org.software_id,
      softwareName: org.software_name,
      // ...
    }
  });

  // 4. Submit invoice
  return navClient.manageInvoice({ ... });
}
```

### Invoice Numbering

Each organization has independent invoice numbering:

```typescript
async function generateInvoiceNumber(organizationId: string): Promise<string> {
  // Get organization settings
  const org = await db.organization.findUnique({
    where: { id: organizationId }
  });

  // Atomically increment and get next number
  const updated = await db.organization.update({
    where: { id: organizationId },
    data: {
      next_invoice_number: { increment: 1 }
    },
    select: { next_invoice_number: true, invoice_prefix: true }
  });

  const number = updated.next_invoice_number - 1;
  const year = new Date().getFullYear();

  // Format: PREFIX-YYYY-00001
  return `${updated.invoice_prefix}-${year}-${String(number).padStart(5, '0')}`;
}
```

## Testing Multi-tenancy

### Test Isolation

Always test that organizations cannot access each other's data:

```typescript
describe('Invoice Multi-tenancy', () => {
  let org1: Organization;
  let org2: Organization;
  let invoice1: Invoice;
  let invoice2: Invoice;

  beforeEach(async () => {
    // Create two separate organizations
    org1 = await createTestOrg({ name: 'Org 1' });
    org2 = await createTestOrg({ name: 'Org 2' });

    // Create invoices for each
    invoice1 = await createTestInvoice({ organization_id: org1.id });
    invoice2 = await createTestInvoice({ organization_id: org2.id });
  });

  it('should not allow org1 to access org2 invoices', async () => {
    const result = await invoiceService.get(org1.id, invoice2.id);

    expect(result).toBeNull();
  });

  it('should only return invoices for the specified org', async () => {
    const invoices = await invoiceService.list(org1.id);

    expect(invoices).toHaveLength(1);
    expect(invoices[0].id).toBe(invoice1.id);
    expect(invoices.some(i => i.id === invoice2.id)).toBe(false);
  });
});
```

## Common Pitfalls

### ❌ Pitfall 1: Forgetting Organization Filter

```typescript
// WRONG
async function getInvoice(invoiceId: string) {
  return db.invoice.findUnique({ where: { id: invoiceId } });
}

// RIGHT
async function getInvoice(organizationId: string, invoiceId: string) {
  return db.invoice.findFirst({
    where: { id: invoiceId, organization_id: organizationId }
  });
}
```

### ❌ Pitfall 2: Using Unique Queries

```typescript
// WRONG - findUnique doesn't support organization_id filter
const invoice = await db.invoice.findUnique({
  where: {
    id: invoiceId,
    organization_id: organizationId // TypeScript error!
  }
});

// RIGHT - Use findFirst instead
const invoice = await db.invoice.findFirst({
  where: {
    id: invoiceId,
    organization_id: organizationId
  }
});
```

### ❌ Pitfall 3: Cross-Organization References

```typescript
// WRONG - Partner from org1, invoice from org2
await db.invoice.create({
  data: {
    organization_id: org1.id,
    partner_id: partnerFromOrg2.id // SECURITY BUG!
  }
});

// RIGHT - Validate partner belongs to same org
const partner = await db.partner.findFirst({
  where: {
    id: partnerId,
    organization_id: organizationId
  }
});

if (!partner) {
  throw new PartnerNotFoundError();
}

await db.invoice.create({
  data: {
    organization_id: organizationId,
    partner_id: partner.id
  }
});
```

## Database-Level Enforcement

### Row-Level Security (PostgreSQL)

For additional security, implement PostgreSQL RLS:

```sql
-- Enable RLS on invoices table
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY organization_isolation ON invoices
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Set organization context
SET app.current_organization_id = 'org_abc123';
```

Then in your application:

```typescript
async function executeWithOrgContext<T>(
  organizationId: string,
  callback: () => Promise<T>
): Promise<T> {
  await db.$executeRaw`SET app.current_organization_id = ${organizationId}`;
  const result = await callback();
  await db.$executeRaw`RESET app.current_organization_id`;
  return result;
}
```

## File Storage Isolation

Organize files by organization:

```
storage/
└── organizations/
    ├── org_abc123/
    │   └── invoices/
    │       └── 2025/
    │           ├── inv_001.pdf
    │           └── inv_001_nav.xml
    └── org_def456/
        └── invoices/
            └── 2025/
                └── inv_001.pdf  # Same filename, different org
```

```typescript
function getInvoiceFilePath(organizationId: string, invoiceId: string, type: 'pdf' | 'xml'): string {
  const year = new Date().getFullYear();
  const ext = type === 'pdf' ? '.pdf' : '_nav.xml';

  return path.join(
    config.storagePath,
    'organizations',
    organizationId,
    'invoices',
    String(year),
    `${invoiceId}${ext}`
  );
}
```

## Monitoring Multi-tenancy

### Usage per Organization

Track and limit usage per organization:

```typescript
async function checkRateLimit(organizationId: string): Promise<boolean> {
  const key = `rate:${organizationId}`;
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, 60); // 1 minute window
  }

  const org = await getOrganization(organizationId);
  const limit = org.rate_limit_per_minute || 60;

  return count <= limit;
}
```

### Organization Metrics

```typescript
async function getOrganizationMetrics(organizationId: string, period: 'day' | 'month') {
  return db.usageAggregate.findFirst({
    where: {
      organization_id: organizationId,
      aggregation_type: period,
      period_start: getStartOfPeriod(period)
    }
  });
}
```

## Best Practices

1. **Always pass organizationId**: Never assume global scope
2. **Validate cross-references**: Ensure related entities belong to same org
3. **Test isolation**: Write tests to verify data separation
4. **Audit logging**: Log organization ID in all audit logs
5. **Error messages**: Don't reveal existence of data from other orgs
6. **Use findFirst over findUnique**: For better organization filtering

## Next Steps

- **Implement authentication**: [Authentication](./05-authentication.md)
- **Work with the database**: [Database Guide](./06-database.md)
- **Create invoices**: [Invoice Management](./07-invoices.md)
