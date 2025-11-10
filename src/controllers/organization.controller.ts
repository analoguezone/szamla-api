import { Request, Response, NextFunction } from 'express';
import { organizationService } from '@services/organization.service';
import { navService } from '@services/nav.service';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  updateNAVCredentialsSchema,
  listOrganizationsQuerySchema,
  addCreditsSchema,
  deductCreditsSchema,
  updateStripeCustomerSchema,
  updateStatusSchema,
  updateBillingStatusSchema,
} from '@validators/organization.validator';
import { successResponse, errorResponse } from '@utils/response';
import { ValidationError } from '@utils/errors';
import { z } from 'zod';

/**
 * Organization Controller
 *
 * Handles HTTP requests for organization management
 */

export class OrganizationController {
  /**
   * Create a new organization
   * POST /api/v1/organizations
   */
  async createOrganization(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request body
      const validatedData = createOrganizationSchema.parse(req.body);

      // Create organization
      const organization = await organizationService.createOrganization(validatedData);

      // Return success response (don't include encrypted credentials)
      successResponse(res, { organization }, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        errorResponse(
        
          res,
          'VALIDATION_ERROR',
          'Invalid request data',
          400,
          error.errors
        );
      }
      next(error);
    }
  }

  /**
   * Get organization by ID
   * GET /api/v1/organizations/:id
   */
  async getOrganization(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) {
        errorResponse(res, 'VALIDATION_ERROR', 'Organization ID is required', 400);
      return;
      }

      const organization = await organizationService.getOrganizationById(id);

      successResponse(res, { organization });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get organization with decrypted NAV credentials
   * GET /api/v1/organizations/:id/nav-credentials
   * Note: This should be protected and only accessible by the organization owner
   */
  async getOrganizationWithNAVCredentials(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) {
        errorResponse(res, 'VALIDATION_ERROR', 'Organization ID is required', 400);
      return;
      }

      const organization = await organizationService.getOrganizationWithNAVCredentials(id);

      successResponse(res, { organization });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update organization
   * PATCH /api/v1/organizations/:id
   */
  async updateOrganization(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) {
        errorResponse(res, 'VALIDATION_ERROR', 'Organization ID is required', 400);
      return;
      }

      // Validate request body
      const validatedData = updateOrganizationSchema.parse(req.body);

      // Update organization
      const organization = await organizationService.updateOrganization(id, validatedData);

      successResponse(res, { organization });
    } catch (error) {
      if (error instanceof z.ZodError) {
        errorResponse(
        
          res,
          'VALIDATION_ERROR',
          'Invalid request data',
          400,
          error.errors
        );
      }
      next(error);
    }
  }

  /**
   * Update NAV credentials
   * PUT /api/v1/organizations/:id/nav-credentials
   */
  async updateNAVCredentials(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) {
        errorResponse(res, 'VALIDATION_ERROR', 'Organization ID is required', 400);
      return;
      }

      // Validate request body
      const validatedData = updateNAVCredentialsSchema.parse(req.body);

      // Update NAV credentials
      const organization = await organizationService.updateNAVCredentials(id, validatedData);

      successResponse(res, {
        organization,
        message: 'NAV credentials updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        errorResponse(
        
          res,
          'VALIDATION_ERROR',
          'Invalid request data',
          400,
          error.errors
        );
      }
      next(error);
    }
  }

  /**
   * Test NAV connection
   * POST /api/v1/organizations/:id/nav-credentials/test
   */
  async testNAVConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) {
        errorResponse(res, 'VALIDATION_ERROR', 'Organization ID is required', 400);
      return;
      }

      // Get organization with NAV credentials
      const organization = await organizationService.getOrganizationWithNAVCredentials(id);

      // Check if NAV credentials are set
      if (!organization.navPassword || !organization.navSignatureKey || !organization.navExchangeKey) {
        throw new ValidationError('NAV credentials not configured');
      }

      // Test NAV connection using NAV service
      const testResult = await navService.testConnection(id);

      // Mark connection as tested
      await organizationService.markNAVConnectionTested(id, testResult.success);

      successResponse(res, {
        success: testResult.success,
        message: testResult.message,
        technicalUser: testResult.technicalUser,
        timestamp: testResult.timestamp,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add credits to organization
   * POST /api/v1/organizations/:id/credits/add
   */
  async addCredits(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) {
        errorResponse(res, 'VALIDATION_ERROR', 'Organization ID is required', 400);
      return;
      }

      // Validate request body
      const { credits } = addCreditsSchema.parse(req.body);

      // Add credits
      const organization = await organizationService.addCredits(id, credits);

      successResponse(res, {
        organization,
        message: `Added ${credits} credits. New balance: ${organization.balanceCredits}`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        errorResponse(
        
          res,
          'VALIDATION_ERROR',
          'Invalid request data',
          400,
          error.errors
        );
      }
      next(error);
    }
  }

  /**
   * Deduct credits from organization
   * POST /api/v1/organizations/:id/credits/deduct
   */
  async deductCredits(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) {
        errorResponse(res, 'VALIDATION_ERROR', 'Organization ID is required', 400);
      return;
      }

      // Validate request body
      const { credits } = deductCreditsSchema.parse(req.body);

      // Deduct credits
      const organization = await organizationService.deductCredits(id, credits);

      successResponse(res, {
        organization,
        message: `Deducted ${credits} credits. New balance: ${organization.balanceCredits}`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        errorResponse(
        
          res,
          'VALIDATION_ERROR',
          'Invalid request data',
          400,
          error.errors
        );
      }
      next(error);
    }
  }

  /**
   * Get credit balance
   * GET /api/v1/organizations/:id/credits
   */
  async getCreditBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) {
        errorResponse(res, 'VALIDATION_ERROR', 'Organization ID is required', 400);
      return;
      }

      const balance = await organizationService.getCreditBalance(id);

      successResponse(res, { balance });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update Stripe customer
   * PUT /api/v1/organizations/:id/stripe-customer
   */
  async updateStripeCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) {
        errorResponse(res, 'VALIDATION_ERROR', 'Organization ID is required', 400);
      return;
      }

      // Validate request body
      const { stripeCustomerId, paymentMethodId, last4, brand } =
        updateStripeCustomerSchema.parse(req.body);

      // Update Stripe customer
      const organization = await organizationService.updateStripeCustomer(
        id,
        stripeCustomerId,
        paymentMethodId,
        last4,
        brand
      );

      successResponse(res, {
        organization,
        message: 'Stripe customer information updated',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        errorResponse(
        
          res,
          'VALIDATION_ERROR',
          'Invalid request data',
          400,
          error.errors
        );
      }
      next(error);
    }
  }

  /**
   * Update organization status
   * PATCH /api/v1/organizations/:id/status
   */
  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) {
        errorResponse(res, 'VALIDATION_ERROR', 'Organization ID is required', 400);
      return;
      }

      // Validate request body
      const { status } = updateStatusSchema.parse(req.body);

      // Update status
      const organization = await organizationService.updateStatus(id, status);

      successResponse(res, {
        organization,
        message: `Organization status updated to ${status}`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        errorResponse(
        
          res,
          'VALIDATION_ERROR',
          'Invalid request data',
          400,
          error.errors
        );
      }
      next(error);
    }
  }

  /**
   * Update billing status
   * PATCH /api/v1/organizations/:id/billing-status
   */
  async updateBillingStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) {
        errorResponse(res, 'VALIDATION_ERROR', 'Organization ID is required', 400);
      return;
      }

      // Validate request body
      const { billingStatus } = updateBillingStatusSchema.parse(req.body);

      // Update billing status
      const organization = await organizationService.updateBillingStatus(id, billingStatus);

      successResponse(res, {
        organization,
        message: `Billing status updated to ${billingStatus}`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        errorResponse(
        
          res,
          'VALIDATION_ERROR',
          'Invalid request data',
          400,
          error.errors
        );
      }
      next(error);
    }
  }

  /**
   * Delete organization (soft delete)
   * DELETE /api/v1/organizations/:id
   */
  async deleteOrganization(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) {
        errorResponse(res, 'VALIDATION_ERROR', 'Organization ID is required', 400);
      return;
      }

      await organizationService.deleteOrganization(id);

      successResponse(res, {
        message: 'Organization deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List organizations
   * GET /api/v1/organizations
   */
  async listOrganizations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate query parameters
      const { skip, take, status, search } = listOrganizationsQuerySchema.parse(req.query);

      // List organizations
      const { organizations, total } = await organizationService.listOrganizations({
        skip,
        take,
        status,
        search,
      });

      successResponse(res, {
        organizations,
        pagination: {
          total,
          skip,
          take,
          hasMore: skip + take < total,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        errorResponse(
        
          res,
          'VALIDATION_ERROR',
          'Invalid query parameters',
          400,
          error.errors
        );
      }
      next(error);
    }
  }
}

// Export singleton instance
export const organizationController = new OrganizationController();
