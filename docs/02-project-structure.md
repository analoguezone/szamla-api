# Project Structure

Understanding the codebase organization.

**Related docs**: [Setup Guide](./01-setup.md) | [Development Workflow](./03-development-workflow.md) | [Database Guide](./06-database.md)

## Directory Overview

```
szamla-api/
├── src/                    # Source code
├── tests/                  # Test files
├── migrations/             # Database migrations
├── scripts/                # Utility scripts
├── docs/                   # Developer documentation
├── storage/                # File storage (gitignored)
├── docker-compose.yml      # Docker services
├── Dockerfile              # Production Docker image
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── .env                    # Environment variables (gitignored)
└── README.md               # Project overview
```

## Source Code Structure

### /src

```
src/
├── index.ts                    # Application entry point
├── app.ts                      # Express app setup
├── server.ts                   # HTTP server
│
├── config/                     # Configuration
│   ├── database.ts            # Database connection
│   ├── redis.ts               # Redis connection
│   ├── logger.ts              # Logging configuration
│   └── constants.ts           # Application constants
│
├── middleware/                 # Express middleware
│   ├── auth.middleware.ts     # API key authentication
│   ├── error.middleware.ts    # Error handling
│   ├── logger.middleware.ts   # Request logging
│   ├── rate-limit.middleware.ts # Rate limiting
│   ├── usage-tracking.middleware.ts # Usage tracking
│   └── validation.middleware.ts # Request validation
│
├── routes/                     # API routes
│   ├── index.ts               # Main router
│   ├── organization.routes.ts # Organization endpoints
│   ├── partner.routes.ts      # Partner endpoints
│   ├── invoice.routes.ts      # Invoice endpoints
│   ├── nav.routes.ts          # NAV operations
│   ├── usage.routes.ts        # Usage endpoints
│   └── api-key.routes.ts      # API key management
│
├── controllers/                # Request handlers
│   ├── organization.controller.ts
│   ├── partner.controller.ts
│   ├── invoice.controller.ts
│   ├── nav.controller.ts
│   ├── usage.controller.ts
│   └── api-key.controller.ts
│
├── services/                   # Business logic
│   ├── organization.service.ts
│   ├── partner.service.ts
│   ├── invoice.service.ts
│   ├── nav.service.ts
│   ├── nav-connector.ts       # NAV API wrapper
│   ├── usage.service.ts
│   ├── api-key.service.ts
│   ├── pdf.service.ts         # PDF generation
│   ├── storage.service.ts     # File storage
│   └── encryption.service.ts  # Encryption utilities
│
├── models/                     # Database models
│   ├── organization.model.ts
│   ├── partner.model.ts
│   ├── invoice.model.ts
│   ├── invoice-item.model.ts
│   ├── nav-submission.model.ts
│   ├── usage-log.model.ts
│   └── api-key.model.ts
│
├── validators/                 # Request validation
│   ├── organization.validator.ts
│   ├── partner.validator.ts
│   ├── invoice.validator.ts
│   └── common.validator.ts
│
├── jobs/                       # Background jobs
│   ├── queue.ts               # Job queue setup
│   ├── nav-submission.job.ts  # NAV submission processor
│   ├── nav-status.job.ts      # NAV status checker
│   └── usage-aggregation.job.ts # Usage aggregation
│
├── utils/                      # Utility functions
│   ├── response.ts            # API response helpers
│   ├── errors.ts              # Custom error classes
│   ├── validation.ts          # Validation helpers
│   ├── tax-number.ts          # Hungarian tax number utils
│   ├── invoice-number.ts      # Invoice number generation
│   └── date.ts                # Date utilities
│
└── types/                      # TypeScript types
    ├── api.types.ts           # API request/response types
    ├── invoice.types.ts       # Invoice types
    ├── nav.types.ts           # NAV types
    └── common.types.ts        # Shared types
```

## Test Structure

```
tests/
├── unit/                       # Unit tests
│   ├── services/
│   ├── utils/
│   └── models/
│
├── integration/                # Integration tests
│   ├── api/
│   │   ├── organizations.test.ts
│   │   ├── partners.test.ts
│   │   ├── invoices.test.ts
│   │   └── nav.test.ts
│   └── database/
│
├── e2e/                        # End-to-end tests
│   ├── invoice-creation.test.ts
│   ├── storno-workflow.test.ts
│   └── nav-submission.test.ts
│
├── fixtures/                   # Test data
│   ├── organizations.ts
│   ├── partners.ts
│   └── invoices.ts
│
├── helpers/                    # Test utilities
│   ├── setup.ts               # Test setup
│   ├── teardown.ts            # Test cleanup
│   ├── factories.ts           # Data factories
│   └── assertions.ts          # Custom assertions
│
└── mocks/                      # Mock services
    ├── nav.mock.ts
    └── storage.mock.ts
```

## Migrations Structure

