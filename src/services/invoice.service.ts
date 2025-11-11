import { db } from '@config/database';
import { organizationService } from './organization.service';
import { partnerService } from './partner.service';
import { NotFoundError, ValidationError, InsufficientCreditsError } from '@utils/errors';
import { Invoice, InvoiceItem, Prisma } from '@prisma/client';
import Decimal from 'decimal.js';

type DecimalType = InstanceType<typeof Decimal>;

/**
 * Invoice Service
 *
 * Handles invoice creation and management with:
 * - Automatic invoice numbering (PREFIX-YEAR-00001)
 * - VAT calculations (including EU reverse charge)
 * - Credit deduction
 * - Storno (cancellation) invoices
 * - Multi-currency support
 */

export interface InvoiceItemInput {
  name: string;
  description?: string;
  sku?: string;
  quantity: number;
  unit?: string;
  netUnitPrice: number;
  vatRate: number;
  vatCode?: string;
  comment?: string;
}

export interface CreateInvoiceInput {
  organizationId: string;
  partnerId: string;
  issueDate: Date;
  fulfillmentDate: Date;
  dueDate: Date;
  currency?: string;
  exchangeRate?: number;
  items: InvoiceItemInput[];
  paymentMethod?: string;
  language?: string;
  comment?: string;
  internalNote?: string;
  invoiceType?: string;
}

export interface InvoiceWithItems extends Invoice {
  items: InvoiceItem[];
}

export class InvoiceService {
  /**
   * Generate next invoice number for organization
   * Format: PREFIX-YEAR-00001
   */
  private async generateInvoiceNumber(organizationId: string, issueDate: Date): Promise<string> {
    // Get organization for prefix
    const organization = await organizationService.getOrganizationById(organizationId);
    const prefix = (organization.invoicePrefix as string | null) || 'INV';
    const year = issueDate.getFullYear();

    // Get the highest invoice number for this year
    const lastInvoice = await db.invoice.findFirst({
      where: {
        organizationId,
        invoiceNumber: {
          startsWith: `${prefix}-${year}-`,
        },
      },
      orderBy: {
        invoiceNumber: 'desc',
      },
      select: {
        invoiceNumber: true,
      },
    });

    let nextNumber = 1;
    if (lastInvoice) {
      // Extract number from format PREFIX-YEAR-00001
      const parts = lastInvoice.invoiceNumber.split('-');
      const currentNumber = parseInt(parts[parts.length - 1]!, 10);
      nextNumber = currentNumber + 1;
    }

    // Format with leading zeros (5 digits)
    const formattedNumber = nextNumber.toString().padStart(5, '0');
    return `${prefix}-${year}-${formattedNumber}`;
  }

  /**
   * Calculate invoice item amounts
   */
  private calculateItemAmounts(item: InvoiceItemInput): {
    netAmount: DecimalType;
    vatAmount: DecimalType;
    grossAmount: DecimalType;
  } {
    const quantity = new Decimal(item.quantity);
    const netUnitPrice = new Decimal(item.netUnitPrice);
    const vatRate = new Decimal(item.vatRate).div(100); // Convert percentage to decimal

    const netAmount = quantity.mul(netUnitPrice);
    const vatAmount = netAmount.mul(vatRate);
    const grossAmount = netAmount.add(vatAmount);

    return {
      netAmount,
      vatAmount,
      grossAmount,
    };
  }

  /**
   * Calculate invoice totals from items
   */
  private calculateTotals(items: InvoiceItemInput[]): {
    netAmount: DecimalType;
    vatAmount: DecimalType;
    grossAmount: DecimalType;
    vatSummary: Record<string, { net: string; vat: string; gross: string }>;
  } {
    let totalNet = new Decimal(0);
    let totalVat = new Decimal(0);
    let totalGross = new Decimal(0);
    const vatSummary: Record<string, { net: DecimalType; vat: DecimalType; gross: DecimalType }> = {};

    for (const item of items) {
      const amounts = this.calculateItemAmounts(item);
      totalNet = totalNet.add(amounts.netAmount);
      totalVat = totalVat.add(amounts.vatAmount);
      totalGross = totalGross.add(amounts.grossAmount);

      // Group by VAT rate or code for summary
      const key = item.vatCode || `${item.vatRate}%`;
      if (!vatSummary[key]) {
        vatSummary[key] = { net: new Decimal(0), vat: new Decimal(0), gross: new Decimal(0) };
      }
      vatSummary[key].net = vatSummary[key].net.add(amounts.netAmount);
      vatSummary[key].vat = vatSummary[key].vat.add(amounts.vatAmount);
      vatSummary[key].gross = vatSummary[key].gross.add(amounts.grossAmount);
    }

    // Convert Decimal to string for JSON storage
    const vatSummaryJson: Record<string, { net: string; vat: string; gross: string }> = {};
    for (const [key, value] of Object.entries(vatSummary)) {
      vatSummaryJson[key] = {
        net: value.net.toFixed(2),
        vat: value.vat.toFixed(2),
        gross: value.gross.toFixed(2),
      };
    }

    return {
      netAmount: totalNet,
      vatAmount: totalVat,
      grossAmount: totalGross,
      vatSummary: vatSummaryJson,
    };
  }

