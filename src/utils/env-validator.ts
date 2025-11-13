import { logger } from '@config/logger';

/**
 * Environment Variable Validator
 *
 * Validates that all required environment variables are set
 * and have valid values
 */

interface EnvConfig {
  name: string;
  required: boolean;
  validate?: (value: string) => boolean;
  errorMessage?: string;
}

const ENV_CONFIGS: EnvConfig[] = [
  // Server
  {
    name: 'NODE_ENV',
    required: true,
    validate: (val) => ['development', 'production', 'test'].includes(val),
    errorMessage: 'NODE_ENV must be one of: development, production, test',
  },
  {
    name: 'PORT',
    required: false,
    validate: (val) => !isNaN(Number(val)) && Number(val) > 0 && Number(val) < 65536,
    errorMessage: 'PORT must be a valid port number (1-65535)',
  },

  // Database
  {
    name: 'DATABASE_URL',
    required: true,
    validate: (val) => val.startsWith('postgresql://') || val.startsWith('postgres://'),
    errorMessage: 'DATABASE_URL must be a valid PostgreSQL connection string',
  },

  // Redis
  {
    name: 'REDIS_URL',
    required: true,
    validate: (val) => val.startsWith('redis://') || val.startsWith('rediss://'),
    errorMessage: 'REDIS_URL must be a valid Redis connection string',
  },

  // Security
  {
    name: 'ENCRYPTION_KEY',
    required: true,
    validate: (val) => val.length >= 32,
    errorMessage: 'ENCRYPTION_KEY must be at least 32 characters long',
  },
  {
    name: 'JWT_SECRET',
    required: false,
    validate: (val) => val.length >= 32,
    errorMessage: 'JWT_SECRET must be at least 32 characters long',
  },

  // Stripe (optional for billing)
  {
    name: 'STRIPE_SECRET_KEY',
    required: false,
    validate: (val) => val.startsWith('sk_'),
    errorMessage: 'STRIPE_SECRET_KEY must start with sk_',
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    required: false,
    validate: (val) => val.startsWith('whsec_'),
    errorMessage: 'STRIPE_WEBHOOK_SECRET must start with whsec_',
  },

  // Logging
  {
    name: 'LOG_LEVEL',
    required: false,
    validate: (val) => ['error', 'warn', 'info', 'debug', 'trace'].includes(val),
    errorMessage: 'LOG_LEVEL must be one of: error, warn, info, debug, trace',
  },
];

/**
 * Validate all environment variables
 *
 * @throws Error if validation fails in production
 * @returns boolean - true if all validations pass
 */
export function validateEnvironment(): boolean {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const config of ENV_CONFIGS) {
    const value = process.env[config.name];

    // Check if required variable is missing
    if (config.required && !value) {
      errors.push(`Missing required environment variable: ${config.name}`);
      continue;
    }

    // Skip validation if optional and not set
    if (!value) {
      if (config.required === false && process.env.NODE_ENV === 'production') {
        warnings.push(`Optional environment variable not set: ${config.name}`);
      }
      continue;
    }

    // Run custom validation if provided
    if (config.validate && !config.validate(value)) {
      errors.push(config.errorMessage || `Invalid value for ${config.name}`);
    }
  }

  // Log warnings
  if (warnings.length > 0) {
    logger.warn({ warnings }, 'Environment validation warnings');
  }

  // Handle errors
  if (errors.length > 0) {
    logger.error({ errors }, 'Environment validation failed');

    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
    }

    // In development, log but don't crash
    logger.warn('Continuing despite environment validation errors (development mode)');
  }

  return errors.length === 0;
}

/**
 * Get environment-specific configuration values
 */
export function getEnvConfig() {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV === 'development',
    isTest: process.env.NODE_ENV === 'test',
    port: parseInt(process.env.PORT || '3000', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
  };
}

/**
 * Mask sensitive environment variables for logging
 */
export function maskSensitiveEnvVars(): Record<string, string> {
  const masked: Record<string, string> = {};
  const sensitiveKeys = [
    'DATABASE_URL',
    'REDIS_URL',
    'ENCRYPTION_KEY',
    'JWT_SECRET',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
  ];

  for (const key of Object.keys(process.env)) {
    if (sensitiveKeys.includes(key)) {
      const value = process.env[key];
      if (value) {
        // Show first 8 and last 4 characters
        if (value.length > 12) {
          masked[key] = `${value.substring(0, 8)}...${value.substring(value.length - 4)}`;
        } else {
          masked[key] = '***';
        }
      }
    } else {
      masked[key] = process.env[key] || '';
    }
  }

  return masked;
}
