import { Worker, Job } from 'bullmq';
import { queueConnection, QueueName, workerConcurrency } from '@config/queue.config';
import { navService } from '@services/nav.service';
import { db } from '@config/database';
import { logger } from '@config/logger';

/**
 * NAV Status Polling Job
 *
 * Polls NAV transaction status until completion
 */

export interface NAVStatusPollingJobData {
  invoiceId: string;
  organizationId: string;
  transactionId: string;
  attempt: number;
}

const MAX_POLLING_ATTEMPTS = 20; // Poll for max ~5 minutes
const POLLING_DELAYS = [5000, 10000, 15000, 30000, 60000]; // Progressive delays in ms

/**
 * Process NAV status polling job
 */
async function processNAVStatusPolling(job: Job<NAVStatusPollingJobData>): Promise<void> {
  const { invoiceId, organizationId, transactionId, attempt } = job.data;

  logger.info(`Polling NAV status for invoice ${invoiceId}`, {
    jobId: job.id,
    invoiceId,
    transactionId,
    attempt,
  });

  try {
    // Query transaction status from NAV
    const status = await navService.queryTransactionStatus(transactionId, organizationId);

    if (status.status === 'DONE') {
      // Transaction completed successfully
      logger.info(`NAV transaction completed successfully: ${transactionId}`, {
        jobId: job.id,
        invoiceId,
        transactionId,
      });

      await db.invoice.update({
        where: { id: invoiceId },
        data: {
          navStatus: 'submitted',
          navConfirmedAt: new Date(),
        },
      });
    } else if (status.status === 'ABORTED' || status.status === 'FAILED') {
      // Transaction failed
      logger.error(`NAV transaction failed: ${transactionId}`, {
        jobId: job.id,
        invoiceId,
        transactionId,
        error: status.errorMessage,
      });

      await db.invoice.update({
        where: { id: invoiceId },
        data: {
          navStatus: 'failed',
          navError: status.errorMessage || 'Transaction failed',
        },
      });
    } else if (status.status === 'PROCESSING' || status.status === 'PENDING') {
      // Still processing - schedule another poll
      if (attempt >= MAX_POLLING_ATTEMPTS) {
        logger.warn(`Max polling attempts reached for NAV transaction: ${transactionId}`, {
          jobId: job.id,
          invoiceId,
          transactionId,
        });

        await db.invoice.update({
          where: { id: invoiceId },
          data: {
            navStatus: 'failed',
            navError: 'Timeout waiting for NAV confirmation',
          },
        });
      } else {
        // Schedule next poll with progressive delay
        const delayIndex = Math.min(attempt - 1, POLLING_DELAYS.length - 1);
        const delay = POLLING_DELAYS[delayIndex]!;

        const { queueService } = await import('@services/queue.service');
        await queueService.navStatusPollingQueue.add(
          'poll-nav-status',
          {
            invoiceId,
            organizationId,
            transactionId,
            attempt: attempt + 1,
          },
          { delay }
        );

        logger.info(`Scheduled next NAV status poll for invoice ${invoiceId}`, {
          jobId: job.id,
          invoiceId,
          nextAttempt: attempt + 1,
          delay,
        });
      }
    }
  } catch (error: any) {
    logger.error(`Failed to poll NAV status for invoice ${invoiceId}`, {
      jobId: job.id,
      invoiceId,
      transactionId,
      error: error.message,
      stack: error.stack,
    });

    // Retry polling if not exceeded max attempts
    if (attempt < MAX_POLLING_ATTEMPTS) {
      throw error; // Let BullMQ retry
    } else {
      // Max attempts reached, mark as failed
      await db.invoice.update({
        where: { id: invoiceId },
        data: {
          navStatus: 'failed',
          navError: 'Failed to verify NAV status',
        },
      });
    }
  }
}

/**
 * Create and export the NAV status polling worker
 */
export function createNAVStatusPollingWorker(): Worker<NAVStatusPollingJobData> {
  return new Worker<NAVStatusPollingJobData>(
    QueueName.NAV_STATUS_POLLING,
    processNAVStatusPolling,
    {
      connection: queueConnection,
      concurrency: workerConcurrency[QueueName.NAV_STATUS_POLLING],
      limiter: {
        max: 20, // Max 20 status queries per minute
        duration: 60000,
      },
    }
  );
}
