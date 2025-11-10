# Számlázó NAV API - System Architecture

## Overview

A multi-tenant SaaS invoice management system for Hungarian businesses that automates invoice creation and NAV (National Tax Authority) registration. The system provides a RESTful API for invoice operations while handling the complex NAV integration behind the scenes.

## Core Principles

1. **Multi-tenancy**: Each organization operates in isolation with their own NAV credentials
2. **Usage-based monitoring**: Track all API operations for future billing/subscription management
3. **NAV compliance**: Automatically register all invoices with Hungarian tax authorities
4. **Security-first**: API keys for authentication, encrypted storage of NAV credentials
5. **Auditability**: Complete audit trail of all operations and NAV submissions

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Applications                       │
│                   (Multiple Organizations/Users)                  │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS/REST API
                         │ API Key Authentication
┌────────────────────────▼────────────────────────────────────────┐
│                      API Gateway Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Auth         │  │ Rate         │  │ Request      │          │
│  │ Middleware   │  │ Limiting     │  │ Validation   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                      Application Layer                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Invoice Service                              │   │
│  │  • Create invoices      • Storno invoices                │   │
│  │  • List/Query invoices  • Download PDFs                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              NAV Integration Service                      │   │
│  │  • Manage invoice submission    • Query transaction      │   │
│  │  • Handle storno/annulment      • Validate credentials   │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Organization Service                         │   │
│  │  • Manage organizations  • Store NAV credentials         │   │
│  │  • API key management    • Organization settings         │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Usage Tracking Service                       │   │
│  │  • Track API calls       • Monitor NAV operations        │   │
│  │  • Usage analytics       • Billing metrics               │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                      Data Layer                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ PostgreSQL   │  │ Redis        │  │ File Storage │          │
│  │ (Primary DB) │  │ (Cache/Jobs) │  │ (PDF/XML)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└───────────────────────────────────────────────────────────────────┘
                         │
                         │ HTTPS
┌────────────────────────▼────────────────────────────────────────┐
│                  NAV Online Invoice System                        │
│             https://api.onlineszamla.nav.gov.hu/                 │
└───────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. API Gateway Layer

**Responsibilities:**
- API key authentication and validation
- Rate limiting per organization (configurable tiers)
- Request/response validation using JSON schemas
- CORS handling
- Request logging and tracing
- Error handling and standardized responses

**Technology Stack:**
- Express.js middleware
- express-rate-limit for rate limiting
- helmet for security headers
- compression for response optimization

### 2. Application Layer

#### Invoice Service

**Core Functions:**
- Create invoices with line items, VAT calculations
- Generate storno (reversal) invoices
- List and filter invoices (pagination, date ranges, status)
- Calculate totals, VAT amounts automatically
- Manage invoice blocks (sequential numbering per organization)
- Generate PDF documents
- Track invoice lifecycle states

**Business Logic:**
- Automatic VAT calculation based on Hungarian tax codes
- Invoice number generation with customizable prefixes
- Validation of partner data (tax numbers, addresses)
- Currency handling and exchange rates
- Rounding rules according to Hungarian regulations

#### NAV Integration Service

**Core Functions:**
- Authenticate with NAV using organization credentials
- Submit invoices to NAV (manageInvoice operation)
- Submit storno/annulment operations
- Query transaction status (async operation tracking)
- Query invoice data from NAV
- Handle NAV validation errors and retry logic

**Implementation Details:**
- Uses nav-connector library as base
- Converts internal invoice format to NAV XML schema (base64 encoded)
- Handles NAV response validation messages
- Implements exponential backoff for retries
- Stores NAV transaction IDs for tracking
- Monitors NAV submission status (PENDING → DONE/ABORTED)

**NAV Credentials per Organization:**
```javascript
{
  login: "technical_user_login",
  password: "technical_user_password",
  taxNumber: "organization_tax_number",
  signatureKey: "signature_key",
  exchangeKey: "exchange_key"
}
```

#### Organization Service

**Core Functions:**
- CRUD operations for organizations
- Secure storage of NAV credentials (encrypted at rest)
- API key generation and rotation
- Organization settings (invoice prefixes, default values)
- Test NAV connection before activation
- Manage organization subscription status

**Multi-tenancy Strategy:**
- Each organization has isolated data
- Row-level security using organization_id
- Separate NAV credentials per organization
- Independent invoice numbering sequences

#### Usage Tracking Service

**Core Functions:**
- Record every API call with metadata:
  - Endpoint, method, status code
  - Response time
  - Organization ID
  - Timestamp
  - Request size
- Track NAV operations separately:
  - Invoice submissions
  - Query operations
  - Data transfer volumes
