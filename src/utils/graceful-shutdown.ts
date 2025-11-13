import { Server } from 'http';
import { logger } from '@config/logger';
import { db } from '@config/database';
import { redis } from '@config/redis';
import { workerManager } from '../jobs';

/**
 * Graceful Shutdown Handler
 *
 * Handles graceful shutdown of the application on SIGTERM/SIGINT
 * Ensures all connections are closed properly before exiting
 */

let isShuttingDown = false;

/**
 * Setup graceful shutdown handlers
 *
 * @param server - HTTP server instance
 */
export function setupGracefulShutdown(server: Server): void {
  // Handle shutdown signals
  process.on('SIGTERM', () => gracefulShutdown(server, 'SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown(server, 'SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error({ error: error.message, stack: error.stack }, 'Uncaught exception');
    gracefulShutdown(server, 'uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, 'Unhandled promise rejection');
    gracefulShutdown(server, 'unhandledRejection');
  });
}

/**
 * Gracefully shut down the application
 *
 * @param server - HTTP server instance
 * @param signal - Signal that triggered shutdown
 */
async function gracefulShutdown(server: Server, signal: string): Promise<void> {
  // Prevent multiple shutdown attempts
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress, ignoring signal');
    return;
  }

  isShuttingDown = true;
  logger.info({ signal }, 'Received shutdown signal, starting graceful shutdown');

  // Set shutdown timeout (30 seconds)
  const shutdownTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timeout, forcing exit');
    process.exit(1);
  }, 30000);

  try {
    // Step 1: Stop accepting new requests
    logger.info('Closing HTTP server');
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          logger.error({ error: err.message }, 'Error closing HTTP server');
          reject(err);
        } else {
          logger.info('HTTP server closed');
          resolve();
        }
      });
    });

    // Step 2: Close background job workers
    logger.info('Closing background workers');
    try {
      await workerManager.close();
      logger.info('Background workers closed');
    } catch (error) {
      logger.error({ error }, 'Error closing background workers');
    }

    // Step 3: Close database connections
    logger.info('Closing database connections');
    try {
      await db.$disconnect();
      logger.info('Database connections closed');
    } catch (error) {
      logger.error({ error }, 'Error closing database connections');
    }

    // Step 4: Close Redis connections
    logger.info('Closing Redis connections');
    try {
      await redis.quit();
      logger.info('Redis connections closed');
    } catch (error) {
      logger.error({ error }, 'Error closing Redis connections');
    }

    // Clear shutdown timeout
    clearTimeout(shutdownTimeout);

    logger.info('Graceful shutdown completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during graceful shutdown');
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

/**
 * Check if application is shutting down
 */
export function isAppShuttingDown(): boolean {
  return isShuttingDown;
}
