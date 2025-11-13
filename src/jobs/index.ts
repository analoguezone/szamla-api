import { Worker } from 'bullmq';
import { createNAVSubmissionWorker } from './nav-submission.job';
import { createNAVStatusPollingWorker } from './nav-status-polling.job';
import { logger } from '@config/logger';

/**
 * Job Workers
 *
 * Manages all background job workers
 */

class WorkerManager {
  private workers: Worker[] = [];
  private isInitialized = false;

  /**
   * Initialize all workers
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Workers already initialized');
      return;
    }

    logger.info('Initializing background workers...');

    try {
      // Create workers
      const navSubmissionWorker = createNAVSubmissionWorker();
      const navStatusPollingWorker = createNAVStatusPollingWorker();

      this.workers = [navSubmissionWorker, navStatusPollingWorker];

      // Setup event handlers for all workers
      this.workers.forEach((worker) => {
        worker.on('completed', (job) => {
          logger.info({
            jobId: job.id,
            queue: worker.name,
          }, `Job completed: ${job.name}`);
        });

        worker.on('failed', (job, error) => {
          logger.error({
            jobId: job?.id,
            queue: worker.name,
            error: error.message,
            stack: error.stack,
          }, `Job failed: ${job?.name}`);
        });

        worker.on('error', (error) => {
          logger.error({
            queue: worker.name,
            error: error.message,
            stack: error.stack,
          }, `Worker error in queue: ${worker.name}`);
        });
      });

      this.isInitialized = true;
      logger.info({
        workerCount: this.workers.length,
        queues: this.workers.map((w) => w.name),
      }, 'Background workers initialized successfully');
    } catch (error: any) {
      logger.error({
        error: error.message,
        stack: error.stack,
      }, 'Failed to initialize workers');
      throw error;
    }
  }

  /**
   * Gracefully close all workers
   */
  async close(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    logger.info('Closing background workers...');

    try {
      // Close all workers
      await Promise.all(this.workers.map((worker) => worker.close()));

      this.workers = [];
      this.isInitialized = false;

      logger.info('Background workers closed successfully');
    } catch (error: any) {
      logger.error({
        error: error.message,
        stack: error.stack,
      }, 'Error closing workers');
      throw error;
    }
  }

  /**
   * Pause all workers
   */
  async pauseAll(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.pause()));
    logger.info('All workers paused');
  }

  /**
   * Resume all workers
   */
  async resumeAll(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.resume()));
    logger.info('All workers resumed');
  }

  /**
   * Get worker health status
   */
  getHealthStatus(): {
    initialized: boolean;
    workerCount: number;
    queues: string[];
  } {
    return {
      initialized: this.isInitialized,
      workerCount: this.workers.length,
      queues: this.workers.map((w) => w.name),
    };
  }
}

// Export singleton instance
export const workerManager = new WorkerManager();
