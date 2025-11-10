import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',

  database: {
    url: process.env.DATABASE_URL!,
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  security: {
    apiKeySecret: process.env.API_KEY_SECRET!,
    encryptionKey: process.env.ENCRYPTION_KEY!,
  },

  nav: {
    baseUrl:
      process.env.NAV_BASE_URL ||
      'https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3',
    timeout: parseInt(process.env.NAV_TIMEOUT_MS || '70000', 10),
    apiVersion: process.env.NAV_API_VERSION || 'v3',
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  },

  storage: {
    type: (process.env.STORAGE_TYPE as 'local' | 's3') || 'local',
    path: process.env.STORAGE_PATH || './storage',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: (process.env.LOG_FORMAT as 'json' | 'pretty') || 'pretty',
  },

  cors: {
    origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60', 10),
  },

  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
} as const;

// Validate required env variables
const requiredEnvVars = ['DATABASE_URL', 'API_KEY_SECRET', 'ENCRYPTION_KEY'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
