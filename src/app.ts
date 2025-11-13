import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config';
import { swaggerSpec } from './config/swagger.config';
import { loggerMiddleware } from './middleware/logger.middleware';
import { usageTrackingMiddleware } from './middleware/usage.middleware';
import { sanitizeMiddleware } from './middleware/sanitize.middleware';
import { responseHeadersMiddleware } from './middleware/response-headers.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { router } from './routes';

export function createApp(): Express {
  const app = express();

  // Enhanced security headers
  app.use(
    helmet({
      // Content Security Policy (relaxed for Swagger UI)
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          fontSrc: ["'self'", 'https:', 'data:'],
          formAction: ["'self'"],
          frameAncestors: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // Required for Swagger UI
          scriptSrcAttr: ["'none'"],
          styleSrc: ["'self'", 'https:', "'unsafe-inline'"], // Required for Swagger UI
          upgradeInsecureRequests: [],
        },
      },
      // Strict Transport Security (HSTS)
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      // Prevent clickjacking
      frameguard: {
        action: 'deny',
      },
      // Prevent MIME type sniffing
      noSniff: true,
      // Disable X-Powered-By header
      hidePoweredBy: true,
      // Referrer policy
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
      },
      // Permissions policy
      permittedCrossDomainPolicies: {
        permittedPolicies: 'none',
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

  // Request ID tracking (must be early in the chain)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.requestId = req.headers['x-request-id'] as string || uuidv4();
    next();
  });

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request sanitization (after body parsing, before business logic)
  app.use(sanitizeMiddleware);

  // Response headers (security and tracking)
  app.use(responseHeadersMiddleware);

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
