import { Worker } from 'bullmq';
import { createPDFGenerationWorker } from './pdf-generation.job';
import { createNAVSubmissionWorker } from './nav-submission.job';
import { createNAVStatusPollingWorker } from './nav-status-polling.job';
import { logger } from '@config/logger';
import { pdfService } from '@services/pdf.service';
import { storageService } from '@services/storage.service';

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
      // Initialize services
      await storageService.initialize();
      await pdfService.initialize();

      // Create workers
      const pdfWorker = createPDFGenerationWorker();
      const navSubmissionWorker = createNAVSubmissionWorker();
      const navStatusPollingWorker = createNAVStatusPollingWorker();

      this.workers = [pdfWorker, navSubmissionWorker, navStatusPollingWorker];

      // Setup event handlers for all workers
      this.workers.forEach((worker) => {
        worker.on('completed', (job) => {
          logger.info(`Job completed: ${job.name}`, {
            jobId: job.id,
            queue: worker.name,
          });
        });

        worker.on('failed', (job, error) => {
          logger.error(`Job failed: ${job?.name}`, {
            jobId: job?.id,
            queue: worker.name,
            error: error.message,
            stack: error.stack,
          });
        });

        worker.on('error', (error) => {
          logger.error(`Worker error in queue: ${worker.name}`, {
            queue: worker.name,
            error: error.message,
            stack: error.stack,
          });
        });
      });

      this.isInitialized = true;
      logger.info('Background workers initialized successfully', {
        workerCount: this.workers.length,
        queues: this.workers.map((w) => w.name),
      });
    } catch (error: any) {
      logger.error('Failed to initialize workers', {
        error: error.message,
        stack: error.stack,
      });
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

      // Close services
      await pdfService.close();

      this.workers = [];
      this.isInitialized = false;

      logger.info('Background workers closed successfully');
    } catch (error: any) {
      logger.error('Error closing workers', {
        error: error.message,
        stack: error.stack,
      });
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
