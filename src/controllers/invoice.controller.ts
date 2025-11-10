import { Request, Response, NextFunction } from 'express';
import { invoiceService } from '@services/invoice.service';
import {
  createInvoiceSchema,
  listInvoicesQuerySchema,
  createStornoInvoiceSchema,
} from '@validators/invoice.validator';
import { successResponse, errorResponse } from '@utils/response';
import { ForbiddenError } from '@utils/errors';
import { z } from 'zod';

/**
 * Invoice Controller
 *
 * Handles HTTP requests for invoice management
 * All endpoints require authentication
 * Includes multi-currency and EU VAT support
 */

export class InvoiceController {
  /**
   * Create a new invoice
   * POST /api/v1/invoices
   */
  async createInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      // Validate request body
      const validatedData = createInvoiceSchema.parse(req.body);

      // Create invoice for authenticated organization
      const invoice = await invoiceService.createInvoice({
        organizationId: req.organizationId,
        ...validatedData,
      });

      successResponse(res, { invoice }, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        errorResponse(res, 'VALIDATION_ERROR', 'Invalid request data', 400, error.errors);
        return;
      }
      next(error);
    }
  }

  /**
   * Create storno (cancellation) invoice
   * POST /api/v1/invoices/:id/storno
   */
  async createStornoInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) {
        errorResponse(res, 'VALIDATION_ERROR', 'Invoice ID is required', 400);
        return;
      }

      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      // Validate request body
      const validatedData = createStornoInvoiceSchema.parse(req.body);

      // Create storno invoice
      const stornoInvoice = await invoiceService.createStornoInvoice(
        req.organizationId,
        id,
        validatedData
      );

      successResponse(res, { invoice: stornoInvoice }, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        errorResponse(res, 'VALIDATION_ERROR', 'Invalid request data', 400, error.errors);
        return;
      }
      next(error);
    }
  }

  /**
   * List invoices for authenticated organization
   * GET /api/v1/invoices
   */
  async listInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      // Validate query parameters
      const {
        skip,
        take,
        partnerId,
        status,
        paymentStatus,
        navStatus,
        issueDateFrom,
        issueDateTo,
        dueDateFrom,
        dueDateTo,
        invoiceNumber,
        search,
        invoiceType,
        currency,
        isStorned,
      } = listInvoicesQuerySchema.parse(req.query);

      // List invoices
      const { invoices, total } = await invoiceService.listInvoices({
        organizationId: req.organizationId,
        skip,
        take,
        partnerId,
        status,
        paymentStatus,
        navStatus,
        issueDateFrom,
        issueDateTo,
        dueDateFrom,
        dueDateTo,
        invoiceNumber,
        search,
        invoiceType,
        currency,
        isStorned,
      });

      successResponse(res, {
        invoices,
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
   * Get invoice by ID
   * GET /api/v1/invoices/:id
   */
  async getInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) {
        errorResponse(res, 'VALIDATION_ERROR', 'Invoice ID is required', 400);
        return;
      }

      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      // Get invoice (with organization isolation)
      const invoice = await invoiceService.getInvoiceById(id, req.organizationId);

      successResponse(res, { invoice });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Finalize invoice (make immutable and ready for NAV)
   * POST /api/v1/invoices/:id/finalize
   */
  async finalizeInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) {
        errorResponse(res, 'VALIDATION_ERROR', 'Invoice ID is required', 400);
        return;
      }

      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      // Finalize invoice
      const invoice = await invoiceService.finalizeInvoice(id, req.organizationId);

      successResponse(res, {
        invoice,
        message: 'Invoice finalized successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update payment status
   * PATCH /api/v1/invoices/:id/payment
   */
  async updatePaymentStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) {
        errorResponse(res, 'VALIDATION_ERROR', 'Invoice ID is required', 400);
        return;
      }

      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      const { paymentStatus, paymentDate } = req.body;

      if (!paymentStatus) {
        errorResponse(res, 'VALIDATION_ERROR', 'Payment status is required', 400);
        return;
      }

      // Validate payment status
      const validStatuses = ['unpaid', 'partially_paid', 'paid', 'overdue'];
      if (!validStatuses.includes(paymentStatus)) {
        errorResponse(
          res,
          'VALIDATION_ERROR',
          `Payment status must be one of: ${validStatuses.join(', ')}`,
          400
        );
        return;
      }

      // Update payment status
      const invoice = await invoiceService.updatePaymentStatus(
        id,
        req.organizationId,
        paymentStatus,
        paymentDate ? new Date(paymentDate) : undefined
      );

      successResponse(res, {
        invoice,
        message: 'Payment status updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete invoice (soft delete - only drafts)
   * DELETE /api/v1/invoices/:id
   */
  async deleteInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) {
        errorResponse(res, 'VALIDATION_ERROR', 'Invoice ID is required', 400);
        return;
      }

      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      // Delete invoice
      await invoiceService.deleteInvoice(id, req.organizationId);

      successResponse(res, {
        message: 'Invoice deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get invoice statistics
   * GET /api/v1/invoices/stats
   */
  async getInvoiceStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.organizationId) {
        throw new ForbiddenError('Authentication required');
      }

      // Get stats
      const stats = await invoiceService.getInvoiceStats(req.organizationId);

      successResponse(res, { stats });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const invoiceController = new InvoiceController();
