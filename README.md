# Számlázó NAV API

A multi-tenant SaaS invoice management system for Hungarian businesses with automatic NAV (National Tax Authority) registration.

## 🎯 Project Overview

This is a **production-ready REST API** that provides:

- ✅ Invoice management (create, list, storno/cancellation)
- ✅ Automatic NAV online invoice registration (Hungarian legal requirement)
- ✅ Multi-tenant architecture (isolated organizations)
- ✅ Usage tracking for subscription billing
- ✅ Secure NAV credential management
- ✅ PDF invoice generation
- ✅ API key authentication

**Stack**: Node.js, TypeScript, PostgreSQL, Redis, Express.js

## 📚 Documentation Structure

### High-Level Documentation (Root Directory)

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete system architecture and design
- **[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)** - Database schema with all tables and relationships
- **[API_DESIGN.md](./API_DESIGN.md)** - REST API specification with all endpoints
- **[DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md)** - 16-week development roadmap

### Developer Documentation (Modular, max 300 lines each)

Located in `/docs` - organized into focused files for optimal context loading:

**Getting Started:**
- [Setup Guide](./docs/01-setup.md) - Installation and configuration
- [Project Structure](./docs/02-project-structure.md) - Codebase organization

**Core Concepts:**
- [Multi-tenancy](./docs/04-multi-tenancy.md) - Organization isolation
- [NAV Integration](./docs/08-nav-integration.md) - Hungarian tax authority integration
- [Environment Variables](./docs/17-environment-variables.md) - Complete env reference

**Full Index**: See [docs/README.md](./docs/README.md) for complete navigation

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ LTS
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (recommended)

### Installation (Docker - Recommended)

```bash
# Clone repository
git clone <repository-url>
cd szamla-api

# Copy environment template
cp .env.example .env

# Start all services
docker-compose up -d

# Run migrations
docker-compose exec api npm run db:migrate

# Seed dev data
docker-compose exec api npm run seed:dev
```

API will be available at `http://localhost:3000`

### Manual Installation

```bash
# Install dependencies
npm install

# Setup PostgreSQL and Redis (see docs/01-setup.md)

# Configure .env
cp .env.example .env
nano .env

# Run migrations
npm run db:migrate

# Start development server
npm run dev
```

See [Setup Guide](./docs/01-setup.md) for detailed instructions.

## 🏗️ Architecture Highlights

### Multi-tenancy

- Every organization operates in complete isolation
- Row-level security with `organization_id` filtering
- Independent NAV credentials per organization
- Separate invoice numbering sequences

### NAV Integration

- Async submission via background jobs
- Transaction status polling
- Full error handling and retry logic
- Support for CREATE, STORNO, and ANNUL operations

### Usage Tracking

- Automatic tracking of all API operations
- Daily and monthly aggregation
- Foundation for subscription billing

### Security

- API key authentication (bcrypt hashed)
- AES-256 encryption for NAV credentials
- Rate limiting per organization
- Complete audit trail

## 📊 Key Features

### Invoice Management

```bash
# Create invoice
POST /api/v1/invoices

# List invoices (paginated, filtered)
GET /api/v1/invoices?status=finalized&page=1&limit=25

# Get invoice details
GET /api/v1/invoices/{id}

# Finalize and submit to NAV
POST /api/v1/invoices/{id}/finalize

# Create storno (cancellation)
POST /api/v1/invoices/{id}/storno

# Download PDF
GET /api/v1/invoices/{id}/pdf
```

### Partner Management

```bash
# Create business partner
POST /api/v1/partners

# List partners
GET /api/v1/partners
```

### NAV Operations

```bash
# Test NAV connection
POST /api/v1/organization/nav/test-connection

# Query transaction status
GET /api/v1/nav/transactions/{transaction_id}
```

### Usage Monitoring

```bash
# Get current period usage
GET /api/v1/usage/current

# Usage history
GET /api/v1/usage/history?from_date=2025-01-01&to_date=2025-01-31
```

