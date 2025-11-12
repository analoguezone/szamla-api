import { Request, Response, NextFunction } from 'express';
import { usageService } from '@services/usage.service';
import { successResponse, errorResponse } from '@utils/response';
import { ForbiddenError } from '@utils/errors';
import { z } from 'zod';

/**
 * Usage Controller
 *
 * Handles HTTP requests for usage tracking and analytics
 */

const usageHistoryQuerySchema = z.object({
  fromDate: z.string().datetime().transform((val) => new Date(val)),
  toDate: z.string().datetime().transform((val) => new Date(val)),
  groupBy: z.enum(['day', 'month']).optional().default('day'),
});

const usageStatsQuerySchema = z.object({
  fromDate: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
  toDate: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
});

export class UsageController {
  /**
   * Get current period usage (current month)
   * GET /api/v1/usage/current
   */
  async getCurrentUsage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      const usage = await usageService.getCurrentPeriodUsage(req.organizationId);

      successResponse(res, { usage });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get usage statistics for date range
   * GET /api/v1/usage/stats
   */
  async getUsageStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      const query = usageStatsQuerySchema.parse(req.query);

      // Default to current month if no dates provided
      const now = new Date();
      const fromDate = query.fromDate || new Date(now.getFullYear(), now.getMonth(), 1);
      const toDate = query.toDate || now;

      const stats = await usageService.getUsageStats(req.organizationId, fromDate, toDate);

      successResponse(res, { stats, period: { from: fromDate, to: toDate } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400, error.errors);
        return;
      }
      next(error);
    }
  }

  /**
   * Get usage history (daily/monthly aggregated)
   * GET /api/v1/usage/history
   */
  async getUsageHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      const query = usageHistoryQuerySchema.parse(req.query);

      const history = await usageService.getUsageHistory(
        req.organizationId,
        query.fromDate,
        query.toDate,
        query.groupBy
      );

      successResponse(res, {
        history,
        period: {
          from: query.fromDate,
          to: query.toDate,
          groupBy: query.groupBy,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400, error.errors);
        return;
      }
      next(error);
    }
  }

  /**
   * Get usage by endpoint
   * GET /api/v1/usage/by-endpoint
   */
  async getUsageByEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      const query = usageStatsQuerySchema.parse(req.query);

      const now = new Date();
      const fromDate = query.fromDate || new Date(now.getFullYear(), now.getMonth(), 1);
      const toDate = query.toDate || now;

      const usage = await usageService.getUsageByEndpoint(req.organizationId, fromDate, toDate);

      successResponse(res, { usage, period: { from: fromDate, to: toDate } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400, error.errors);
        return;
      }
      next(error);
    }
  }

  /**
   * Get recent usage logs
   * GET /api/v1/usage/logs
   */
  async getRecentLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
      const logs = await usageService.getRecentLogs(req.organizationId, limit);

      successResponse(res, { logs, count: logs.length });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const usageController = new UsageController();
