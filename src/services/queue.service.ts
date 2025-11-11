import { Queue, QueueOptions } from 'bullmq';
import { queueConnection, QueueName, defaultJobOptions } from '@config/queue.config';

/**
 * Queue Service
 *
 * Manages BullMQ queues for background job processing
 */

class QueueService {
  private queues: Map<string, Queue> = new Map();

  /**
   * Get or create a queue
   */
  getQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      const queueOptions: QueueOptions = {
        connection: queueConnection,
        defaultJobOptions,
      };

      const queue = new Queue(name, queueOptions);
      this.queues.set(name, queue);
    }

    return this.queues.get(name)!;
  }

  /**
   * Get NAV submission queue
   */
  get navSubmissionQueue(): Queue {
    return this.getQueue(QueueName.NAV_SUBMISSION);
  }

  /**
   * Get NAV status polling queue
   */
  get navStatusPollingQueue(): Queue {
    return this.getQueue(QueueName.NAV_STATUS_POLLING);
  }

  /**
   * Get PDF generation queue
   */
  get pdfGenerationQueue(): Queue {
    return this.getQueue(QueueName.PDF_GENERATION);
  }

  /**
   * Get usage aggregation queue
   */
  get usageAggregationQueue(): Queue {
    return this.getQueue(QueueName.USAGE_AGGREGATION);
  }

  /**
   * Close all queues
   */
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.queues.values()).map(queue => queue.close());
    await Promise.all(closePromises);
    this.queues.clear();
  }

  /**
   * Get queue health status
   */
  async getQueueHealth(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const queue = this.getQueue(queueName);

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
  }

  /**
   * Clean old jobs from queue
   */
  async cleanQueue(
    queueName: string,
    grace: number = 86400000, // 24 hours in ms
    limit: number = 1000
  ): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.clean(grace, limit, 'completed');
    await queue.clean(grace * 7, limit, 'failed'); // Keep failed jobs longer
  }
}

// Export singleton instance
export const queueService = new QueueService();