```
migrations/
├── 001_create_organizations.sql
├── 002_create_partners.sql
├── 003_create_invoices.sql
├── 004_create_invoice_items.sql
├── 005_create_nav_submissions.sql
├── 006_create_usage_logs.sql
├── 007_create_api_keys.sql
├── 008_create_indexes.sql
├── 009_create_triggers.sql
└── 010_create_views.sql
```

## Scripts Structure

```
scripts/
├── generate-api-key.ts         # Generate API keys
├── test-nav-connection.ts      # Test NAV connection
├── seed-dev.ts                 # Seed dev data
├── seed-production.ts          # Seed production data
├── migrate-up.ts               # Run migrations
├── migrate-down.ts             # Rollback migrations
├── export-openapi.ts           # Generate OpenAPI spec
└── cleanup-storage.ts          # Clean old files
```

## Key Files Explained

### Entry Point (src/index.ts)

```typescript
import { app } from './app';
import { config } from './config';
import { logger } from './config/logger';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';

async function bootstrap() {
  await connectDatabase();
  await connectRedis();

  const port = config.port || 3000;
  app.listen(port, () => {
    logger.info(`Server running on port ${port}`);
  });
}

bootstrap();
```

### App Setup (src/app.ts)

```typescript
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';

import { loggerMiddleware } from './middleware/logger.middleware';
import { errorMiddleware } from './middleware/error.middleware';
import { routes } from './routes';

export const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(loggerMiddleware);

// Routes
app.use('/api/v1', routes);

// Error handling
app.use(errorMiddleware);
```

### Route Definition (src/routes/invoice.routes.ts)

```typescript
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { invoiceController } from '../controllers/invoice.controller';
import { createInvoiceSchema } from '../validators/invoice.validator';

const router = Router();

router.use(authMiddleware); // Protect all routes

router.get('/', invoiceController.list);
router.get('/:id', invoiceController.get);
router.post('/', validateRequest(createInvoiceSchema), invoiceController.create);
router.patch('/:id', invoiceController.update);
router.delete('/:id', invoiceController.delete);
router.post('/:id/finalize', invoiceController.finalize);
router.post('/:id/storno', invoiceController.storno);

export { router as invoiceRoutes };
```

### Controller (src/controllers/invoice.controller.ts)

```typescript
import { Request, Response, NextFunction } from 'express';
import { invoiceService } from '../services/invoice.service';
import { successResponse, errorResponse } from '../utils/response';

export const invoiceController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId } = req;
      const { page, limit } = req.query;

      const result = await invoiceService.list(organizationId, { page, limit });

      return successResponse(res, result);
    } catch (error) {
      next(error);
    }
  },

  // ... more methods
};
```

### Service (src/services/invoice.service.ts)

```typescript
import { db } from '../config/database';
import { CreateInvoiceDTO } from '../types/invoice.types';
import { InvoiceNotFoundError } from '../utils/errors';

export const invoiceService = {
  async create(organizationId: string, data: CreateInvoiceDTO) {
    // Business logic here
    const invoice = await db.invoice.create({
      data: {
        organization_id: organizationId,
        ...data
      }
    });

    return invoice;
  },

  async finalize(invoiceId: string) {
    const invoice = await this.findById(invoiceId);

    if (!invoice) {
      throw new InvoiceNotFoundError(invoiceId);
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(invoice.organization_id);

    // Update invoice
    return db.invoice.update({
      where: { id: invoiceId },
      data: {
        invoice_number: invoiceNumber,
        status: 'finalized',
        finalized_at: new Date()
      }
    });
  },

  // ... more methods
};
```

## Configuration Files

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### package.json Scripts

See [CLI Commands](./18-cli-commands.md) for complete reference.

## Naming Conventions

### Files
- **TypeScript files**: kebab-case (e.g., `invoice.service.ts`)
- **Test files**: kebab-case with `.test.ts` suffix
- **Type files**: kebab-case with `.types.ts` suffix

### Code
- **Classes**: PascalCase (`InvoiceService`)
- **Functions**: camelCase (`createInvoice`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Interfaces**: PascalCase with `I` prefix (`IInvoice`) or without
- **Types**: PascalCase (`InvoiceDTO`)

### Database
- **Tables**: snake_case, plural (`invoices`, `invoice_items`)
- **Columns**: snake_case (`invoice_number`, `created_at`)
- **Indexes**: `idx_table_column` (`idx_invoices_organization_id`)

## Import Order

```typescript
// 1. Node.js built-in modules
import { readFile } from 'fs/promises';

// 2. External dependencies
import express from 'express';
import { z } from 'zod';

// 3. Internal modules (absolute paths)
import { db } from '@/config/database';
import { logger } from '@/config/logger';

// 4. Relative imports
import { InvoiceService } from './invoice.service';
import { calculateVat } from '../utils/vat';

// 5. Types
import type { Invoice, InvoiceItem } from '@/types';
```

## Next Steps

- **Learn the workflow**: [Development Workflow](./03-development-workflow.md)
- **Understand multi-tenancy**: [Multi-tenancy](./04-multi-tenancy.md)
- **Work with the database**: [Database Guide](./06-database.md)
- **Create features**: [Invoice Management](./07-invoices.md)
