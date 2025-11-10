import { Router } from 'express';
import { apiKeyController } from '@controllers/api-key.controller';
import { authenticate } from '@middleware/auth.middleware';
import { standardRateLimiter } from '@middleware/rate-limit.middleware';

/**
 * API Key Routes
 *
 * Defines API endpoints for API key management
 *
 * Base path: /api/v1/api-keys
 * All endpoints require authentication
 */

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @route   GET /api/v1/api-keys/stats
 * @desc    Get API key statistics for authenticated organization
 * @access  Protected (organization owner)
 */
router.get('/stats', apiKeyController.getApiKeyStats.bind(apiKeyController));

/**
 * @route   GET /api/v1/api-keys
 * @desc    List all API keys for authenticated organization
 * @access  Protected (organization owner)
 * @query   includeRevoked (boolean)
 */
router.get('/', apiKeyController.listApiKeys.bind(apiKeyController));

/**
 * @route   POST /api/v1/api-keys
 * @desc    Create a new API key
 * @access  Protected (organization owner)
 * @body    CreateApiKeyInput
 * @ratelimit 60 requests per minute per IP
 */
router.post('/', standardRateLimiter, apiKeyController.createApiKey.bind(apiKeyController));

/**
 * @route   GET /api/v1/api-keys/:id
 * @desc    Get API key by ID
 * @access  Protected (organization owner)
 * @param   id - API key UUID
 */
router.get('/:id', apiKeyController.getApiKey.bind(apiKeyController));

/**
 * @route   PATCH /api/v1/api-keys/:id
 * @desc    Update API key details
 * @access  Protected (organization owner)
 * @param   id - API key UUID
 * @body    UpdateApiKeyInput
 */
router.patch('/:id', apiKeyController.updateApiKey.bind(apiKeyController));

/**
 * @route   DELETE /api/v1/api-keys/:id
 * @desc    Revoke API key
 * @access  Protected (organization owner)
 * @param   id - API key UUID
 */
router.delete('/:id', apiKeyController.revokeApiKey.bind(apiKeyController));

export default router;