- Aggregate daily/monthly usage statistics
- Generate usage reports for billing

**Metrics Tracked:**
```javascript
{
  api_calls: "total REST API requests",
  invoices_created: "count of invoices created",
  invoices_submitted_to_nav: "count submitted to NAV",
  storno_operations: "count of storno operations",
  pdf_generations: "count of PDF downloads",
  storage_used_mb: "total storage in MB",
  data_transfer_mb: "bandwidth usage"
}
```

### 3. Data Layer

#### PostgreSQL Database

**Purpose:**
- Primary data store for all entities
- ACID compliance for invoice operations
- Complex querying and reporting
- Referential integrity

**Key Tables:**
- organizations
- invoices
- invoice_items
- partners (customers/suppliers)
- nav_submissions
- usage_logs
- api_keys

#### Redis Cache

**Purpose:**
- Session management
- API rate limiting counters
- Job queue for async NAV operations
- Cache frequently accessed data (organization configs)

**Use Cases:**
- Cache NAV transaction status checks
- Queue invoice submissions to NAV (async processing)
- Store rate limit buckets per API key
- Cache organization settings

#### File Storage

**Purpose:**
- Store generated PDF invoices
- Store XML files submitted to NAV
- Archive NAV responses
- Backup audit trail

**Structure:**
```
/storage
  /organizations
    /{org_id}
      /invoices
        /{year}
          /{invoice_id}.pdf
          /{invoice_id}_nav.xml
          /{invoice_id}_nav_response.json
```

## Data Flow Examples

### Invoice Creation Flow

```
1. Client → POST /api/v1/invoices
   ↓
2. API Gateway validates API key → extracts organization_id
   ↓
3. Invoice Service validates request data
   ↓
4. Invoice Service creates invoice record in DB
   ↓
5. NAV Integration Service submits to NAV (async)
   ↓
6. Usage Tracking Service logs operation
   ↓
7. Response returned to client (transactionId for NAV)
   ↓
8. [Async] NAV connector polls for transaction status
   ↓
9. [Async] Update invoice record with NAV confirmation
```

### Storno Flow

```
1. Client → POST /api/v1/invoices/{id}/storno
   ↓
2. API Gateway validates permissions
   ↓
3. Invoice Service validates original invoice exists
   ↓
4. Invoice Service creates storno invoice (negative amounts)
   ↓
5. NAV Integration Service submits STORNO operation
   ↓
6. Original invoice marked as "storned"
   ↓
7. Storno invoice linked to original
   ↓
8. Response with storno invoice details
```

## Security Architecture

### Authentication & Authorization

1. **API Key Authentication:**
   - Bearer token in Authorization header
   - API keys hashed using bcrypt before storage
   - Linked to specific organization
   - Configurable expiration and rotation

2. **Multi-tenant Isolation:**
   - All queries filtered by organization_id
   - Row-level security policies in PostgreSQL
   - API keys scoped to single organization
   - No cross-organization data access

3. **NAV Credentials Security:**
   - Encrypted at rest using AES-256
   - Separate encryption key per environment
   - Keys stored in environment variables/secrets manager
   - Decrypted only when making NAV requests

### Data Protection

1. **Transport Security:**
   - HTTPS only (TLS 1.3)
   - Certificate pinning for NAV communication
   - No sensitive data in URLs (use request body)

2. **At-Rest Encryption:**
   - Database encryption for NAV credentials
   - Encrypted backups
   - Secure file storage with encryption

3. **Audit Trail:**
   - All operations logged with timestamp
   - User actions tracked
   - NAV submission history maintained
   - Immutable audit log (append-only)

## Scalability Considerations

### Horizontal Scaling

- **Stateless API servers**: Can scale horizontally
- **Load balancer**: Distribute requests across instances
- **Database connection pooling**: Efficient resource usage
- **Redis for shared state**: Session/cache across instances

### Performance Optimization

1. **Caching Strategy:**
   - Cache organization configs (TTL: 1 hour)
   - Cache VAT rates and tax codes (TTL: 24 hours)
   - Cache partner data (TTL: 5 minutes)

2. **Async Processing:**
   - NAV submissions via job queue (Bull/BullMQ)
   - PDF generation in background
   - Usage aggregation via scheduled jobs

3. **Database Optimization:**
   - Indexes on frequently queried fields
   - Partitioning invoices by year
   - Archiving old data to separate tables
   - Read replicas for reporting queries

### Monitoring & Observability

1. **Application Metrics:**
   - Request latency (p50, p95, p99)
   - Error rates by endpoint
   - NAV submission success/failure rates
   - Queue depths

