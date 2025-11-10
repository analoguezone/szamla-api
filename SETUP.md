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

### 5. Start Development Server

```bash
npm run dev
```

Server will be available at `http://localhost:3000`

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

### Redis Connection Failed

```bash
# Check if Redis is running
docker-compose ps redis

# Test connection
redis-cli ping
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

## Next Steps

1. Read [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
2. Read [API_DESIGN.md](./API_DESIGN.md) for API specifications
3. Read [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) for roadmap
4. Start implementing features!

## Need Help?

- Documentation: `./docs/` folder
- Issues: GitHub Issues
- Questions: Create a discussion
