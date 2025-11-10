# Deployment Guide - Contabo VPS

Step-by-step deployment guide for Contabo Linux servers.

**Related**: [Production Deployment](./15-production.md) | [Environment Variables](./17-environment-variables.md)

## Server Recommendations

### Recommended Contabo VPS Plan

**For Starting (< 1000 invoices/day)**:
- **VPS M**: 8 vCPU, 16 GB RAM, 400 GB SSD NVMe
- **Cost**: ~€10-15/month
- **Location**: Germany or UK (closest to Hungary)

**For Growth (< 10000 invoices/day)**:
- **VPS L**: 10 vCPU, 30 GB RAM, 800 GB SSD NVMe
- **Cost**: ~€20-25/month

**For Scale (> 10000 invoices/day)**:
- Consider horizontal scaling with load balancer
- Multiple VPS M instances + separate DB server

## Initial Server Setup

### 1. Connect to Server

```bash
ssh root@your-server-ip
```

### 2. Create Deploy User

```bash
# Create user
adduser szamla
usermod -aG sudo szamla

# Setup SSH key
mkdir /home/szamla/.ssh
cp ~/.ssh/authorized_keys /home/szamla/.ssh/
chown -R szamla:szamla /home/szamla/.ssh
chmod 700 /home/szamla/.ssh
chmod 600 /home/szamla/.ssh/authorized_keys

# Test login
# From local: ssh szamla@your-server-ip
```

### 3. Update System

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential ufw fail2ban
```

### 4. Setup Firewall

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

# Check status
sudo ufw status
```

### 5. Install Node.js

```bash
# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version  # Should be v20.x
npm --version
```

### 6. Install PostgreSQL

```bash
# Install PostgreSQL 15
sudo apt install -y postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql <<EOF
CREATE DATABASE szamla_api;
CREATE USER szamla WITH ENCRYPTED PASSWORD 'STRONG_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON DATABASE szamla_api TO szamla;
\q
EOF

# Configure remote access (if needed)
sudo nano /etc/postgresql/15/main/postgresql.conf
# Set: listen_addresses = 'localhost'

sudo nano /etc/postgresql/15/main/pg_hba.conf
# Add: local   all   szamla   md5

sudo systemctl restart postgresql
```

### 7. Install Redis

```bash
# Install Redis
sudo apt install -y redis-server

# Configure
sudo nano /etc/redis/redis.conf
# Set: supervised systemd
# Set: maxmemory 512mb
# Set: maxmemory-policy allkeys-lru

# Start service
sudo systemctl start redis
sudo systemctl enable redis

# Test
redis-cli ping  # Should return PONG
```

### 8. Install Nginx

```bash
sudo apt install -y nginx

# Start service
sudo systemctl start nginx
sudo systemctl enable nginx
```

## Application Deployment

### 1. Clone Repository

```bash
cd /home/szamla
git clone <your-repo-url> szamla-api
cd szamla-api
```

### 2. Install Dependencies

```bash
npm ci --production
```

### 3. Setup Environment

```bash
# Copy environment template
cp .env.example .env

# Edit with production values
nano .env
```

**Production .env**:
```env
NODE_ENV=production
PORT=3000
API_BASE_URL=https://api.yourdomain.com

DATABASE_URL=postgresql://szamla:STRONG_PASSWORD@localhost:5432/szamla_api
REDIS_URL=redis://localhost:6379

API_KEY_SECRET=GENERATE_STRONG_SECRET_64_CHARS
ENCRYPTION_KEY=GENERATE_STRONG_KEY_64_CHARS

NAV_BASE_URL=https://api.onlineszamla.nav.gov.hu/invoiceService/v3
NAV_TIMEOUT_MS=70000

STORAGE_PATH=/home/szamla/szamla-api/storage

LOG_LEVEL=info
LOG_FORMAT=json

STRIPE_SECRET_KEY=sk_live_your_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Build Application

```bash
npm run build
```

### 5. Run Migrations

```bash
npm run db:migrate
```

### 6. Setup PM2 (Process Manager)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Create PM2 ecosystem file
nano ecosystem.config.js
```

**ecosystem.config.js**:
```javascript
module.exports = {
  apps: [{
    name: 'szamla-api',
    script: './dist/index.js',
    instances: 2, // Use 2 CPU cores
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '1G',
    autorestart: true,
    watch: false
  }, {
    name: 'szamla-jobs',
    script: './dist/jobs/worker.js',
    instances: 1,
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

Start application:
```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 config
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Run the command it outputs

# Check status
pm2 status
pm2 logs
```

### 7. Configure Nginx Reverse Proxy

```bash
sudo nano /etc/nginx/sites-available/szamla-api
```

**Nginx config**:
```nginx
upstream szamla_api {
    least_conn;
    server 127.0.0.1:3000;
}

# HTTP -> HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name api.yourdomain.com;

    return 301 https://$server_name$request_uri;
}

# HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.yourdomain.com;

    # SSL certificates (we'll add with certbot)
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logs
    access_log /var/log/nginx/szamla-api-access.log;
    error_log /var/log/nginx/szamla-api-error.log;

    # Client limits
    client_max_body_size 10M;

    # Proxy to Node.js
    location / {
        proxy_pass http://szamla_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint (no rate limiting)
    location /health {
        proxy_pass http://szamla_api;
        access_log off;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/szamla-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 8. Setup SSL with Let's Encrypt

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal is setup automatically
# Test renewal:
sudo certbot renew --dry-run
```

## Monitoring & Logging

### 1. Setup Log Rotation

```bash
sudo nano /etc/logrotate.d/szamla-api
```

```
/home/szamla/szamla-api/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 szamla szamla
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 2. Basic Monitoring Script

```bash
nano ~/monitor.sh
```

```bash
#!/bin/bash

# Check if API is responding
if ! curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "API is down! Restarting..."
    pm2 restart szamla-api
    echo "API down at $(date)" >> /home/szamla/downtime.log
fi

# Check disk space
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "Disk usage is at ${DISK_USAGE}%" | mail -s "Disk Space Alert" your@email.com
fi

# Check memory
MEM_USAGE=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
if [ $MEM_USAGE -gt 85 ]; then
    echo "Memory usage is at ${MEM_USAGE}%" | mail -s "Memory Alert" your@email.com
fi
```

```bash
chmod +x ~/monitor.sh

# Add to crontab (runs every 5 minutes)
crontab -e
# Add: */5 * * * * /home/szamla/monitor.sh
```

### 3. Database Backups

```bash
nano ~/backup.sh
```

```bash
#!/bin/bash

BACKUP_DIR="/home/szamla/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="szamla_api"
DB_USER="szamla"

mkdir -p $BACKUP_DIR

# Backup database
PGPASSWORD='YOUR_DB_PASSWORD' pg_dump -U $DB_USER -h localhost $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup files
tar -czf $BACKUP_DIR/files_$DATE.tar.gz /home/szamla/szamla-api/storage

# Keep only last 7 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete
find $BACKUP_DIR -name "files_*.tar.gz" -mtime +7 -delete

# Optional: Upload to S3 or object storage
# aws s3 cp $BACKUP_DIR/db_$DATE.sql.gz s3://your-bucket/backups/
```

```bash
chmod +x ~/backup.sh

# Daily backup at 2 AM
crontab -e
# Add: 0 2 * * * /home/szamla/backup.sh
```

## Deployment Updates

### Deploy New Version

```bash
# SSH to server
ssh szamla@your-server-ip

cd /home/szamla/szamla-api

# Pull latest code
git pull origin main

# Install dependencies
npm ci --production

# Build
npm run build

# Run migrations
npm run db:migrate

# Restart with zero downtime
pm2 reload szamla-api

# Check logs
pm2 logs szamla-api --lines 50
```

### Rollback

```bash
# Check previous commit
git log --oneline -5

# Rollback to previous version
git reset --hard <commit-hash>
npm ci --production
npm run build
pm2 reload szamla-api
```

## Security Hardening

### 1. Disable Root Login

```bash
sudo nano /etc/ssh/sshd_config
```

```
PermitRootLogin no
PasswordAuthentication no
```

```bash
sudo systemctl restart sshd
```

### 2. Configure Fail2Ban

```bash
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
```

```bash
sudo systemctl restart fail2ban
```

### 3. Setup Automated Updates

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## Performance Tuning

### PostgreSQL

```bash
sudo nano /etc/postgresql/15/main/postgresql.conf
```

```
# For 16GB RAM server
shared_buffers = 4GB
effective_cache_size = 12GB
maintenance_work_mem = 1GB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 10MB
min_wal_size = 1GB
max_wal_size = 4GB
max_worker_processes = 4
max_parallel_workers_per_gather = 2
max_parallel_workers = 4
```

### Nginx

```bash
sudo nano /etc/nginx/nginx.conf
```

```nginx
worker_processes auto;
worker_connections 2048;
keepalive_timeout 30;
client_body_timeout 12;
client_header_timeout 12;
send_timeout 10;

gzip on;
gzip_comp_level 5;
gzip_min_length 256;
gzip_types application/json text/plain text/css application/javascript;
```

## Scaling Considerations

### When to Scale Horizontally

**Indicators**:
- CPU usage consistently > 70%
- Response times > 500ms (p95)
- Memory usage > 80%
- > 10,000 invoices/day

### Horizontal Scaling Setup

1. **Get second VPS** (same size)
2. **Setup load balancer** (Contabo or external like Cloudflare)
3. **Separate database server** (dedicated VPS)
4. **Redis cluster** (3 nodes for HA)
5. **Shared storage** (NFS or S3 for files)

## Troubleshooting

### Application won't start

```bash
# Check logs
pm2 logs szamla-api --lines 100

# Check environment
cat .env

# Check database connection
psql -U szamla -d szamla_api -h localhost
```

### High memory usage

```bash
# Check process memory
pm2 monit

# Restart if needed
pm2 restart szamla-api
```

### Slow database queries

```bash
# Enable slow query log
sudo nano /etc/postgresql/15/main/postgresql.conf
# Set: log_min_duration_statement = 1000  # Log queries > 1s

# Check slow queries
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

## Cost Optimization

**Monthly Costs** (estimated):
- VPS M (16GB): €12
- Domain: €1/month
- SSL: Free (Let's Encrypt)
- **Total**: ~€13/month

**Scaling costs**:
- Additional VPS: +€12/month each
- Load balancer: €5-10/month
- Database VPS: €15-20/month

---

**Deployment Checklist**: See Phase 9 in DEVELOPMENT_PLAN.md