2. **Infrastructure Metrics:**
   - CPU, memory, disk usage
   - Database connection pool status
   - Redis memory usage
   - Network throughput

3. **Business Metrics:**
   - Invoices created per hour/day
   - NAV submission delays
   - Organizations active
   - API usage by organization

## Deployment Architecture

### Environment Strategy

1. **Development**: Local development with Docker Compose
2. **Staging**: Mirror of production for testing
3. **Production**: High availability setup

### Production Setup

```
┌─────────────────┐
│   Load Balancer │ (nginx/AWS ALB)
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│ API   │ │ API   │  (Node.js instances)
│ Server│ │ Server│
└───┬───┘ └──┬────┘
    │        │
    └────┬───┘
         │
    ┌────▼────┐
    │ Redis   │ (Single/Cluster)
    └─────────┘
         │
    ┌────▼────┐
    │PostgreSQL│ (Primary + Replicas)
    └─────────┘
```

## Technology Stack Summary

### Backend
- **Runtime**: Node.js 20+ (LTS)
- **Framework**: Express.js
- **Language**: TypeScript
- **Validation**: Zod / Joi
- **ORM**: Prisma / TypeORM / pg with SQL
- **NAV Integration**: nav-connector (modified)

### Database
- **Primary**: PostgreSQL 15+
- **Cache**: Redis 7+
- **Migrations**: Prisma Migrate / node-pg-migrate

### Infrastructure
- **Containerization**: Docker
- **Orchestration**: Docker Compose (dev) / Kubernetes (optional)
- **Storage**: Local filesystem / S3-compatible
- **Reverse Proxy**: nginx

### DevOps
- **Testing**: Jest, Supertest
- **Linting**: ESLint, Prettier
- **CI/CD**: GitHub Actions
- **Logging**: Winston / Pino
- **Monitoring**: Prometheus + Grafana (optional)

## Future Considerations

### Phase 2 Features
- Webhook notifications for invoice status changes
- Bulk import/export of invoices
- Recurring invoice templates
- Multi-currency support with ECB rates
- Partner management API
- Invoice approval workflows

### Phase 3 Features
- GraphQL API
- WebSocket for real-time updates
- Mobile SDK
- Advanced reporting and analytics
- AI-powered invoice data extraction
- Integration marketplace (accounting software)

### Billing System Integration
- Track usage metrics per organization
- Subscription tier management
- Usage-based pricing calculation
- Invoice generation for API usage
- Payment processing integration

## Risk Analysis & Mitigation

### Technical Risks

1. **NAV API Availability**
   - **Risk**: NAV service downtime affects invoice submission
   - **Mitigation**: Queue-based submission, retry logic, status monitoring

2. **Data Loss**
   - **Risk**: Database corruption or deletion
   - **Mitigation**: Daily backups, point-in-time recovery, replication

3. **Security Breach**
   - **Risk**: Unauthorized access to NAV credentials
   - **Mitigation**: Encryption, key rotation, audit logging, security reviews

### Business Risks

1. **Regulatory Changes**
   - **Risk**: NAV API/requirements change
   - **Mitigation**: Monitor NAV documentation, versioning strategy, modular design

2. **Scale Issues**
   - **Risk**: Sudden growth causes performance degradation
   - **Mitigation**: Load testing, auto-scaling, performance monitoring

3. **Data Compliance**
   - **Risk**: GDPR violations
   - **Mitigation**: Data retention policies, user consent, right to deletion

## Development Best Practices

1. **Code Quality**
   - TypeScript strict mode
   - 80%+ test coverage
   - Code reviews required
   - Automated linting/formatting

2. **API Design**
   - RESTful conventions
   - Semantic versioning
   - Comprehensive documentation (OpenAPI/Swagger)
   - Backward compatibility

3. **Documentation**
   - API documentation (auto-generated)
   - Architecture decision records (ADRs)
   - Deployment runbooks
   - Developer onboarding guide

4. **Testing Strategy**
   - Unit tests for business logic
   - Integration tests for API endpoints
   - E2E tests for critical flows
   - NAV integration tests (sandbox environment)

## Conclusion

This architecture provides a solid foundation for a scalable, secure, and compliant Hungarian invoice management system. The multi-tenant design with usage tracking enables future monetization while the modular service architecture allows for incremental development and easy maintenance.

Key strengths:
- ✅ Separation of concerns
- ✅ Multi-tenant from day one
- ✅ Usage tracking built-in
- ✅ Security-first approach
- ✅ Scalable architecture
- ✅ NAV compliance
- ✅ Audit trail for all operations
