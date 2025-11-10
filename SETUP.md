# Setup Instructions

Quick start guide for developers.

## Prerequisites

- Node.js 20+ LTS
- Docker & Docker Compose
- Git

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

**Important**: The default configuration has Redis with password authentication.

### 3. Start Database Services

```bash
docker-compose up -d postgres redis
```

Wait for services to be healthy:
```bash
docker-compose ps
```

### 4. Run Database Migrations

```bash
npm run db:generate  # Generate Prisma Client
npm run db:push      # Push schema to database
```

### 5. Choose Development Approach

#### Option A: Run API Locally (Recommended for Development)

**Note**: Redis is not exposed by default for security. You have two choices:

**5a.1 - Temporarily expose Redis for local development:**

Create `docker-compose.override.yml`:
```yaml
version: '3.8'
services:
  redis:
    ports:
      - '127.0.0.1:6379:6379'
```

Then restart Redis:
```bash
docker-compose restart redis
```

**5a.2 - Start development server:**
```bash
npm run dev
```

#### Option B: Run Everything in Docker (Production-like)

Uncomment the `api` service in `docker-compose.yml`, then:

```bash
docker-compose up -d
docker-compose logs -f api
```

## Verify Installation

### Check Health Endpoint

```bash
curl http://localhost:3000/api/v1/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2025-01-15T10:00:00.000Z",
    "uptime": 1.234,
    "environment": "development",
    "version": "1.0.0"
  }
}
```

### Check Readiness

```bash
curl http://localhost:3000/api/v1/health/ready
```

Expected response:
```json
{
  "success": true,
  "data": {
    "database": "connected",
    "redis": "connected",
    "ready": true
  }
}
```

## Security Notes

### Redis Configuration

✅ **Secure by default**:
- Redis requires password authentication
- Redis is **not exposed** to host machine (internal network only)
- Only accessible from within Docker network

**For local development**, you need to either:
1. Expose Redis on localhost (Option A above)
2. Run API inside Docker (Option B above)

See [DOCKER_SECURITY.md](./docs/DOCKER_SECURITY.md) for details.

## Development Workflow

### Run in Development Mode (with hot reload)

```bash
npm run dev
```

### Build for Production

```bash
npm run build
npm start
```

### Run Tests

```bash
npm test
npm run test:coverage
```

### Lint Code

```bash
npm run lint
npm run lint:fix
```

### Format Code

```bash
npm run format
```

### Database Commands

```bash
# Generate Prisma Client
npm run db:generate

# Push schema changes
npm run db:push

# Create migration
npm run db:migrate:create

# Run migrations
npm run db:migrate

# Open Prisma Studio
npm run db:studio

# Reset database (WARNING: deletes all data!)
npm run db:migrate:reset
```

## Troubleshooting

### Redis Connection Failed

**Error**: `Redis connection refused` or `ECONNREFUSED`

**Cause**: Redis is not exposed to host (by design for security)

**Solution**:
1. Create `docker-compose.override.yml` (see Option A above)
2. Or run API in Docker (see Option B above)

### Redis Authentication Failed

**Error**: `NOAUTH Authentication required`

**Cause**: No password in REDIS_URL

**Solution**: Check `.env` file:
```env
REDIS_URL=redis://:dev_redis_password@localhost:6379
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000
# Kill it
kill -9 <PID>
```

### Database Connection Failed

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Restart services
docker-compose restart postgres
```

## Docker Commands

### Start Services

```bash
docker-compose up -d
```

### Stop Services

```bash
docker-compose down
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f redis
```

### Restart Service

```bash
docker-compose restart redis
docker-compose restart postgres
```

### Check Service Health

```bash
docker-compose ps
```

### Enter Container Shell

```bash
# Redis
docker-compose exec redis sh

# PostgreSQL
docker-compose exec postgres sh

# API
docker-compose exec api sh
```

## Project Structure

```
szamla-api/
├── src/                 # Source code
│   ├── config/         # Configuration
│   ├── controllers/    # Request handlers
│   ├── middleware/     # Express middleware
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── utils/          # Helper functions
│   ├── app.ts          # Express app setup
│   └── index.ts        # Entry point
├── tests/              # Test files
├── prisma/             # Database schema
├── docs/               # Documentation
└── docker-compose.yml  # Local development services
```

## Environment Variables

See [.env.example](./.env.example) for all available variables.

**Critical variables**:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection (with password!)
- `REDIS_PASSWORD` - Redis password
- `API_KEY_SECRET` - For API key hashing
- `ENCRYPTION_KEY` - For NAV credential encryption

**Generate secrets**:
```bash
# API key secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Redis password
openssl rand -base64 32
```

## Next Steps

1. Read [DOCKER_SECURITY.md](./docs/DOCKER_SECURITY.md) for security details
2. Read [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
3. Read [API_DESIGN.md](./API_DESIGN.md) for API specifications
4. Read [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) for roadmap
5. Start implementing features!

## Need Help?

- Documentation: `./docs/` folder
- Docker Security: `./docs/DOCKER_SECURITY.md`
- Issues: GitHub Issues
- Questions: Create a discussion
