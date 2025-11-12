import { Router } from 'express';
import { usageController } from '@controllers/usage.controller';
import { authenticate } from '@middleware/auth.middleware';

/**
 * Usage Routes
 *
 * Defines API endpoints for usage tracking and analytics
 *
 * Base path: /api/v1/usage
 * All endpoints require authentication
 */

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @route   GET /api/v1/usage/current
 * @desc    Get current period usage (current month)
 * @access  Protected (organization owner)
 */
router.get('/current', usageController.getCurrentUsage.bind(usageController));

/**
 * @route   GET /api/v1/usage/stats
 * @desc    Get usage statistics for date range
 * @access  Protected (organization owner)
 * @query   fromDate, toDate (ISO 8601 datetime strings)
 */
router.get('/stats', usageController.getUsageStats.bind(usageController));

/**
 * @route   GET /api/v1/usage/history
 * @desc    Get usage history (daily/monthly aggregated)
 * @access  Protected (organization owner)
 * @query   fromDate, toDate (required), groupBy (day|month)
 */
router.get('/history', usageController.getUsageHistory.bind(usageController));

/**
 * @route   GET /api/v1/usage/by-endpoint
 * @desc    Get usage breakdown by endpoint
 * @access  Protected (organization owner)
 * @query   fromDate, toDate (ISO 8601 datetime strings)
 */
router.get('/by-endpoint', usageController.getUsageByEndpoint.bind(usageController));

/**
 * @route   GET /api/v1/usage/logs
 * @desc    Get recent usage logs
 * @access  Protected (organization owner)
 * @query   limit (default: 100)
 */
router.get('/logs', usageController.getRecentLogs.bind(usageController));

export default router;
