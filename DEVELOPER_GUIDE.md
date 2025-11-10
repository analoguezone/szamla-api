# Developer Guide - Számlázó NAV API

Quick start guide for developers. See ARCHITECTURE.md and API_DESIGN.md for detailed documentation.

## Prerequisites

- Node.js 20+ LTS
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (recommended)

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd szamla-api
npm install
```

### 2. Environment Setup

Create `.env` file:

```env
# Server
NODE_ENV=development
PORT=3000
API_BASE_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/szamla_api
DB_HOST=localhost
DB_PORT=5432
DB_NAME=szamla_api
DB_USER=user
DB_PASSWORD=password

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# Security
API_KEY_SECRET=your-secret-key-here-change-in-production
ENCRYPTION_KEY=32-byte-hex-key-for-nav-credentials-encryption

# NAV API
NAV_BASE_URL=https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3
NAV_TIMEOUT_MS=70000

# File Storage
STORAGE_PATH=./storage
STORAGE_TYPE=local

# Logging
LOG_LEVEL=debug
```

### 3. Database Setup

```bash
# Start PostgreSQL with Docker
docker-compose up -d postgres

# Run migrations
npm run db:migrate

# Seed test data (optional)
npm run db:seed
```

### 4. Run Development Server

```bash
# Start all services (Postgres, Redis, API)
docker-compose up

# OR run locally
npm run dev
```

Server runs at `http://localhost:3000`

## Project Structure

```
szamla-api/
├── src/
│   ├── controllers/       # Request handlers
│   ├── services/          # Business logic
│   ├── models/            # Database models
│   ├── middleware/        # Express middleware
│   ├── utils/             # Helper functions
│   ├── validators/        # Request validation schemas
│   ├── routes/            # API route definitions
│   ├── jobs/              # Background job processors
│   ├── config/            # Configuration files
│   └── index.ts           # Application entry point
├── tests/
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── e2e/               # End-to-end tests
├── migrations/            # Database migrations
├── scripts/               # Utility scripts
├── docs/                  # Additional documentation
└── docker-compose.yml
```

## Core Technologies

- **Framework**: Express.js + TypeScript
- **ORM**: Prisma (or TypeORM/raw SQL)
- **Validation**: Zod
- **Jobs**: BullMQ
- **Testing**: Jest + Supertest
- **Logging**: Winston/Pino
- **NAV Integration**: nav-connector (modified)

## Key Concepts

### Multi-tenancy

All requests are scoped to an organization via API key:

```typescript
// Middleware extracts organization from API key
req.organizationId = "org_abc123";

// All queries filtered by organization
const invoices = await db.invoice.findMany({
  where: { organization_id: req.organizationId }
});
```

### NAV Integration Flow

```typescript
// 1. Create invoice locally
const invoice = await invoiceService.create(data);

// 2. Submit to NAV (async)
const transaction = await navService.submitInvoice(invoice);

// 3. Poll for status (background job)
const status = await navService.getTransactionStatus(transaction.id);

// 4. Update invoice when confirmed
await invoiceService.updateNavStatus(invoice.id, status);
```

### Usage Tracking

Every API call is logged automatically via middleware:

```typescript
app.use(usageTrackingMiddleware);

// Logs: endpoint, method, status, response_time, organization_id
```

## API Authentication

Generate API keys for testing:

```bash
npm run api-key:generate -- --org=org_test_123 --name="Test Key"
```

Use in requests:

```bash
curl -H "Authorization: Bearer sk_test_abc123..." \
  http://localhost:3000/api/v1/invoices
```

## Database Migrations

```bash
# Create new migration
npm run db:migration:create -- --name=add_field_to_invoices

# Run pending migrations
npm run db:migrate

# Rollback last migration
npm run db:migrate:rollback

# Reset database (dev only!)
npm run db:reset
```

## Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- invoices.test.ts
```

### Test Structure

```typescript
describe('Invoice Service', () => {
  beforeEach(async () => {
    // Setup: create test organization
    org = await createTestOrganization();
  });

  it('should create invoice', async () => {
    const invoice = await invoiceService.create({
      organization_id: org.id,
      partner_id: partner.id,
      items: [...]
    });

    expect(invoice.status).toBe('draft');
    expect(invoice.gross_amount).toBe(127000);
  });

  afterEach(async () => {
    // Cleanup
    await cleanupTestData();
  });
});
```

## Common Development Tasks

### Adding New Endpoint

1. Define route in `src/routes/`
2. Create controller in `src/controllers/`
3. Add business logic in `src/services/`
4. Create validation schema in `src/validators/`
5. Add tests
6. Update API_DESIGN.md

### Adding Database Table

1. Create migration: `npm run db:migration:create`
2. Write up/down SQL
3. Run migration: `npm run db:migrate`
4. Update DATABASE_SCHEMA.md

### Adding Background Job

```typescript
// src/jobs/nav-submission.job.ts
export async function processNavSubmission(job) {
  const { invoiceId } = job.data;

  // 1. Fetch invoice
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId }});

  // 2. Submit to NAV
  const result = await navService.submitInvoice(invoice);

  // 3. Update status
  await db.invoice.update({
    where: { id: invoiceId },
    data: { nav_status: result.status }
  });
}

