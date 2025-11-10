# Technology Stack & Decisions

Final technology choices and rationale for the Számlázó NAV API project.

## Core Stack

### Backend Framework
**Choice**: **Express.js with TypeScript**

**Why**:
- ✅ Mature and battle-tested
- ✅ Large ecosystem and community
- ✅ Perfect for REST APIs
- ✅ Excellent TypeScript support
- ✅ Easy to find developers

**Alternatives considered**: Fastify (faster but less mature), NestJS (too heavy for this project)

### Language
**Choice**: **TypeScript (strict mode)**

**Why**:
- ✅ Type safety for financial calculations
- ✅ Better developer experience
- ✅ Catches bugs at compile time
- ✅ Self-documenting code
- ✅ Excellent IDE support

### Database
**Choice**: **PostgreSQL 15+**

**Why**:
- ✅ ACID compliance (critical for invoicing)
- ✅ Complex queries and joins
- ✅ Row-level security for multi-tenancy
- ✅ Excellent JSON support (JSONB)
- ✅ Mature and reliable
- ✅ Great for reporting

**Alternatives considered**: MySQL (weaker JSON support), MongoDB (poor for financial data)

### ORM
**Choice**: **Prisma**

**Why**:
- ✅ Best TypeScript integration
- ✅ Auto-generated types
- ✅ Excellent migration system
- ✅ Prisma Studio for debugging
- ✅ Great documentation
- ✅ Better DX than alternatives

**Alternatives considered**: Drizzle (lighter but less mature), TypeORM (more complex), Raw SQL (more work)

### Cache & Jobs
**Choice**: **Redis 7+**

**Why**:
- ✅ Fast in-memory cache
- ✅ Perfect for rate limiting
- ✅ Job queue with BullMQ
- ✅ Session storage
- ✅ Pub/sub for real-time features

**Alternatives considered**: Memcached (less features), RabbitMQ (overkill for this project)

## API & Web

### API Style
**Choice**: **RESTful API**

**Why**:
- ✅ Simple and well-understood
- ✅ Easy to document (OpenAPI/Swagger)
- ✅ Good for CRUD operations
- ✅ HTTP caching support
- ✅ Wide client support

**Alternatives considered**: GraphQL (too complex for this use case), gRPC (not needed for web API)

### API Documentation
**Choice**: **OpenAPI 3.0 / Swagger**

**Why**:
- ✅ Industry standard
- ✅ Auto-generate from code
- ✅ Interactive testing UI
- ✅ Client SDK generation
- ✅ Easy for users to understand

### Authentication
**Choice**: **API Keys (Bearer tokens)**

**Why**:
- ✅ Simple for machine-to-machine
- ✅ Easy to rotate
- ✅ Per-organization scoping
- ✅ Standard HTTP Authorization header

**Alternatives considered**: OAuth2 (too complex for API-only service), JWT (unnecessary overhead)

## Payments & Billing

### Payment Provider
**Choice**: **Stripe**

**Why**:
- ✅ Best-in-class developer experience
- ✅ Excellent documentation
- ✅ Supports HUF currency
- ✅ Strong fraud protection
- ✅ Saved payment methods
- ✅ Webhooks for events
- ✅ Good for Hungarian businesses

**Alternatives considered**: PayPal (worse DX), Barion (Hungarian but less features)

### Billing Model
**Choice**: **Prepaid with auto-recharge**

**Why**:
- ✅ Predictable revenue
- ✅ No unpaid invoices
- ✅ Simple pricing (50 HUF + VAT per invoice)
- ✅ Prevents abuse
- ✅ User controls spending

**Details**:
- 50 HUF + 27% VAT = 63.5 HUF per invoice
- Adjustable per client
- Auto-recharge at 20% balance
- Recharge amount: 100x unit price (default 5,000 HUF)

## Document Generation

### PDF Generation
**Choice**: **Puppeteer**

**Why**:
- ✅ Full control over design
- ✅ HTML/CSS templates
- ✅ Easy to customize
- ✅ Supports images (logos)
- ✅ High quality output

**Alternatives considered**: PDFKit (manual positioning), jsPDF (limited styling), External service (vendor lock-in)

### Invoice Templates
**Choice**: **HTML + CSS → PDF**

**Why**:
- ✅ Designers can create templates
- ✅ Easy to add logos
- ✅ Responsive and flexible
- ✅ Version control friendly

## Background Jobs

### Job Queue
**Choice**: **BullMQ**

**Why**:
- ✅ Redis-based (already using Redis)
- ✅ TypeScript support
- ✅ Retry logic built-in
- ✅ Delayed jobs
- ✅ Job priority
- ✅ Dashboard available (Bull Board)

