# Docker Security Best Practices

## Redis Security Configuration

### 🔒 Current Setup (Secure)

**Redis is configured with:**
1. ✅ **Password authentication** (`--requirepass`)
2. ✅ **Internal network only** (no host port exposure)
3. ✅ **Persistence enabled** (`--appendonly yes`)
4. ✅ **Memory limits** (`maxmemory 512mb`)

### Network Isolation

```yaml
# Redis service (no ports exposed!)
redis:
  # ... configuration
  networks:
    - szamla-internal
  # NO ports: - '6379:6379' ❌
```

**Result**: Redis is **only accessible within Docker network**, not from host machine!

### Connecting to Redis

#### From Local Development (npm run dev)

When running the API locally (outside Docker):

```env
# .env
REDIS_URL=redis://:dev_redis_password@localhost:6379
REDIS_PASSWORD=dev_redis_password
```

**Problem**: Redis is not exposed on localhost!

**Solution 1 - Expose Redis for development** (add to docker-compose.yml):

```yaml
redis:
  ports:
    - '127.0.0.1:6379:6379'  # Only bind to localhost, not 0.0.0.0
```

**Solution 2 - Run API in Docker** (recommended):

```bash
# Uncomment the 'api' service in docker-compose.yml
docker-compose up -d
```

#### From Docker API Container

When running API inside Docker:

```yaml
api:
  environment:
    REDIS_URL: redis://:dev_redis_password@redis:6379
```

**Connection works** because both are on `szamla-internal` network!

## Production Configuration

### docker-compose.prod.yml

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    restart: always
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD}
      --maxmemory 1gb
      --maxmemory-policy allkeys-lru
      --appendonly yes
      --protected-mode yes
      --bind 0.0.0.0
    volumes:
      - redis_data:/data
    networks:
      - szamla-internal
    # NO PORTS EXPOSED IN PRODUCTION!

  api:
    image: szamla-api:latest
    restart: always
    environment:
      NODE_ENV: production
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
    depends_on:
      - redis
    networks:
      - szamla-internal
      - public  # For external access

networks:
  szamla-internal:
    driver: bridge
    internal: true  # No internet access
  public:
    driver: bridge
```

### Production Environment Variables

```env
# .env.production
REDIS_PASSWORD=YOUR_STRONG_REDIS_PASSWORD_HERE
# Generate with: openssl rand -base64 32
```

**Never use default passwords in production!**

## Security Checklist

### ✅ Redis Configuration

- [x] **Password authentication enabled**
- [x] **No ports exposed to host** (internal network only)
- [x] **Persistence enabled** (AOF)
- [x] **Memory limits set**
- [x] **Protected mode enabled** (production)
- [x] **Bind to correct interface** (0.0.0.0 inside Docker, 127.0.0.1 if exposed)

### ✅ Network Configuration

- [x] **Internal network for services**
- [x] **External network for API only**
- [x] **No direct Redis access from outside**
- [x] **Database on internal network**

### ✅ Environment Variables

- [x] **Secrets in .env (not committed)**
- [x] **Strong passwords in production**
- [x] **Password validation in config**

## Development Workflow

### Option 1: Run API Locally (Current Setup)

**Pros**: Fast feedback, easy debugging
**Cons**: Redis not accessible (need to expose port)

```bash
# Add to docker-compose.yml temporarily:
redis:
  ports:
    - '127.0.0.1:6379:6379'

# Restart Redis
docker-compose restart redis

# Run API locally
npm run dev
```

### Option 2: Run Everything in Docker (Recommended)

**Pros**: Production-like, secure by default
**Cons**: Slightly slower feedback loop

```bash
# Uncomment 'api' service in docker-compose.yml
docker-compose up -d

# View logs
docker-compose logs -f api

# Rebuild after changes
docker-compose build api
docker-compose restart api
```

### Option 3: Hybrid Approach

Run database & Redis in Docker, API locally, but expose Redis on localhost:

```yaml
# docker-compose.override.yml
version: '3.8'

services:
  redis:
    ports:
      - '127.0.0.1:6379:6379'  # Only for development!
```

**Don't commit** `docker-compose.override.yml` to git!

## Testing Redis Connection

### Inside Docker Network

```bash
# Connect to Redis from another container
docker-compose exec redis redis-cli -a dev_redis_password ping
# Should return: PONG

# Check authentication is required
docker-compose exec redis redis-cli ping
# Should return: (error) NOAUTH Authentication required
```

### From Host (if port exposed)

```bash
# With password
redis-cli -h localhost -a dev_redis_password ping

# Without password (should fail)
redis-cli -h localhost ping
# (error) NOAUTH Authentication required
```

## Troubleshooting

### Error: "Redis connection refused"

**Cause**: Redis not accessible from host
**Solution**: See "Option 1" above - expose Redis port for development

### Error: "NOAUTH Authentication required"

**Cause**: No password provided
**Solution**: Check REDIS_URL includes password: `redis://:PASSWORD@host:6379`

### Error: "Redis connection timeout"

**Cause**: Wrong host name
**Solution**:
- From host: use `localhost`
- From Docker: use service name `redis`

## Monitoring

### Check Redis is Running

```bash
docker-compose ps redis
```

### Check Redis Logs

```bash
docker-compose logs redis
```

### Check Redis Memory Usage

```bash
docker-compose exec redis redis-cli -a dev_redis_password INFO memory
```

### Check Connected Clients

```bash
docker-compose exec redis redis-cli -a dev_redis_password CLIENT LIST
```

## Best Practices Summary

1. ✅ **Always use password authentication**
2. ✅ **Never expose Redis to 0.0.0.0 in production**
3. ✅ **Use internal Docker networks**
4. ✅ **Store passwords in environment variables**
5. ✅ **Use strong passwords in production**
6. ✅ **Enable persistence (AOF/RDB)**
7. ✅ **Set memory limits**
8. ✅ **Monitor Redis metrics**

---

**Your Redis is now secure!** 🔒
