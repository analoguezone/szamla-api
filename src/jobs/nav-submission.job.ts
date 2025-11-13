import { Worker, Job } from 'bullmq';
import { queueConnection, QueueName, workerConcurrency } from '@config/queue.config';
import { navService } from '@services/nav.service';
import { db } from '@config/database';
import { logger } from '@config/logger';

/**
 * NAV Submission Job
 *
 * Submits invoices to Hungarian NAV in the background
 */

export interface NAVSubmissionJobData {
  invoiceId: string;
  organizationId: string;
  operation: 'CREATE' | 'STORNO' | 'ANNUL';
}

/**
 * Process NAV submission job
 */
async function processNAVSubmission(job: Job<NAVSubmissionJobData>): Promise<void> {
  const { invoiceId, organizationId, operation } = job.data;

  logger.info({
    jobId: job.id,
    invoiceId,
    organizationId,
    operation,
  }, `Submitting invoice to NAV: ${invoiceId}`);

  try {
    // Submit invoice to NAV
    const result = await navService.submitInvoice(invoiceId, operation);

    logger.info({
      jobId: job.id,
      invoiceId,
      transactionId: result.transactionId,
      status: result.status,
    }, `Invoice submitted to NAV successfully: ${invoiceId}`);

    // Schedule status polling job with delay
    const { queueService } = await import('@services/queue.service');
    await queueService.navStatusPollingQueue.add(
      'poll-nav-status',
      {
        invoiceId,
        organizationId,
        transactionId: result.transactionId,
        attempt: 1,
      },
      {
        delay: 5000, // Wait 5 seconds before first poll
      }
    );
  } catch (error: any) {
    logger.error({
      jobId: job.id,
      invoiceId,
      error: error.message,
      stack: error.stack,
    }, `Failed to submit invoice to NAV: ${invoiceId}`);

    // Update invoice NAV status to failed
    await db.invoice.update({
      where: { id: invoiceId },
      data: {
        navStatus: 'failed',
        navError: error.message,
      },
    });

    throw error; // Re-throw to mark job as failed
  }
}

/**
 * Create and export the NAV submission worker
 */
export function createNAVSubmissionWorker(): Worker<NAVSubmissionJobData> {
  return new Worker<NAVSubmissionJobData>(
    QueueName.NAV_SUBMISSION,
    processNAVSubmission,
    {
      connection: queueConnection,
      concurrency: workerConcurrency[QueueName.NAV_SUBMISSION],
      limiter: {
        max: 5, // Max 5 NAV submissions per minute (respect NAV rate limits)
        duration: 60000,
      },
    }
  );
}
