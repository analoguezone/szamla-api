import { Router } from 'express';
import { organizationController } from '@controllers/organization.controller';

/**
 * Organization Routes
 *
 * Defines API endpoints for organization management
 *
 * Base path: /api/v1/organizations
 */

const router = Router();

/**
 * @route   GET /api/v1/organizations
 * @desc    List organizations with pagination and filtering
 * @access  Protected (requires authentication) - TODO: Add auth middleware
 * @query   skip, take, status, search
 */
router.get(
  '/',
  // TODO: Add authentication middleware
  organizationController.listOrganizations.bind(organizationController)
);

/**
 * @route   POST /api/v1/organizations
 * @desc    Create a new organization
 * @access  Public (for initial signup) or Admin
 * @body    CreateOrganizationInput
 */
router.post(
  '/',
  // TODO: Add rate limiting for signup
  organizationController.createOrganization.bind(organizationController)
);

/**
 * @route   GET /api/v1/organizations/:id
 * @desc    Get organization by ID
 * @access  Protected (organization owner or admin)
 * @param   id - Organization UUID
 */
router.get(
  '/:id',
  // TODO: Add authentication and authorization middleware
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
  // TODO: Add authentication and authorization middleware
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
  // TODO: Add authentication and authorization middleware
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
  // TODO: Add strict authentication and authorization
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
  // TODO: Add authentication and authorization middleware
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
  // TODO: Add authentication and authorization middleware
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
  // TODO: Add authentication and authorization middleware
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
  // TODO: Add authentication and authorization middleware (admin only)
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
  // TODO: Add authentication middleware (system/internal only)
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
  // TODO: Add authentication middleware (internal/webhook only)
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
  // TODO: Add authentication middleware (admin only)
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
  // TODO: Add authentication middleware (admin/internal only)
  organizationController.updateBillingStatus.bind(organizationController)
);

export default router;
