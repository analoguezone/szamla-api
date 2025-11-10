import { Request, Response, NextFunction } from 'express';
import { partnerService } from '@services/partner.service';
import {
  createPartnerSchema,
  updatePartnerSchema,
  listPartnersQuerySchema,
} from '@validators/partner.validator';
import { successResponse, errorResponse } from '@utils/response';
import { ForbiddenError } from '@utils/errors';
import { z } from 'zod';

/**
 * Partner Controller
 *
 * Handles HTTP requests for partner (customers/suppliers) management
 * All endpoints require authentication
 */

export class PartnerController {
  /**
   * Create a new partner
   * POST /api/v1/partners
   */
  async createPartner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      // Validate request body
      const validatedData = createPartnerSchema.parse(req.body);

      // Create partner for authenticated organization
      const partner = await partnerService.createPartner({
        organizationId: req.organizationId,
        ...validatedData,
      });

      successResponse(res, { partner }, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        errorResponse(res, 'VALIDATION_ERROR', 'Invalid request data', 400, error.errors);
        return;
      }
      next(error);
    }
  }

  /**
   * List partners for authenticated organization
   * GET /api/v1/partners
   */
  async listPartners(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      // Validate query parameters
      const { skip, take, search, isIndividual, isForeign, country } =
        listPartnersQuerySchema.parse(req.query);

      // List partners
      const { partners, total } = await partnerService.listPartners({
        organizationId: req.organizationId,
        skip,
        take,
        search,
        isIndividual,
        isForeign,
        country,
      });

      successResponse(res, {
        partners,
        pagination: {
          total,
          skip,
          take,
          hasMore: skip + take < total,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400, error.errors);
        return;
      }
      next(error);
    }
  }

  /**
   * Get partner by ID
   * GET /api/v1/partners/:id
   */
  async getPartner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) {
        errorResponse(res, 'VALIDATION_ERROR', 'Partner ID is required', 400);
        return;
      }

      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      // Get partner (with organization isolation)
      const partner = await partnerService.getPartnerById(id, req.organizationId);

      successResponse(res, { partner });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update partner
   * PATCH /api/v1/partners/:id
   */
  async updatePartner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) {
        errorResponse(res, 'VALIDATION_ERROR', 'Partner ID is required', 400);
        return;
      }

      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      // Validate request body
      const validatedData = updatePartnerSchema.parse(req.body);

      // Update partner
      const partner = await partnerService.updatePartner(id, req.organizationId, validatedData);

      successResponse(res, {
        partner,
        message: 'Partner updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        errorResponse(res, 'VALIDATION_ERROR', 'Invalid request data', 400, error.errors);
        return;
      }
      next(error);
    }
  }

  /**
   * Delete partner (soft delete)
   * DELETE /api/v1/partners/:id
   */
  async deletePartner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) {
        errorResponse(res, 'VALIDATION_ERROR', 'Partner ID is required', 400);
        return;
      }

      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      // Delete partner
      await partnerService.deletePartner(id, req.organizationId);

      successResponse(res, {
        message: 'Partner deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search partners
   * GET /api/v1/partners/search
   */
  async searchPartners(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 10;

      if (!query) {
        errorResponse(res, 'VALIDATION_ERROR', 'Search query is required', 400);
        return;
      }

      // Search partners
      const partners = await partnerService.searchPartners(req.organizationId, query, limit);

      successResponse(res, { partners });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get partner statistics
   * GET /api/v1/partners/stats
   */
  async getPartnerStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      // Get stats
      const stats = await partnerService.getPartnerStats(req.organizationId);

      successResponse(res, { stats });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get partner count
   * GET /api/v1/partners/count
   */
  async getPartnerCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      // Count partners
      const count = await partnerService.countPartners(req.organizationId);

      successResponse(res, { count });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const partnerController = new PartnerController();
