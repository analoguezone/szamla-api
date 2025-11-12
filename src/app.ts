import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { config } from './config';
import { loggerMiddleware } from './middleware/logger.middleware';
import { usageTrackingMiddleware } from './middleware/usage.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { router } from './routes';

export function createApp(): Express {
  const app = express();

  // Security middleware
  app.use(helmet());

  // CORS
  app.use(
    cors({
      origin: config.cors.origins,
      credentials: config.cors.credentials,
    })
  );

  // Compression
  app.use(compression());

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging
  app.use(loggerMiddleware);

  // Usage tracking
  app.use(usageTrackingMiddleware);

  // API routes
  app.use('/api/v1', router);

  // 404 handler
  app.use(notFoundHandler);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