  /**
   * Create a new invoice
   */
  async createInvoice(input: CreateInvoiceInput): Promise<InvoiceWithItems> {
    // Check if organization has enough credits
    const hasCredits = await organizationService.hasEnoughCredits(input.organizationId, 1);
    if (!hasCredits) {
      const balance = await organizationService.getCreditBalance(input.organizationId);
      throw new InsufficientCreditsError(balance, 1);
    }

    // Verify partner belongs to organization
    await partnerService.getPartnerById(input.partnerId, input.organizationId);

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(input.organizationId, input.issueDate);

    // Calculate totals
    const totals = this.calculateTotals(input.items);

    // Create invoice and items in transaction
    const invoice = await db.$transaction(async (tx) => {
      // Create invoice
      const newInvoice = await tx.invoice.create({
        data: {
          organizationId: input.organizationId,
          partnerId: input.partnerId,
          invoiceNumber,
          invoiceType: input.invoiceType || 'normal',
          issueDate: input.issueDate,
          fulfillmentDate: input.fulfillmentDate,
          dueDate: input.dueDate,
          currency: input.currency || 'HUF',
          exchangeRate: input.exchangeRate || 1.0,
          netAmount: totals.netAmount.toNumber(),
          vatAmount: totals.vatAmount.toNumber(),
          grossAmount: totals.grossAmount.toNumber(),
          paymentMethod: input.paymentMethod || 'transfer',
          paymentStatus: 'unpaid',
          language: input.language || 'hu',
          comment: input.comment,
          internalNote: input.internalNote,
          vatSummary: totals.vatSummary as any,
          status: 'draft',
          navStatus: 'pending',
        },
        include: {
          items: true,
        },
      });

      // Create invoice items
      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i]!;
        const amounts = this.calculateItemAmounts(item);

        await tx.invoiceItem.create({
          data: {
            invoiceId: newInvoice.id,
            lineNumber: i + 1,
            name: item.name,
            description: item.description,
            sku: item.sku,
            quantity: item.quantity,
            unit: item.unit || 'db',
            netUnitPrice: item.netUnitPrice,
            vatRate: item.vatRate,
            vatCode: item.vatCode,
            netAmount: amounts.netAmount.toNumber(),
            vatAmount: amounts.vatAmount.toNumber(),
            grossAmount: amounts.grossAmount.toNumber(),
            comment: item.comment,
          },
        });
      }

      // Get balance before deduction
      const balanceBefore = (await tx.organization.findUnique({
        where: { id: input.organizationId },
        select: { balanceCredits: true },
      }))!.balanceCredits;

      // Deduct credit from organization
      await tx.organization.update({
        where: { id: input.organizationId },
        data: {
          balanceCredits: {
            decrement: 1,
          },
        },
      });

      // Create transaction record for credit deduction
      await tx.transaction.create({
        data: {
          organizationId: input.organizationId,
          type: 'invoice_charge',
          creditsAmount: -1,
          balanceBeforeCredits: balanceBefore,
          balanceAfterCredits: balanceBefore - 1,
          invoiceId: newInvoice.id,
        },
      });

      // Fetch complete invoice with items
      return tx.invoice.findUnique({
        where: { id: newInvoice.id },
        include: { items: true },
      });
    });

    if (!invoice) {
      throw new Error('Failed to create invoice');
    }

    // Queue PDF generation in background
    const { queueService } = await import('./queue.service');
    await queueService.pdfGenerationQueue.add('generate-pdf', {
      invoiceId: invoice.id,
      organizationId: input.organizationId,
    });

    return invoice as InvoiceWithItems;
  }

  /**
   * Create storno (cancellation) invoice
   */
  async createStornoInvoice(
    organizationId: string,
    originalInvoiceId: string,
    input: { issueDate: Date; comment?: string; internalNote?: string }
  ): Promise<InvoiceWithItems> {
    // Get original invoice with items
    const originalInvoice = await this.getInvoiceById(originalInvoiceId, organizationId);

    if (originalInvoice.isStorned) {
      throw new ValidationError('This invoice has already been cancelled');
    }

    if (originalInvoice.invoiceType === 'storno') {
      throw new ValidationError('Cannot create storno of a storno invoice');
    }

    // Check if organization has enough credits
    const hasCredits = await organizationService.hasEnoughCredits(organizationId, 1);
    if (!hasCredits) {
      const balance = await organizationService.getCreditBalance(organizationId);
      throw new InsufficientCreditsError(balance, 1);
    }

    // Generate storno invoice number
    const invoiceNumber = await this.generateInvoiceNumber(organizationId, input.issueDate);

    // Create negative items (same as original but with negative quantities)
    const stornoItems: InvoiceItemInput[] = originalInvoice.items.map((item) => ({
      name: item.name,
      description: item.description || undefined,
      sku: item.sku || undefined,
      quantity: -Number(item.quantity),
      unit: item.unit,
      netUnitPrice: Number(item.netUnitPrice),
      vatRate: Number(item.vatRate),
      vatCode: item.vatCode || undefined,
      comment: item.comment || undefined,
    }));

    // Calculate totals (will be negative)
    const totals = this.calculateTotals(stornoItems);

    // Create storno invoice in transaction
    const invoice = await db.$transaction(async (tx) => {
      // Create storno invoice
      const stornoInvoice = await tx.invoice.create({
        data: {
          organizationId,
          partnerId: originalInvoice.partnerId,
          invoiceNumber,
          invoiceType: 'storno',
          originalInvoiceId,
          issueDate: input.issueDate,
          fulfillmentDate: originalInvoice.fulfillmentDate,
          dueDate: input.issueDate, // Storno invoices typically due immediately
          currency: originalInvoice.currency,
          exchangeRate: Number(originalInvoice.exchangeRate),
          netAmount: totals.netAmount.toNumber(),
          vatAmount: totals.vatAmount.toNumber(),
          grossAmount: totals.grossAmount.toNumber(),
          paymentMethod: originalInvoice.paymentMethod,
          paymentStatus: 'unpaid',
          language: originalInvoice.language,
          comment: input.comment,
          internalNote: input.internalNote,
          vatSummary: totals.vatSummary as any,
          status: 'draft',
          navStatus: 'pending',
        },
      });

      // Create storno items
      for (let i = 0; i < stornoItems.length; i++) {
        const item = stornoItems[i]!;
        const amounts = this.calculateItemAmounts(item);

        await tx.invoiceItem.create({
          data: {
            invoiceId: stornoInvoice.id,
            lineNumber: i + 1,
            name: item.name,
            description: item.description,
            sku: item.sku,
            quantity: item.quantity,
            unit: item.unit || 'db',
            netUnitPrice: item.netUnitPrice,
            vatRate: item.vatRate,
            vatCode: item.vatCode,
            netAmount: amounts.netAmount.toNumber(),
            vatAmount: amounts.vatAmount.toNumber(),
            grossAmount: amounts.grossAmount.toNumber(),
            comment: item.comment,
          },
        });
      }

      // Mark original invoice as storned
      await tx.invoice.update({
        where: { id: originalInvoiceId },
        data: { isStorned: true },
      });

      // Get balance before deduction
      const balanceBefore = (await tx.organization.findUnique({
        where: { id: organizationId },
        select: { balanceCredits: true },
      }))!.balanceCredits;

      // Deduct credit
      await tx.organization.update({
        where: { id: organizationId },
        data: {
          balanceCredits: {
            decrement: 1,
          },
        },
      });

      // Create transaction record
      await tx.transaction.create({
        data: {
          organizationId,
          type: 'invoice_charge',
          creditsAmount: -1,
          balanceBeforeCredits: balanceBefore,
          balanceAfterCredits: balanceBefore - 1,
          invoiceId: stornoInvoice.id,
        },
      });

      // Fetch complete invoice with items
      return tx.invoice.findUnique({
        where: { id: stornoInvoice.id },
        include: { items: true },
      });
    });

    if (!invoice) {
      throw new Error('Failed to create storno invoice');
    }

    // Queue PDF generation in background
    const { queueService } = await import('./queue.service');
    await queueService.pdfGenerationQueue.add('generate-pdf', {
      invoiceId: invoice.id,
      organizationId,
    });

    return invoice as InvoiceWithItems;
  }

  /**
   * Get invoice by ID (with organization isolation)
   */
  async getInvoiceById(id: string, organizationId: string): Promise<InvoiceWithItems> {
    const invoice = await db.invoice.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
      include: {
        items: {
          orderBy: { lineNumber: 'asc' },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice', id);
    }

    return invoice;
  }

  /**
   * List invoices (with pagination and filtering)
   */
  async listInvoices(params: {
    organizationId: string;
    skip?: number;
    take?: number;
    partnerId?: string;
    status?: string;
    paymentStatus?: string;
    navStatus?: string;
    issueDateFrom?: Date;
    issueDateTo?: Date;
    dueDateFrom?: Date;
    dueDateTo?: Date;
    invoiceNumber?: string;
    search?: string;
    invoiceType?: string;
    currency?: string;
    isStorned?: boolean;
  }): Promise<{ invoices: Invoice[]; total: number }> {
    const {
      organizationId,
      skip = 0,
      take = 20,
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
    } = params;

    const where: Prisma.InvoiceWhereInput = {
      organizationId,
      deletedAt: null,
      ...(partnerId && { partnerId }),
      ...(status && { status }),
      ...(paymentStatus && { paymentStatus }),
      ...(navStatus && { navStatus }),
      ...(invoiceNumber && { invoiceNumber: { contains: invoiceNumber, mode: 'insensitive' } }),
      ...(invoiceType && { invoiceType }),
      ...(currency && { currency }),
      ...(isStorned !== undefined && { isStorned }),
      ...((issueDateFrom || issueDateTo) && {
        issueDate: {
          ...(issueDateFrom && { gte: issueDateFrom }),
          ...(issueDateTo && { lte: issueDateTo }),
        },
      }),
      ...((dueDateFrom || dueDateTo) && {
        dueDate: {
          ...(dueDateFrom && { gte: dueDateFrom }),
          ...(dueDateTo && { lte: dueDateTo }),
        },
      }),
      ...(search && {
        OR: [
          { invoiceNumber: { contains: search, mode: 'insensitive' } },
          { comment: { contains: search, mode: 'insensitive' } },
          { internalNote: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [invoices, total] = await Promise.all([
      db.invoice.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      db.invoice.count({ where }),
    ]);

    return { invoices, total };
  }

  /**
   * Finalize invoice (make it immutable and ready for NAV submission)
   */
  async finalizeInvoice(id: string, organizationId: string): Promise<Invoice> {
    const invoice = await this.getInvoiceById(id, organizationId);

    if (invoice.status !== 'draft') {
      throw new ValidationError('Only draft invoices can be finalized');
    }

    return db.invoice.update({
      where: { id },
      data: {
        status: 'finalized',
        finalizedAt: new Date(),
      },
    });
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    id: string,
    organizationId: string,
    paymentStatus: string,
    paymentDate?: Date
  ): Promise<Invoice> {
    await this.getInvoiceById(id, organizationId);

    return db.invoice.update({
      where: { id },
      data: {
        paymentStatus,
        paymentDate,
      },
    });
  }

  /**
   * Delete invoice (soft delete - only for drafts)
   */
  async deleteInvoice(id: string, organizationId: string): Promise<Invoice> {
    const invoice = await this.getInvoiceById(id, organizationId);

    if (invoice.status !== 'draft') {
      throw new ValidationError('Only draft invoices can be deleted. Use storno for finalized invoices.');
    }

    return db.invoice.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Get invoice statistics
   */
  async getInvoiceStats(organizationId: string): Promise<{
    total: number;
    draft: number;
    finalized: number;
    unpaid: number;
    paid: number;
    overdue: number;
    totalRevenue: number;
    unpaidAmount: number;
  }> {
    const invoices = await db.invoice.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      select: {
        status: true,
        paymentStatus: true,
        grossAmount: true,
        dueDate: true,
      },
    });

    const now = new Date();
    return {
      total: invoices.length,
      draft: invoices.filter((i) => i.status === 'draft').length,
      finalized: invoices.filter((i) => i.status === 'finalized' || i.status === 'sent').length,
      unpaid: invoices.filter((i) => i.paymentStatus === 'unpaid').length,
      paid: invoices.filter((i) => i.paymentStatus === 'paid').length,
      overdue: invoices.filter((i) => i.paymentStatus === 'unpaid' && i.dueDate < now).length,
      totalRevenue: invoices
        .filter((i) => i.paymentStatus === 'paid')
        .reduce((sum, i) => sum + Number(i.grossAmount), 0),
      unpaidAmount: invoices
        .filter((i) => i.paymentStatus === 'unpaid')
        .reduce((sum, i) => sum + Number(i.grossAmount), 0),
    };
  }

  /**
   * Update NAV status
   */
  async updateNAVStatus(
    id: string,
    organizationId: string,
    navStatus: 'not_submitted' | 'pending' | 'submitted' | 'failed'
  ): Promise<Invoice> {
    // Verify invoice belongs to organization
    await this.getInvoiceById(id, organizationId);

    return db.invoice.update({
      where: { id },
      data: { navStatus },
    });
  }
}

// Export singleton instance
export const invoiceService = new InvoiceService();

// Helper function - make it available to service
function generateInvoiceNumber(organizationId: string, issueDate: Date): Promise<string> {
  return invoiceService['generateInvoiceNumber'](organizationId, issueDate);
}
