# Setup Guide

Get your development environment up and running.

**Related docs**: [Project Structure](./02-project-structure.md) | [Environment Variables](./17-environment-variables.md) | [Docker Guide](./14-docker.md)

## Prerequisites

### Required Software

- **Node.js**: 20.x LTS or higher
- **PostgreSQL**: 15.x or higher
- **Redis**: 7.x or higher
- **Docker & Docker Compose**: Latest stable (recommended for development)
- **Git**: 2.x or higher

### Optional Tools

- **Postman/Insomnia**: API testing
- **pgAdmin/DBeaver**: Database GUI
- **Redis Commander**: Redis GUI

## Installation Methods

### Method 1: Docker Compose (Recommended)

**Fastest way to get started**

```bash
# Clone repository
git clone <repository-url>
cd szamla-api

# Copy environment template
cp .env.example .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Run migrations
docker-compose exec api npm run db:migrate

# Create test organization and API key
docker-compose exec api npm run seed:dev
```

API available at: `http://localhost:3000`

### Method 2: Local Installation

**For native development**

#### Step 1: Install Node.js Dependencies

```bash
# Clone repository
git clone <repository-url>
cd szamla-api

# Install dependencies
npm install
```

#### Step 2: Setup PostgreSQL

```bash
# Using Docker
docker run -d \
  --name szamla-postgres \
  -e POSTGRES_DB=szamla_api \
  -e POSTGRES_USER=szamla \
  -e POSTGRES_PASSWORD=dev_password \
  -p 5432:5432 \
  postgres:15-alpine

# OR install PostgreSQL natively
# macOS: brew install postgresql@15
# Ubuntu: sudo apt install postgresql-15
# Windows: Download from postgresql.org

# Create database
createdb szamla_api
```

#### Step 3: Setup Redis

```bash
# Using Docker
docker run -d \
  --name szamla-redis \
  -p 6379:6379 \
  redis:7-alpine

# OR install Redis natively
# macOS: brew install redis
# Ubuntu: sudo apt install redis-server
# Windows: Use WSL or Docker
```

#### Step 4: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your database credentials
nano .env
```

See [Environment Variables](./17-environment-variables.md) for complete reference.

#### Step 5: Run Migrations

```bash
npm run db:migrate
```

#### Step 6: Start Development Server

```bash
npm run dev
```

API available at: `http://localhost:3000`

## Environment Configuration

### Minimal .env File

```env
# Server
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://szamla:dev_password@localhost:5432/szamla_api

# Redis
REDIS_URL=redis://localhost:6379

# Security
API_KEY_SECRET=change-this-in-production-min-32-chars
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef

# NAV (Test Environment)
NAV_BASE_URL=https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3
NAV_TIMEOUT_MS=70000
```

### Generate Secure Keys

```bash
# API key secret (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Encryption key (32 bytes hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Verify Installation

### 1. Check Health Endpoint

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:00:00Z",
  "database": "connected",
  "redis": "connected",
  "version": "1.0.0"
}
```

### 2. Check Database Connection

```bash
npm run db:check
```

### 3. Run Tests

```bash
npm test
```

## Seed Development Data

### Create Test Organization

```bash
npm run seed:dev
```

This creates:
- Test organization (org_test_123)
- Test API key (printed to console)
- Sample partner
- Sample invoices

### Create Production-like Data

```bash
npm run seed:production
```

## Common Setup Issues

### PostgreSQL Connection Refused

```bash
# Check if PostgreSQL is running
docker ps | grep postgres
# OR
pg_isready

# Check connection string in .env
echo $DATABASE_URL
```

### Redis Connection Refused

```bash
# Check if Redis is running
docker ps | grep redis
# OR
redis-cli ping

# Should return: PONG
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000
# OR
netstat -an | grep 3000

# Kill process
kill -9 <PID>

# OR change PORT in .env
PORT=3001
```

### Node Module Issues

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Migration Failures

```bash
# Reset database (WARNING: deletes all data)
npm run db:reset

# Run migrations again
npm run db:migrate

# Check migration status
npm run db:migrate:status
```

## IDE Setup

### VS Code (Recommended)

**Extensions:**
- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Prisma (if using Prisma)
- PostgreSQL
- Thunder Client (API testing)
- Docker

**Settings (.vscode/settings.json):**
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

### JetBrains WebStorm

- Enable TypeScript support
- Configure ESLint
- Configure Prettier
- Setup Node.js interpreter
- Configure database connection

## Next Steps

Now that your environment is set up:

1. **Understand the codebase**: [Project Structure](./02-project-structure.md)
2. **Learn the workflow**: [Development Workflow](./03-development-workflow.md)
3. **Make your first API call**: [Authentication](./05-authentication.md)
4. **Create an invoice**: [Invoice Management](./07-invoices.md)

## Additional Resources

- [Docker Guide](./14-docker.md) - Advanced Docker usage
- [Troubleshooting](./19-troubleshooting.md) - Common issues
- [Environment Variables](./17-environment-variables.md) - Complete reference