**Use cases**:
- NAV invoice submission
- NAV status polling
- PDF generation
- Auto-recharge payments
- Usage aggregation

**Alternatives considered**: Agenda (MongoDB-based, don't need MongoDB), node-cron (too simple)

## Testing

### Test Framework
**Choice**: **Jest**

**Why**:
- ✅ Most popular for Node.js
- ✅ Great TypeScript support
- ✅ Built-in mocking
- ✅ Snapshot testing
- ✅ Code coverage
- ✅ Excellent documentation

**Alternatives considered**: Vitest (newer, less ecosystem), Mocha+Chai (more setup)

### Integration Testing
**Choice**: **Supertest + Jest**

**Why**:
- ✅ Easy HTTP testing
- ✅ Works great with Express
- ✅ Fluent API

### E2E Testing
**Choice**: **Jest + test database**

**Why**:
- ✅ Full workflow testing
- ✅ Real database interactions
- ✅ Isolated test environment

## Internationalization

### i18n Library
**Choice**: **i18next**

**Why**:
- ✅ Most mature i18n library for Node.js
- ✅ Excellent TypeScript support
- ✅ Pluralization support
- ✅ Lazy loading
- ✅ Express middleware available

**Languages**:
- Hungarian (default)
- English

## Logging & Monitoring

### Logging
**Choice**: **Pino**

**Why**:
- ✅ Extremely fast (JSON logging)
- ✅ Low overhead
- ✅ Great for production
- ✅ Structured logging
- ✅ Pretty printing for dev

**Alternatives considered**: Winston (slower, more features than needed), console.log (not production-ready)

### Error Tracking
**Choice**: **Sentry**

**Why**:
- ✅ Excellent error tracking
- ✅ Source maps support
- ✅ Performance monitoring
- ✅ Free tier available
- ✅ Great UX

**Alternatives considered**: Rollbar (similar), LogRocket (expensive), Self-hosted (more work)

### Metrics (Optional)
**Choice**: **Prometheus + Grafana**

**Why**:
- ✅ Open source
- ✅ Industry standard
- ✅ Flexible querying
- ✅ Great visualization (Grafana)
- ✅ Alerting support

## Development Tools

### Code Quality
- **Linter**: ESLint with TypeScript plugin
- **Formatter**: Prettier
- **Git hooks**: Husky + lint-staged

### CI/CD
**Choice**: **GitHub Actions**

**Why**:
- ✅ Free for public repos
- ✅ Integrated with GitHub
- ✅ Easy to configure
- ✅ Good documentation

**Alternatives considered**: GitLab CI (if using GitLab), Jenkins (too complex)

### Process Manager
**Choice**: **PM2**

**Why**:
- ✅ Industry standard for Node.js
- ✅ Cluster mode
- ✅ Auto-restart
- ✅ Monitoring
- ✅ Zero-downtime reload

**Alternatives considered**: systemd (OS-level, less Node.js-specific), Docker Swarm (overkill)

## Infrastructure

### Deployment
**Choice**: **Contabo VPS (initially)**

**Why**:
- ✅ Cost-effective (€12/month for 16GB RAM)
- ✅ Good performance
- ✅ European datacenter (Germany)
- ✅ Simple to manage
- ✅ Can scale vertically easily

**Future**: Consider cloud providers (AWS/GCP) if need horizontal scaling

### Reverse Proxy
**Choice**: **Nginx**

**Why**:
- ✅ Battle-tested
- ✅ High performance
- ✅ SSL termination
- ✅ Load balancing
- ✅ Caching support

### SSL/TLS
**Choice**: **Let's Encrypt (via Certbot)**

**Why**:
- ✅ Free
- ✅ Trusted certificates
- ✅ Auto-renewal
- ✅ Easy setup

### Container (Optional)
**Choice**: **Docker (development only)**

**Why**:
- ✅ Consistent dev environment
- ✅ Easy onboarding
- ✅ Isolated services

**Note**: Direct deployment to VPS (not Docker in production) for simplicity initially

## NAV Integration

### NAV Library
**Choice**: **nav-connector (modified)**

**Why**:
- ✅ Open source Hungarian library
- ✅ Handles NAV authentication
- ✅ XML generation
- ✅ We can customize as needed

**Source**: https://github.com/angro-kft/nav-connector

## Security

### Encryption
**Choice**: **AES-256-GCM**

**Why**:
- ✅ Industry standard
- ✅ Built into Node.js crypto
- ✅ Authenticated encryption
- ✅ Fast

**Use**: Encrypt NAV credentials at rest

### Password Hashing
**Choice**: **bcrypt**

**Why**:
- ✅ Designed for passwords
- ✅ Slow by design (prevents brute force)
- ✅ Salting built-in

**Use**: Hash API keys before storage

### Request Validation
**Choice**: **Zod**

**Why**:
- ✅ TypeScript-first
- ✅ Type inference
- ✅ Excellent error messages
- ✅ Composable schemas

**Alternatives considered**: Joi (less TypeScript-friendly), Yup (similar to Zod)

## Development Principles

### Code Style
- **Strict TypeScript**: All type checking enabled
- **Functional**: Prefer pure functions
- **DRY**: Don't repeat yourself
- **KISS**: Keep it simple
- **YAGNI**: You ain't gonna need it (don't over-engineer)

