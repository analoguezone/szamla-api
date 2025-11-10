import { Router } from 'express';
import { organizationController } from '@controllers/organization.controller';
import {
  authenticate,
  requireOrganizationOwnership,
  requireAdmin,
} from '@middleware/auth.middleware';

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
 * @desc    List organizations (admin only - for now)
 * @access  Protected (admin)
 * @query   skip, take, status, search
 */
router.get(
  '/',
  authenticate,
  requireAdmin,
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
 * @access  Protected (organization owner)
 * @param   id - Organization UUID
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