// Register job
navQueue.process('submit-invoice', processNavSubmission);
```

## NAV Integration

### Setup NAV Connector

```typescript
import { NavConnector } from './services/nav-connector';

const navClient = new NavConnector({
  user: {
    login: org.nav_login,
    password: decrypt(org.nav_password_encrypted),
    taxNumber: org.tax_number,
    signatureKey: decrypt(org.nav_signature_key_encrypted),
    exchangeKey: decrypt(org.nav_exchange_key_encrypted)
  },
  software: {
    softwareId: org.software_id,
    softwareName: org.software_name,
    // ...
  },
  baseURL: process.env.NAV_BASE_URL
});

// Test connection
const isValid = await navClient.testConnection();
```

### Invoice Submission

```typescript
// Convert to NAV XML format
const navXml = convertInvoiceToNavXml(invoice);

// Submit
const result = await navClient.manageInvoice({
  operation: 'CREATE',
  invoices: [navXml]
});

// Store transaction ID
await db.navSubmission.create({
  data: {
    transaction_id: result.transactionId,
    invoice_id: invoice.id,
    status: 'PENDING'
  }
});
```

## Security Best Practices

1. **Never commit secrets**: Use `.env` and environment variables
2. **Encrypt NAV credentials**: Use strong encryption (AES-256)
3. **Hash API keys**: Store bcrypt hashes, never plaintext
4. **Validate input**: Use Zod schemas on all endpoints
5. **Rate limiting**: Protect against abuse
6. **Audit logging**: Track all sensitive operations

## Performance Optimization

```typescript
// 1. Use database indexes
CREATE INDEX idx_invoices_org_date ON invoices(organization_id, issue_date);

// 2. Cache frequently accessed data
const orgConfig = await cache.get(`org:${orgId}:config`);

// 3. Paginate large lists
const invoices = await db.invoice.findMany({
  take: 25,
  skip: (page - 1) * 25
});

// 4. Use database transactions
await db.$transaction(async (tx) => {
  const invoice = await tx.invoice.create({...});
  const items = await tx.invoiceItem.createMany({...});
});
```

## Debugging

### Enable Debug Logging

```env
LOG_LEVEL=debug
DEBUG=nav:*,app:*
```

### Inspect Database Queries

```typescript
// Log all Prisma queries (Prisma example)
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error']
});
```

### Test NAV Integration

```bash
# Use NAV test environment
NAV_BASE_URL=https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3

# Mock NAV in tests
jest.mock('./services/nav-connector');
```

## Docker Development

```bash
# Build containers
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f api

# Run migrations in container
docker-compose exec api npm run db:migrate

# Shell into container
docker-compose exec api sh

# Stop all
docker-compose down
```

## Production Deployment

### Build

```bash
npm run build
# Creates ./dist folder
```

### Environment Variables

Ensure these are set in production:

- `NODE_ENV=production`
- Strong `ENCRYPTION_KEY`
- Production `DATABASE_URL`
- Production `NAV_BASE_URL`

### Database Migrations

```bash
# Run on production database
npm run db:migrate
```

### Health Checks

```bash
GET /health
# Returns: { status: "ok", database: "connected", redis: "connected" }
```

## Troubleshooting

**Database connection fails:**
- Check `DATABASE_URL` format
- Verify PostgreSQL is running
- Check credentials and permissions

**NAV submission fails:**
- Verify NAV credentials
- Check NAV service status
- Review NAV error codes in response
- Ensure XML format is valid

**Rate limiting issues:**
- Check Redis connection
- Verify rate limit configuration
- Clear rate limit: `redis-cli DEL rate:org_abc123`

**Memory issues:**
- Enable Redis for caching
- Implement pagination
- Use streaming for large PDFs

## Additional Resources

- ARCHITECTURE.md - System design
- DATABASE_SCHEMA.md - Database structure
- API_DESIGN.md - API endpoints
- NAV Documentation: https://onlineszamla.nav.gov.hu/dokumentaciok
- nav-connector: https://github.com/angro-kft/nav-connector

## Support & Contributing

Report issues: [GitHub Issues]
Contribute: See CONTRIBUTING.md
License: MIT
