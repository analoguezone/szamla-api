import { Router } from 'express';
import { organizationController } from '@controllers/organization.controller';
import {
  authenticate,
  requireOrganizationOwnership,
  requireAdmin,
} from '@middleware/auth.middleware';
import { signupRateLimiter } from '@middleware/rate-limit.middleware';

/**
 * Organization Routes
 *
 * Defines API endpoints for organization management
 *
 * Base path: /api/v1/organizations
 */

const router = Router();

/**
 * @swagger
 * /organizations:
 *   get:
 *     summary: List all organizations
 *     description: Returns a paginated list of organizations (admin only)
 *     tags: [Organizations]
 *     parameters:
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of records to skip for pagination
 *       - in: query
 *         name: take
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of records to return
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, suspended, deleted]
 *         description: Filter by organization status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by organization name or tax number
 *     responses:
 *       200:
 *         description: Organizations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 organizations:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Organization'
 *                 total:
 *                   type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get(
  '/',
  authenticate,
  requireAdmin,
  organizationController.listOrganizations.bind(organizationController)
);

/**
 * @swagger
 * /organizations:
 *   post:
 *     summary: Create a new organization
 *     description: Register a new organization (public endpoint for signup)
 *     tags: [Organizations]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - taxNumber
 *               - address
 *               - city
 *               - postalCode
 *               - email
 *             properties:
 *               name:
 *                 type: string
 *                 example: Példa Kft.
 *               taxNumber:
 *                 type: string
 *                 pattern: ^\d{8}$
 *                 example: "12345678"
 *               address:
 *                 type: string
 *                 example: Fő utca 1.
 *               city:
 *                 type: string
 *                 example: Budapest
 *               postalCode:
 *                 type: string
 *                 example: "1011"
 *               country:
 *                 type: string
 *                 default: HU
 *               email:
 *                 type: string
 *                 format: email
 *                 example: info@example.hu
 *               phone:
 *                 type: string
 *                 example: "+36 1 234 5678"
 *               bankAccountNumber:
 *                 type: string
 *     responses:
 *       201:
 *         description: Organization created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 organization:
 *                   $ref: '#/components/schemas/Organization'
 *                 apiKey:
 *                   $ref: '#/components/schemas/ApiKey'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 */
router.post(
  '/',
  signupRateLimiter,
  organizationController.createOrganization.bind(organizationController)
);

/**
 * @swagger
 * /organizations/{id}:
 *   get:
 *     summary: Get organization by ID
 *     description: Returns organization details for the specified ID
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Organization UUID
 *     responses:
 *       200:
 *         description: Organization retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Organization'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get(
  '/:id',
  authenticate,
  requireOrganizationOwnership,
  organizationController.getOrganization.bind(organizationController)
);

/**
 * @route   PATCH /api/v1/organizations/:id
 * @desc    Update organization details
 * @access  Protected (organization owner or admin)
 * @param   id - Organization UUID
 * @body    UpdateOrganizationInput
 */
router.patch(
  '/:id',
  authenticate,
  requireOrganizationOwnership,
  organizationController.updateOrganization.bind(organizationController)
);

/**
 * @route   DELETE /api/v1/organizations/:id
 * @desc    Delete organization (soft delete)
 * @access  Protected (organization owner or admin)
 * @param   id - Organization UUID
 */
router.delete(
  '/:id',
  authenticate,
  requireOrganizationOwnership,
  organizationController.deleteOrganization.bind(organizationController)
);

/**
 * @route   GET /api/v1/organizations/:id/nav-credentials
 * @desc    Get organization with decrypted NAV credentials
 * @access  Protected (organization owner only) - Highly sensitive!
 * @param   id - Organization UUID
 */
router.get(
  '/:id/nav-credentials',
  authenticate,
  requireOrganizationOwnership,
  organizationController.getOrganizationWithNAVCredentials.bind(organizationController)
);

/**
 * @route   PUT /api/v1/organizations/:id/nav-credentials
 * @desc    Update NAV credentials
 * @access  Protected (organization owner only)
 * @param   id - Organization UUID
 * @body    UpdateNAVCredentialsInput
 */
router.put(
  '/:id/nav-credentials',
  authenticate,
  requireOrganizationOwnership,
  organizationController.updateNAVCredentials.bind(organizationController)
);

/**
 * @route   POST /api/v1/organizations/:id/nav-credentials/test
 * @desc    Test NAV connection
 * @access  Protected (organization owner only)
 * @param   id - Organization UUID
 */
router.post(
  '/:id/nav-credentials/test',
  authenticate,
  requireOrganizationOwnership,
  organizationController.testNAVConnection.bind(organizationController)
);

/**
 * @route   GET /api/v1/organizations/:id/credits
 * @desc    Get credit balance
 * @access  Protected (organization owner)
 * @param   id - Organization UUID
 */
router.get(
  '/:id/credits',
  authenticate,
  requireOrganizationOwnership,
  organizationController.getCreditBalance.bind(organizationController)
);

/**
 * @route   POST /api/v1/organizations/:id/credits/add
 * @desc    Add credits to organization (admin only or after payment)
 * @access  Protected (admin or payment webhook)
 * @param   id - Organization UUID
 * @body    { credits: number }
 */
router.post(
  '/:id/credits/add',
  authenticate,
  requireAdmin,
  organizationController.addCredits.bind(organizationController)
);

/**
 * @route   POST /api/v1/organizations/:id/credits/deduct
 * @desc    Deduct credits from organization (internal use)
 * @access  Protected (internal/system only)
 * @param   id - Organization UUID
 * @body    { credits: number }
 */
router.post(
  '/:id/credits/deduct',
  authenticate,
  requireAdmin,
  organizationController.deductCredits.bind(organizationController)
);

/**
 * @route   PUT /api/v1/organizations/:id/stripe-customer
 * @desc    Update Stripe customer information
 * @access  Protected (internal/webhook)
 * @param   id - Organization UUID
 * @body    UpdateStripeCustomerInput
 */
router.put(
  '/:id/stripe-customer',
  authenticate,
  requireAdmin,
  organizationController.updateStripeCustomer.bind(organizationController)
);

/**
 * @route   PATCH /api/v1/organizations/:id/status
 * @desc    Update organization status
 * @access  Protected (admin only)
 * @param   id - Organization UUID
 * @body    { status: 'active' | 'suspended' | 'deleted' }
 */
router.patch(
  '/:id/status',
  authenticate,
  requireAdmin,
  organizationController.updateStatus.bind(organizationController)
);

/**
 * @route   PATCH /api/v1/organizations/:id/billing-status
 * @desc    Update billing status
 * @access  Protected (admin or internal)
 * @param   id - Organization UUID
 * @body    { billingStatus: 'active' | 'suspended' | 'delinquent' }
 */
router.patch(
  '/:id/billing-status',
  authenticate,
  requireAdmin,
  organizationController.updateBillingStatus.bind(organizationController)
);

export default router;
