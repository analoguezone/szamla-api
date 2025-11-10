# Developer Documentation Index

Welcome to the Számlázó NAV API developer documentation. This documentation is organized into focused files (max 300 lines each) for optimal context loading.

## Quick Navigation

### Getting Started
- **[Setup Guide](./01-setup.md)** - Installation, prerequisites, and initial configuration
- **[Project Structure](./02-project-structure.md)** - Directory layout and file organization
- **[Development Workflow](./03-development-workflow.md)** - Daily development tasks and best practices

### Core Concepts
- **[Multi-tenancy](./04-multi-tenancy.md)** - Organization isolation and scoping
- **[Authentication](./05-authentication.md)** - API keys and authorization
- **[Database Guide](./06-database.md)** - Migrations, models, and queries

### Features
- **[Invoice Management](./07-invoices.md)** - Creating and managing invoices
- **[NAV Integration](./08-nav-integration.md)** - Working with Hungarian NAV system
- **[Usage Tracking](./09-usage-tracking.md)** - Monitoring and billing metrics
- **[Background Jobs](./10-background-jobs.md)** - Async processing and queues

### Testing & Quality
- **[Testing Guide](./11-testing.md)** - Unit, integration, and E2E tests
- **[API Testing](./12-api-testing.md)** - Testing REST endpoints
- **[Debugging](./13-debugging.md)** - Troubleshooting and debugging techniques

### Deployment & Operations
- **[Docker Guide](./14-docker.md)** - Container development and deployment
- **[Production Deployment](./15-production.md)** - Going to production
- **[Monitoring & Logging](./16-monitoring.md)** - Observability and alerting

### Reference
- **[Environment Variables](./17-environment-variables.md)** - Complete env var reference
- **[CLI Commands](./18-cli-commands.md)** - Available npm scripts and utilities
- **[Troubleshooting](./19-troubleshooting.md)** - Common issues and solutions

## Architecture Documentation

For high-level architecture and design:
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture and design
- [DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md) - Complete database schema
- [API_DESIGN.md](../API_DESIGN.md) - REST API specifications
- [DEVELOPMENT_PLAN.md](../DEVELOPMENT_PLAN.md) - Roadmap and planning

## Quick Start

New to the project? Start here:

1. [Setup Guide](./01-setup.md) - Get your environment running
2. [Project Structure](./02-project-structure.md) - Understand the codebase
3. [Development Workflow](./03-development-workflow.md) - Learn daily workflows
4. [Authentication](./05-authentication.md) - Make your first authenticated request

## Contributing

See each guide for specific contribution guidelines. General rules:
- Keep files under 300 lines
- Add cross-references to related docs
- Update index when adding new files
- Follow existing formatting conventions

## Additional Resources

- NAV Documentation: https://onlineszamla.nav.gov.hu/dokumentaciok
- nav-connector: https://github.com/angro-kft/nav-connector
- Billingo API Reference: https://app.swaggerhub.com/apis/Billingo/Billingo/3.0.14
