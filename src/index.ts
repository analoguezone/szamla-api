import { createApp } from './app';
import { config } from './config';
import { logger } from './config/logger';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { validateEnvironment, maskSensitiveEnvVars } from './utils/env-validator';
import { setupGracefulShutdown } from './utils/graceful-shutdown';
import { workerManager } from './jobs';

async function bootstrap() {
  try {
    // Validate environment variables
    logger.info('Validating environment configuration');
    validateEnvironment();
    logger.info('Environment validation passed');

    // Log masked environment variables (for debugging)
    if (process.env.NODE_ENV === 'development') {
      logger.debug({ env: maskSensitiveEnvVars() }, 'Environment configuration');
    }

    // Connect to database
    await connectDatabase();

    // Connect to Redis
    await connectRedis();

    // Initialize background workers
    logger.info('Initializing background job workers');
    await workerManager.initialize();
    logger.info('Background workers initialized');

    // Create Express app
    const app = createApp();

    // Start HTTP server
    const server = app.listen(config.port, () => {
      logger.info(
        {
          port: config.port,
          env: config.env,
          apiBaseUrl: config.apiBaseUrl,
          node: process.version,
        },
        'Server started successfully'
      );
    });

    // Setup graceful shutdown handlers
    setupGracefulShutdown(server);
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Start the application
bootstrap();
