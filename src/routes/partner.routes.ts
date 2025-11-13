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
 * @swagger
 * /partners:
 *   get:
 *     summary: List all partners
 *     description: Returns a paginated list of partners (customers/suppliers) for the authenticated organization
 *     tags: [Partners]
 *     parameters:
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: take
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or tax number
 *     responses:
 *       200:
 *         description: Partners retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 partners:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Partner'
 *                 total:
 *                   type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *   post:
 *     summary: Create a new partner
 *     description: Create a new partner (customer or supplier)
 *     tags: [Partners]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [customer, supplier, both]
 *               taxNumber:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               postalCode:
 *                 type: string
 *               country:
 *                 type: string
 *                 default: HU
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Partner created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Partner'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', requirePartnersRead, partnerController.listPartners.bind(partnerController));
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
