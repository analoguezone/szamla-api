import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { swaggerSpec } from './config/swagger.config';
import { loggerMiddleware } from './middleware/logger.middleware';
import { usageTrackingMiddleware } from './middleware/usage.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { router } from './routes';

export function createApp(): Express {
  const app = express();

  // Security middleware (configure for Swagger UI)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'script-src': ["'self'", "'unsafe-inline'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'https:'],
        },
      },
    })
  );

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

  // API Documentation (Swagger UI)
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Számlázó NAV API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
    },
  }));

  // API routes
  app.use('/api/v1', router);

  // 404 handler
  app.use(notFoundHandler);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