See [API_DESIGN.md](./API_DESIGN.md) for complete API reference.

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test -- invoices.test.ts

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

## 🛠️ Development

```bash
# Start development server with hot reload
npm run dev

# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run type-check

# Run migrations
npm run db:migrate

# Create new migration
npm run db:migration:create -- --name=add_new_field

# Generate API key for testing
npm run api-key:generate -- --org=org_test_123
```

See [Development Workflow](./docs/03-development-workflow.md) for more commands.

## 📦 Project Structure

```
szamla-api/
├── src/
│   ├── controllers/       # Request handlers
│   ├── services/          # Business logic
│   ├── models/            # Database models
│   ├── middleware/        # Express middleware
│   ├── routes/            # API routes
│   ├── jobs/              # Background jobs
│   ├── utils/             # Helper functions
│   └── types/             # TypeScript types
├── tests/
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── e2e/               # End-to-end tests
├── migrations/            # Database migrations
├── docs/                  # Developer documentation
└── scripts/               # Utility scripts
```

See [Project Structure](./docs/02-project-structure.md) for detailed explanation.

## 🔐 Security

- **Authentication**: API key (Bearer token)
- **Encryption**: AES-256 for NAV credentials
- **Rate Limiting**: Configurable per organization
- **Input Validation**: Zod schemas on all endpoints
- **Audit Logging**: Complete operation trail
- **HTTPS Only**: TLS 1.3 in production

## 🌍 NAV Integration

Hungarian businesses must report all invoices to NAV (Nemzeti Adó- és Vámhivatal). This API:

1. Converts invoices to NAV XML format
2. Submits to NAV API via secure connection
3. Tracks transaction status asynchronously
4. Handles validation errors and retries
5. Stores NAV confirmation for auditing

**NAV Documentation**: https://onlineszamla.nav.gov.hu/dokumentaciok

## 📈 Development Roadmap

### Phase 1-3: Foundation (Weeks 1-5) ✅ Planned
- Project setup and infrastructure
- Organization management
- Authentication and multi-tenancy
- Partner management

### Phase 4-5: Core Features (Weeks 6-10) ✅ Planned
- Invoice creation and management
- Storno functionality
- NAV integration
- Transaction status tracking

### Phase 6-10: Production Ready (Weeks 11-16) ✅ Planned
- Background jobs
- PDF generation
- Usage tracking
- Testing and documentation
- Security hardening
- Beta testing

See [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) for complete roadmap.

## 🎓 Learning Resources

### For New Developers

Start here:
1. [Setup Guide](./docs/01-setup.md) - Get environment running
2. [Project Structure](./docs/02-project-structure.md) - Understand codebase
3. [Multi-tenancy](./docs/04-multi-tenancy.md) - Learn data isolation
4. [NAV Integration](./docs/08-nav-integration.md) - Understand NAV flow

### References

- **Billingo API**: https://app.swaggerhub.com/apis/Billingo/Billingo/3.0.14
- **nav-connector**: https://github.com/angro-kft/nav-connector
- **NAV Online Invoice**: https://onlineszamla.nav.gov.hu

## 🤝 Contributing

1. Read the documentation in `/docs`
2. Follow the code style (ESLint + Prettier)
3. Write tests for new features
4. Keep developer docs under 300 lines per file
5. Update API_DESIGN.md for new endpoints

## 📝 License

MIT License - See LICENSE file for details

## 💬 Support

- **Documentation**: See `/docs` folder
- **Issues**: GitHub Issues
- **Questions**: Create a discussion

## 🎯 Design Philosophy

This project follows these principles:

1. **Multi-tenant from day one** - Isolation at every layer
2. **Security first** - Encryption, validation, audit trails
3. **API-first design** - Well-documented REST API
4. **Observable** - Logging, metrics, usage tracking
5. **Tested** - >80% coverage target
6. **Documented** - Modular docs optimized for context loading
7. **Pragmatic** - Real-world solutions over theoretical perfection

---

**Built with ❤️ for Hungarian businesses**

Need to register invoices with NAV? This API has you covered! 🇭🇺