### Project Organization
- **Layered architecture**: Controllers → Services → Models
- **Single responsibility**: One file, one purpose
- **Dependency injection**: Where it makes sense
- **Config-driven**: Environment variables for all config

### Testing Strategy
- **Unit tests**: All business logic
- **Integration tests**: All API endpoints
- **E2E tests**: Critical user flows
- **Target**: >80% code coverage

### Documentation
- **Inline comments**: For complex logic only
- **JSDoc**: For public functions
- **README**: Setup and quick start
- **Developer docs**: Modular (max 300 lines each)
- **API docs**: OpenAPI/Swagger

## File Storage

### Storage Strategy
**Choice**: **Local filesystem (initially), S3-compatible (future)**

**Why**:
- ✅ Simple for start
- ✅ No extra costs
- ✅ Easy migration to S3 later

**Structure**:
```
storage/
  organizations/
    {org_id}/
      invoices/
        {year}/
          {invoice_id}.pdf
          {invoice_id}_nav.xml
```

**Future**: Migrate to S3 or Contabo Object Storage when needed

## Version Control

### Git Strategy
- **Main branch**: Production-ready code
- **Develop branch**: Integration branch
- **Feature branches**: One per feature
- **Semantic versioning**: v1.0.0 format

## Summary Table

| Category | Technology | Rationale |
|----------|-----------|-----------|
| Runtime | Node.js 20 LTS | Stable, great ecosystem |
| Language | TypeScript | Type safety for finance |
| Framework | Express.js | Mature, simple |
| Database | PostgreSQL 15 | ACID, multi-tenant |
| ORM | Prisma | Best TypeScript DX |
| Cache/Jobs | Redis 7 + BullMQ | Fast, reliable |
| Payments | Stripe | Best API, supports HUF |
| PDF | Puppeteer | HTML→PDF, full control |
| Testing | Jest + Supertest | Standard, great support |
| i18n | i18next | Mature, flexible |
| Logging | Pino | Fast, structured |
| Errors | Sentry | Best error tracking |
| Deployment | Contabo VPS | Cost-effective start |
| Web Server | Nginx | Standard, performant |
| SSL | Let's Encrypt | Free, trusted |
| Process | PM2 | Node.js standard |

## Trade-offs & Justifications

### Why NOT microservices?
- **Too complex** for initial MVP
- **Operational overhead** not justified
- **Can refactor later** if needed
- **Monolith first** is proven approach

### Why NOT GraphQL?
- **REST is simpler** for this use case
- **CRUD-heavy** operations
- **No need** for flexible queries
- **Client control** not needed

### Why NOT serverless?
- **NAV integration** needs long-running processes
- **Background jobs** better on VPS
- **Cost** unpredictable with invoice volume
- **Complexity** not worth it initially

### Why NOT Docker in production (initially)?
- **Simpler deployment** to start
- **Less resource overhead**
- **Easier debugging** on VPS
- **Can add later** if needed

## Migration Paths

### When to consider migration:

**To Cloud (AWS/GCP)**:
- > 10,000 invoices/day
- Need auto-scaling
- Multiple regions needed
- Budget allows ($500+/month)

**To Microservices**:
- > 5 developers on team
- Clear bounded contexts emerge
- Performance bottlenecks in specific areas
- Need independent scaling

**To S3 Storage**:
- > 100GB files
- Need CDN distribution
- Backup/restore complexity
- Budget allows

## Conclusion

This stack is optimized for:
- ✅ **Rapid development** (get to market fast)
- ✅ **Type safety** (prevent financial bugs)
- ✅ **Scalability** (can grow to thousands of users)
- ✅ **Maintainability** (easy to understand and modify)
- ✅ **Cost-effectiveness** (€13/month to start)
- ✅ **Developer experience** (modern tools, good DX)

All decisions can be revisited as the project grows. Start simple, scale when needed.
