# Environment Variables Reference

Complete reference for all environment variables.

**Related docs**: [Setup Guide](./01-setup.md) | [Production Deployment](./15-production.md) | [Docker Guide](./14-docker.md)

## Required Variables

### Server Configuration

```env
# Node environment (development, production, test)
NODE_ENV=development

# Server port
PORT=3000

# API base URL (for generating links, webhooks)
API_BASE_URL=http://localhost:3000
```

### Database

```env
# PostgreSQL connection string
DATABASE_URL=postgresql://user:password@localhost:5432/szamla_api

# Alternative: separate components
DB_HOST=localhost
DB_PORT=5432
DB_NAME=szamla_api
DB_USER=szamla
DB_PASSWORD=your_secure_password

# Connection pool
DB_POOL_MIN=2
DB_POOL_MAX=10
```

### Redis

```env
# Redis connection string
REDIS_URL=redis://localhost:6379

# Alternative: separate components
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### Security

```env
# Secret for API key hashing (min 32 characters)
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
API_KEY_SECRET=your-super-secret-key-change-in-production-min-32-chars

# Encryption key for NAV credentials (32 bytes hex = 64 chars)
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

### NAV API

```env
# NAV API base URL
# Test: https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3
# Production: https://api.onlineszamla.nav.gov.hu/invoiceService/v3
NAV_BASE_URL=https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3

# NAV request timeout (milliseconds)
# NAV documentation recommends > 60000ms
NAV_TIMEOUT_MS=70000

# NAV API version
NAV_API_VERSION=v3
```

## Optional Variables

### File Storage

```env
# Storage type (local, s3)
STORAGE_TYPE=local

# Local storage path
STORAGE_PATH=./storage

# S3 configuration (if STORAGE_TYPE=s3)
S3_BUCKET=szamla-api-files
S3_REGION=eu-central-1
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key
S3_ENDPOINT=https://s3.eu-central-1.amazonaws.com
```

### Logging

```env
# Log level (error, warn, info, debug)
LOG_LEVEL=info

# Log format (json, pretty)
LOG_FORMAT=pretty

# Log file path (optional, defaults to stdout only)
LOG_FILE=./logs/app.log
```

### CORS

```env
# Allowed origins (comma-separated)
CORS_ORIGINS=http://localhost:3000,https://app.example.com

# Allow credentials
CORS_CREDENTIALS=true
```

### Rate Limiting

```env
# Default rate limits
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60

# Rate limit by tier
RATE_LIMIT_BASIC=60
RATE_LIMIT_PRO=300
RATE_LIMIT_ENTERPRISE=1000
```

### Email (Future)

```env
# SMTP configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=noreply@example.com
SMTP_PASSWORD=your_smtp_password
SMTP_FROM=Számlázó API <noreply@example.com>
```

### Monitoring

```env
# Sentry DSN (error tracking)
SENTRY_DSN=https://xxx@sentry.io/xxx

# Prometheus metrics
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090
```

### Background Jobs

```env
# Bull queue prefix
BULL_QUEUE_PREFIX=szamla

# Job retention
BULL_REMOVE_ON_COMPLETE=100
BULL_REMOVE_ON_FAIL=500
```

## Environment-Specific Configuration

### Development (.env.development)

```env
NODE_ENV=development
PORT=3000
API_BASE_URL=http://localhost:3000

DATABASE_URL=postgresql://szamla:dev_password@localhost:5432/szamla_api_dev
REDIS_URL=redis://localhost:6379

API_KEY_SECRET=dev-secret-key-not-for-production-use-only
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

NAV_BASE_URL=https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3
NAV_TIMEOUT_MS=70000

STORAGE_TYPE=local
STORAGE_PATH=./storage

LOG_LEVEL=debug
LOG_FORMAT=pretty

CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

### Testing (.env.test)

```env
NODE_ENV=test
PORT=3001

DATABASE_URL=postgresql://szamla:test_password@localhost:5432/szamla_api_test
REDIS_URL=redis://localhost:6379/1

API_KEY_SECRET=test-secret-key
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

NAV_BASE_URL=https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3

STORAGE_TYPE=local
STORAGE_PATH=./storage-test

LOG_LEVEL=error
LOG_FORMAT=json
```

### Production (.env.production)

```env
NODE_ENV=production
PORT=3000
API_BASE_URL=https://api.szamla.example.com

DATABASE_URL=postgresql://szamla_prod:STRONG_PASSWORD@prod-db.example.com:5432/szamla_api
REDIS_URL=redis://:REDIS_PASSWORD@prod-redis.example.com:6379

API_KEY_SECRET=GENERATE_STRONG_SECRET_HERE
ENCRYPTION_KEY=GENERATE_STRONG_ENCRYPTION_KEY_HERE

NAV_BASE_URL=https://api.onlineszamla.nav.gov.hu/invoiceService/v3
NAV_TIMEOUT_MS=70000

STORAGE_TYPE=s3
S3_BUCKET=szamla-api-production
S3_REGION=eu-central-1
S3_ACCESS_KEY_ID=prod_access_key
S3_SECRET_ACCESS_KEY=prod_secret_key

LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE=/var/log/szamla-api/app.log

CORS_ORIGINS=https://app.example.com,https://dashboard.example.com

SENTRY_DSN=https://xxx@sentry.io/xxx

PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090
```

## Validation

### Check Required Variables

```typescript
// src/config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  API_KEY_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().length(64),
  NAV_BASE_URL: z.string().url(),
  NAV_TIMEOUT_MS: z.coerce.number().default(70000)
});

export const env = envSchema.parse(process.env);
```

### Startup Validation

```bash
npm run env:validate
```

## Security Best Practices

### 1. Never Commit .env Files

```gitignore
# .gitignore
.env
.env.*
!.env.example
```

### 2. Use Strong Secrets

```bash
# Generate API key secret (32+ bytes)
openssl rand -hex 32

# Generate encryption key (32 bytes = 64 hex chars)
openssl rand -hex 32
```

### 3. Rotate Secrets Regularly

```bash
# Production: rotate every 90 days
# Update .env
# Restart application
# Revoke old API keys
```

### 4. Use Secret Management

For production, consider:
- AWS Secrets Manager
- HashiCorp Vault
- Azure Key Vault
- Google Secret Manager

```typescript
// Example: AWS Secrets Manager
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

async function loadSecrets() {
  const client = new SecretsManager({ region: 'eu-central-1' });
  const secret = await client.getSecretValue({
    SecretId: 'szamla-api/production'
  });

  const secrets = JSON.parse(secret.SecretString);

  process.env.DATABASE_URL = secrets.DATABASE_URL;
  process.env.API_KEY_SECRET = secrets.API_KEY_SECRET;
  // ...
}
```

## Docker Configuration

### docker-compose.yml

```yaml
services:
  api:
    env_file:
      - .env
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://szamla:dev_password@postgres:5432/szamla_api
      - REDIS_URL=redis://redis:6379
```

### Dockerfile

```dockerfile
# Don't copy .env to image
# Pass via docker run or docker-compose

ENV NODE_ENV=production
ENV PORT=3000

# Secrets should be passed at runtime
```

## Accessing Environment Variables

### In Code

```typescript
import { config } from './config';

// Typed access
const dbUrl = config.database.url;
const navBaseUrl = config.nav.baseUrl;

// Raw access (not recommended)
const port = process.env.PORT;
```

### Config Module

```typescript
// src/config/index.ts
export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  database: {
    url: process.env.DATABASE_URL!,
    poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DB_POOL_MAX || '10', 10)
  },

  redis: {
    url: process.env.REDIS_URL!
  },

  nav: {
    baseUrl: process.env.NAV_BASE_URL!,
    timeout: parseInt(process.env.NAV_TIMEOUT_MS || '70000', 10),
    apiVersion: process.env.NAV_API_VERSION || 'v3'
  },

  security: {
    apiKeySecret: process.env.API_KEY_SECRET!,
    encryptionKey: process.env.ENCRYPTION_KEY!
  },

  storage: {
    type: process.env.STORAGE_TYPE || 'local',
    path: process.env.STORAGE_PATH || './storage'
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'pretty'
  }
};
```

## Troubleshooting

### Missing Required Variable

```
Error: Environment variable DATABASE_URL is required
```

**Solution**: Add the variable to your .env file

### Invalid Format

```
Error: DATABASE_URL must be a valid URL
```

**Solution**: Check the connection string format:
```
postgresql://user:password@host:port/database
```

### Permission Issues

```
Error: Cannot read .env file
```

**Solution**:
```bash
chmod 600 .env
```

### Wrong Environment Loaded

```bash
# Check which env file is loaded
node -e "console.log(process.env.NODE_ENV)"

# Force specific environment
NODE_ENV=production npm start
```

## Template

### .env.example

```env
# =================================
# Server Configuration
# =================================
NODE_ENV=development
PORT=3000
API_BASE_URL=http://localhost:3000

# =================================
# Database
# =================================
DATABASE_URL=postgresql://user:password@localhost:5432/szamla_api

# =================================
# Redis
# =================================
REDIS_URL=redis://localhost:6379

# =================================
# Security (CHANGE IN PRODUCTION!)
# =================================
API_KEY_SECRET=your-super-secret-key-change-in-production
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef

# =================================
# NAV API
# =================================
NAV_BASE_URL=https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3
NAV_TIMEOUT_MS=70000

# =================================
# Storage
# =================================
STORAGE_TYPE=local
STORAGE_PATH=./storage

# =================================
# Logging
# =================================
LOG_LEVEL=info
LOG_FORMAT=pretty

# =================================
# Optional
# =================================
# CORS_ORIGINS=http://localhost:3000
# SENTRY_DSN=
# PROMETHEUS_ENABLED=false
```

## Next Steps

- **Setup your environment**: [Setup Guide](./01-setup.md)
- **Deploy to production**: [Production Deployment](./15-production.md)
- **Use with Docker**: [Docker Guide](./14-docker.md)
