import { Request, Response, NextFunction } from 'express';
import { navService } from '@services/nav.service';
import { successResponse, errorResponse } from '@utils/response';
import { ForbiddenError } from '@utils/errors';

/**
 * NAV Controller
 *
 * Handles HTTP requests for NAV (Hungarian Tax Authority) integration
 * All endpoints require authentication
 */

export class NAVController {
  /**
   * Test connection to NAV
   * POST /api/v1/nav/test-connection
   */
  async testConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      // Test connection
      const result = await navService.testConnection(req.organizationId);

      if (result.success) {
        successResponse(res, {
          message: result.message,
          technicalUser: result.technicalUser,
          timestamp: result.timestamp,
        });
      } else {
        errorResponse(res, 'NAV_CONNECTION_FAILED', result.message, 400);
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Submit invoice to NAV
   * POST /api/v1/nav/invoices/:id/submit
   */
  async submitInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoiceId = req.params.id;
      if (!invoiceId) {
        errorResponse(res, 'VALIDATION_ERROR', 'Invoice ID is required', 400);
        return;
      }

      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      // Submit invoice
      const result = await navService.submitInvoice(invoiceId, req.organizationId);

      successResponse(res, {
        message: 'Invoice submitted to NAV successfully',
        transactionId: result.transactionId,
        status: result.status,
        technicalValidationMessages: result.technicalValidationMessages,
        businessValidationMessages: result.businessValidationMessages,
      }, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Query invoice status from NAV
   * GET /api/v1/nav/invoices/:id/status
   */
  async queryInvoiceStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoiceId = req.params.id;
      if (!invoiceId) {
        errorResponse(res, 'VALIDATION_ERROR', 'Invoice ID is required', 400);
        return;
      }

      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      // Query status
      const result = await navService.queryInvoiceStatus(invoiceId, req.organizationId);

      successResponse(res, {
        status: result.status,
        validationMessages: result.validationMessages,
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const navController = new NAVController();
