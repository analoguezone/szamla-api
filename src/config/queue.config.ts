import { ConnectionOptions } from 'bullmq';

/**
 * Queue Configuration
 *
 * Configures BullMQ connection and queue settings
 */

/**
 * Redis connection options for BullMQ
 */
export const queueConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false, // Required for BullMQ
};

/**
 * Queue names
 */
export const QueueName = {
  NAV_SUBMISSION: 'nav-submission',
  NAV_STATUS_POLLING: 'nav-status-polling',
  PDF_GENERATION: 'pdf-generation',
  USAGE_AGGREGATION: 'usage-aggregation',
} as const;

/**
 * Job options defaults
 */
export const defaultJobOptions = {
  attempts: 3, // Retry failed jobs up to 3 times
  backoff: {
    type: 'exponential' as const,
    delay: 2000, // Start with 2 seconds, then 4s, 8s
  },
  removeOnComplete: {
    age: 86400, // Keep completed jobs for 24 hours
    count: 1000, // Keep max 1000 completed jobs
  },
  removeOnFail: {
    age: 604800, // Keep failed jobs for 7 days
    count: 5000, // Keep max 5000 failed jobs
  },
};

/**
 * Worker concurrency settings
 */
export const workerConcurrency = {
  [QueueName.NAV_SUBMISSION]: 5, // Process 5 NAV submissions concurrently
  [QueueName.NAV_STATUS_POLLING]: 10, // Poll 10 statuses concurrently
  [QueueName.PDF_GENERATION]: 3, // Generate 3 PDFs concurrently (resource intensive)
  [QueueName.USAGE_AGGREGATION]: 1, // Single aggregation job at a time
};
