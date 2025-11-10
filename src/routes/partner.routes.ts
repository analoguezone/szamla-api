import { Router } from 'express';
import { partnerController } from '@controllers/partner.controller';
import { authenticate, requirePartnersRead, requirePartnersWrite } from '@middleware/auth.middleware';

/**
 * Partner Routes
 *
 * Defines API endpoints for partner (customers/suppliers) management
 *
 * Base path: /api/v1/partners
 * All endpoints require authentication
 */

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @route   GET /api/v1/partners/stats
 * @desc    Get partner statistics for authenticated organization
 * @access  Protected (partners:read scope)
 */
router.get('/stats', requirePartnersRead, partnerController.getPartnerStats.bind(partnerController));

/**
 * @route   GET /api/v1/partners/count
 * @desc    Get partner count for authenticated organization
 * @access  Protected (partners:read scope)
 */
router.get('/count', requirePartnersRead, partnerController.getPartnerCount.bind(partnerController));

/**
 * @route   GET /api/v1/partners/search
 * @desc    Search partners by name or tax number
 * @access  Protected (partners:read scope)
 * @query   q (search query), limit (default: 10)
 */
router.get('/search', requirePartnersRead, partnerController.searchPartners.bind(partnerController));

/**
 * @route   GET /api/v1/partners
 * @desc    List all partners for authenticated organization
 * @access  Protected (partners:read scope)
 * @query   skip, take, search, isIndividual, isForeign, country
 */
router.get('/', requirePartnersRead, partnerController.listPartners.bind(partnerController));

/**
 * @route   POST /api/v1/partners
 * @desc    Create a new partner
 * @access  Protected (partners:write scope)
 * @body    CreatePartnerInput
 */
router.post('/', requirePartnersWrite, partnerController.createPartner.bind(partnerController));

/**
 * @route   GET /api/v1/partners/:id
 * @desc    Get partner by ID
 * @access  Protected (partners:read scope)
 * @param   id - Partner UUID
 */
router.get('/:id', requirePartnersRead, partnerController.getPartner.bind(partnerController));

/**
 * @route   PATCH /api/v1/partners/:id
 * @desc    Update partner details
 * @access  Protected (partners:write scope)
 * @param   id - Partner UUID
 * @body    UpdatePartnerInput
 */
router.patch('/:id', requirePartnersWrite, partnerController.updatePartner.bind(partnerController));

/**
 * @route   DELETE /api/v1/partners/:id
 * @desc    Delete partner (soft delete)
 * @access  Protected (partners:write scope)
 * @param   id - Partner UUID
 */
router.delete('/:id', requirePartnersWrite, partnerController.deletePartner.bind(partnerController));

export default router;
