import { Router, Request, Response } from 'express';
import { successResponse } from '../utils/response';
import { db } from '../config/database';
import { redis } from '../config/redis';

const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns basic health status of the API
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *                 environment:
 *                   type: string
 *                   example: production
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 */
router.get('/health', async (_req: Request, res: Response) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: '1.0.0',
  };

  return successResponse(res, health);
});

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness check endpoint
 *     description: Returns readiness status including database and Redis connectivity
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Service is ready
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 database:
 *                   type: string
 *                   example: connected
 *                 redis:
 *                   type: string
 *                   example: connected
 *                 ready:
 *                   type: boolean
 *                   example: true
 *       503:
 *         description: Service is not ready
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/health/ready', async (_req: Request, res: Response) => {
  try {
    // Check database connection
    await db.$queryRaw`SELECT 1`;
    const dbStatus = 'connected';

    // Check Redis connection
    await redis.ping();
    const redisStatus = 'connected';

    return successResponse(res, {
      database: dbStatus,
      redis: redisStatus,
      ready: true,
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service is not ready',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

export { router as healthRoutes };
