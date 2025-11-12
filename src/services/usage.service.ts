import { db } from '@config/database';
import { UsageLog } from '@prisma/client';

/**
 * Usage Service
 *
 * Tracks and analyzes API usage for billing and analytics
 */

export interface CreateUsageLogInput {
  organizationId: string;
  apiKeyId?: string;
  endpoint: string;
  httpMethod: string;
  httpStatus: number;
  requestTimestamp: Date;
  responseTimeMs?: number;
  requestSizeBytes?: number;
  responseSizeBytes?: number;
  clientIp?: string;
  userAgent?: string;
  resourceType?: string;
  resourceId?: string;
  operationCost?: number;
  errorCode?: string;
  errorMessage?: string;
  requestId?: string;
}

export interface UsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  totalDataTransferred: number;
  uniqueEndpoints: number;
  requestsByStatus: Record<string, number>;
  requestsByEndpoint: Record<string, number>;
  costByOperation: number;
}

export interface UsagePeriodSummary {
  period: string;
  totalRequests: number;
  successRate: number;
  averageResponseTime: number;
  totalCost: number;
  topEndpoints: Array<{ endpoint: string; count: number }>;
}

export class UsageService {
  /**
   * Log API usage
   */
  async logUsage(input: CreateUsageLogInput): Promise<UsageLog> {
    return db.usageLog.create({
      data: {
        organizationId: input.organizationId,
        apiKeyId: input.apiKeyId,
        endpoint: input.endpoint,
        httpMethod: input.httpMethod,
        httpStatus: input.httpStatus,
        requestTimestamp: input.requestTimestamp,
        responseTimeMs: input.responseTimeMs,
        requestSizeBytes: input.requestSizeBytes,
        responseSizeBytes: input.responseSizeBytes,
        clientIp: input.clientIp,
        userAgent: input.userAgent,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        operationCost: input.operationCost,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        requestId: input.requestId,
      },
    });
  }

  /**
   * Get current period usage (current month)
   */
  async getCurrentPeriodUsage(organizationId: string): Promise<UsageStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return this.getUsageStats(organizationId, startOfMonth, now);
  }

  /**
   * Get usage stats for a date range
   */
  async getUsageStats(
    organizationId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<UsageStats> {
    const logs = await db.usageLog.findMany({
      where: {
        organizationId,
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      select: {
        httpStatus: true,
        endpoint: true,
        responseTimeMs: true,
        requestSizeBytes: true,
        responseSizeBytes: true,
        operationCost: true,
      },
    });

    const totalRequests = logs.length;
    const successfulRequests = logs.filter((l) => l.httpStatus >= 200 && l.httpStatus < 300).length;
    const failedRequests = totalRequests - successfulRequests;

    // Calculate average response time
    const responseTimes = logs.filter((l) => l.responseTimeMs !== null).map((l) => l.responseTimeMs!);
    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        : 0;

    // Calculate total data transferred
    const totalDataTransferred = logs.reduce(
      (sum, log) => sum + (log.requestSizeBytes || 0) + (log.responseSizeBytes || 0),
      0
    );

    // Unique endpoints
    const uniqueEndpoints = new Set(logs.map((l) => l.endpoint)).size;

    // Requests by status
    const requestsByStatus: Record<string, number> = {};
    logs.forEach((log) => {
      const statusCategory = Math.floor(log.httpStatus / 100) * 100;
      const key = `${statusCategory}xx`;
      requestsByStatus[key] = (requestsByStatus[key] || 0) + 1;
    });

    // Requests by endpoint
    const requestsByEndpoint: Record<string, number> = {};
    logs.forEach((log) => {
      requestsByEndpoint[log.endpoint] = (requestsByEndpoint[log.endpoint] || 0) + 1;
    });

    // Cost by operation
    const costByOperation = logs.reduce(
      (sum, log) => sum + (log.operationCost ? Number(log.operationCost) : 0),
      0
    );

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      totalDataTransferred,
      uniqueEndpoints,
      requestsByStatus,
      requestsByEndpoint,
      costByOperation,
    };
  }

  /**
   * Get usage history (daily/monthly aggregated)
   */
  async getUsageHistory(
    organizationId: string,
    fromDate: Date,
    toDate: Date,
    groupBy: 'day' | 'month' = 'day'
  ): Promise<UsagePeriodSummary[]> {
    const logs = await db.usageLog.findMany({
      where: {
        organizationId,
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      select: {
        createdAt: true,
        httpStatus: true,
        responseTimeMs: true,
        operationCost: true,
        endpoint: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group by period
    const grouped = new Map<string, typeof logs>();

    logs.forEach((log) => {
      const date = new Date(log.createdAt);
      const key =
        groupBy === 'day'
          ? date.toISOString().split('T')[0]! // YYYY-MM-DD
          : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(log);
    });

    // Calculate stats for each period
    const summaries: UsagePeriodSummary[] = [];

    for (const [period, periodLogs] of grouped.entries()) {
      const totalRequests = periodLogs.length;
      const successfulRequests = periodLogs.filter(
        (l) => l.httpStatus >= 200 && l.httpStatus < 300
      ).length;
      const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;

      const responseTimes = periodLogs
        .filter((l) => l.responseTimeMs !== null)
        .map((l) => l.responseTimeMs!);
      const averageResponseTime =
        responseTimes.length > 0
          ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
          : 0;

      const totalCost = periodLogs.reduce(
        (sum, log) => sum + (log.operationCost ? Number(log.operationCost) : 0),
        0
      );

      // Top endpoints
      const endpointCounts: Record<string, number> = {};
      periodLogs.forEach((log) => {
        endpointCounts[log.endpoint] = (endpointCounts[log.endpoint] || 0) + 1;
      });

      const topEndpoints = Object.entries(endpointCounts)
        .map(([endpoint, count]) => ({ endpoint, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      summaries.push({
        period,
        totalRequests,
        successRate,
        averageResponseTime,
        totalCost,
        topEndpoints,
      });
    }

    return summaries;
  }

  /**
   * Get usage by endpoint
   */
  async getUsageByEndpoint(
    organizationId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<Array<{ endpoint: string; count: number; averageResponseTime: number }>> {
    const logs = await db.usageLog.findMany({
      where: {
        organizationId,
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      select: {
        endpoint: true,
        responseTimeMs: true,
      },
    });

    const grouped = new Map<string, number[]>();

    logs.forEach((log) => {
      if (!grouped.has(log.endpoint)) {
        grouped.set(log.endpoint, []);
      }
      if (log.responseTimeMs !== null) {
        grouped.get(log.endpoint)!.push(log.responseTimeMs);
      }
    });

    return Array.from(grouped.entries()).map(([endpoint, times]) => ({
      endpoint,
      count: times.length,
      averageResponseTime: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
    }));
  }

  /**
   * Get recent usage logs
   */
  async getRecentLogs(
    organizationId: string,
    limit: number = 100
  ): Promise<UsageLog[]> {
    return db.usageLog.findMany({
      where: {
        organizationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Delete old usage logs (cleanup)
   */
  async cleanupOldLogs(olderThanDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await db.usageLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }
}

// Export singleton instance
export const usageService = new UsageService();
