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
 * @swagger
 * /usage/current:
 *   get:
 *     summary: Get current period usage
 *     description: Returns usage statistics for the current month
 *     tags: [Usage]
 *     responses:
 *       200:
 *         description: Current usage retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UsageStats'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/current', usageController.getCurrentUsage.bind(usageController));

/**
 * @swagger
 * /usage/stats:
 *   get:
 *     summary: Get usage statistics for date range
 *     description: Returns aggregated usage statistics for a specified date range
 *     tags: [Usage]
 *     parameters:
 *       - in: query
 *         name: fromDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date (ISO 8601)
 *       - in: query
 *         name: toDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date (ISO 8601)
 *     responses:
 *       200:
 *         description: Usage statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UsageStats'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
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
