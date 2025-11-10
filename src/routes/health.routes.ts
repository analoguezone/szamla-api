import { Router, Request, Response } from 'express';
import { successResponse } from '../utils/response';
import { db } from '../config/database';
import { redis } from '../config/redis';

const router = Router();

router.get('/health', async (req: Request, res: Response) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: '1.0.0',
  };

  return successResponse(res, health);
});

router.get('/health/ready', async (req: Request, res: Response) => {
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
