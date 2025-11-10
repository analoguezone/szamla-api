import {
  InvoiceService,
  CreateInvoiceInput,
  InvoiceWithItems,
} from '@services/invoice.service';
import { organizationService } from '@services/organization.service';
import { partnerService } from '@services/partner.service';
import {
  NotFoundError,
  ValidationError,
  InsufficientCreditsError,
} from '@utils/errors';
import { db } from '@config/database';
import { InvoiceItem, Prisma } from '@prisma/client';

// Mock dependencies
jest.mock('@config/database', () => ({
  db: {
    invoice: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    invoiceItem: {
      create: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@services/organization.service');
jest.mock('@services/partner.service');

describe('InvoiceService', () => {
  let invoiceService: InvoiceService;
  const mockOrgId = 'org-123';
  const mockPartnerId = 'partner-456';

  beforeEach(() => {
    invoiceService = new InvoiceService();
    jest.clearAllMocks();
  });

  describe('createInvoice', () => {
    const validInput: CreateInvoiceInput = {
      organizationId: mockOrgId,
      partnerId: mockPartnerId,
      issueDate: new Date('2025-01-15'),
      fulfillmentDate: new Date('2025-01-15'),
      dueDate: new Date('2025-02-15'),
      currency: 'HUF',
      exchangeRate: 1.0,
      items: [
        {
          name: 'Web Development',
          quantity: 10,
          unit: 'hour',
          netUnitPrice: 10000,
          vatRate: 27,
        },
        {
          name: 'Hosting Service',
          quantity: 1,
          unit: 'month',
          netUnitPrice: 5000,
          vatRate: 27,
        },
      ],
      paymentMethod: 'transfer',
      language: 'hu',
    };

    const mockOrganization = {
      id: mockOrgId,
      name: 'Test Org',
      invoicePrefix: 'TST',
      balanceCredits: 100,
    };

    const mockPartner = {
      id: mockPartnerId,
      organizationId: mockOrgId,
      name: 'Test Customer',
    };

    it('should create invoice with correct calculations', async () => {
      // Mock dependencies
      (organizationService.hasEnoughCredits as jest.Mock).mockResolvedValue(true);
      (organizationService.getOrganizationById as jest.Mock).mockResolvedValue(mockOrganization);
      (partnerService.getPartnerById as jest.Mock).mockResolvedValue(mockPartner);

      const mockInvoice: InvoiceWithItems = {
        id: 'inv-123',
        organizationId: mockOrgId,
        partnerId: mockPartnerId,
        invoiceNumber: 'TST-2025-00001',
        invoiceType: 'normal',
        issueDate: validInput.issueDate,
        fulfillmentDate: validInput.fulfillmentDate,
        dueDate: validInput.dueDate,
        currency: 'HUF',
        exchangeRate: new Prisma.Decimal(1.0),
        netAmount: new Prisma.Decimal(105000), // (10 * 10000) + (1 * 5000)
        vatAmount: new Prisma.Decimal(28350), // 105000 * 0.27
        grossAmount: new Prisma.Decimal(133350), // 105000 + 28350
        paymentMethod: 'transfer',
        paymentStatus: 'unpaid',
        language: 'hu',
        comment: null,
        internalNote: null,
        status: 'draft',
        navStatus: 'pending',
        originalInvoiceId: null,
        isStorned: false,
        finalizedAt: null,
        paymentDate: null,
        navTransactionId: null,
        navConfirmedAt: null,
        navError: null,
        pdfPath: null,
        navXmlPath: null,
        vatSummary: {
          '27%': {
            net: '105000.00',
            vat: '28350.00',
            gross: '133350.00',
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        items: [
          {
            id: 'item-1',
            invoiceId: 'inv-123',
            lineNumber: 1,
            name: 'Web Development',
            description: null,
            sku: null,
            quantity: new Prisma.Decimal(10),
            unit: 'hour',
            netUnitPrice: new Prisma.Decimal(10000),
            vatRate: new Prisma.Decimal(27),
            vatCode: null,
            netAmount: new Prisma.Decimal(100000),
            vatAmount: new Prisma.Decimal(27000),
            grossAmount: new Prisma.Decimal(127000),
            comment: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as InvoiceItem,
          {
            id: 'item-2',
            invoiceId: 'inv-123',
            lineNumber: 2,
            name: 'Hosting Service',
            description: null,
            sku: null,
            quantity: new Prisma.Decimal(1),
            unit: 'month',
            netUnitPrice: new Prisma.Decimal(5000),
            vatRate: new Prisma.Decimal(27),
            vatCode: null,
            netAmount: new Prisma.Decimal(5000),
            vatAmount: new Prisma.Decimal(1350),
            grossAmount: new Prisma.Decimal(6350),
            comment: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as InvoiceItem,
        ],
      };

      (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback({
          invoice: {
            create: jest.fn().mockResolvedValue(mockInvoice),
            findUnique: jest.fn().mockResolvedValue(mockInvoice),
          },
          invoiceItem: {
            create: jest.fn(),
          },
          organization: {
            update: jest.fn(),
            findUnique: jest.fn().mockResolvedValue({ balanceCredits: 99 }),
          },
          transaction: {
            create: jest.fn(),
          },
        });
      });

      const result = await invoiceService.createInvoice(validInput);

      expect(result.invoiceNumber).toBe('TST-2025-00001');
      expect(Number(result.netAmount)).toBe(105000);
      expect(Number(result.vatAmount)).toBe(28350);
      expect(Number(result.grossAmount)).toBe(133350);
      expect(result.items).toHaveLength(2);
    });

    it('should generate invoice number with yearly reset', async () => {
      (organizationService.hasEnoughCredits as jest.Mock).mockResolvedValue(true);
      (organizationService.getOrganizationById as jest.Mock).mockResolvedValue(mockOrganization);
      (partnerService.getPartnerById as jest.Mock).mockResolvedValue(mockPartner);

      // Mock last invoice from 2024
      (db.invoice.findFirst as jest.Mock).mockResolvedValue({
        invoiceNumber: 'TST-2024-00099',
      });

      const mockInvoice: any = {
        id: 'inv-new',
        invoiceNumber: 'TST-2025-00001', // Should reset to 00001 for new year
        items: [],
      };

      (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback({
          invoice: {
            create: jest.fn().mockResolvedValue(mockInvoice),
            findUnique: jest.fn().mockResolvedValue(mockInvoice),
          },
          invoiceItem: { create: jest.fn() },
          organization: {
            update: jest.fn(),
            findUnique: jest.fn().mockResolvedValue({ balanceCredits: 99 }),
          },
          transaction: { create: jest.fn() },
        });
      });

      const result = await invoiceService.createInvoice(validInput);

      expect(result.invoiceNumber).toBe('TST-2025-00001');
    });

    it('should handle multi-currency invoices', async () => {
      const eurInput: CreateInvoiceInput = {
        ...validInput,
        currency: 'EUR',
        exchangeRate: 380.5,
        items: [
          {
            name: 'Service',
            quantity: 1,
            netUnitPrice: 100,
            vatRate: 27,
          },
        ],
      };

      (organizationService.hasEnoughCredits as jest.Mock).mockResolvedValue(true);
      (organizationService.getOrganizationById as jest.Mock).mockResolvedValue(mockOrganization);
      (partnerService.getPartnerById as jest.Mock).mockResolvedValue(mockPartner);

      const mockInvoice: any = {
        id: 'inv-eur',
        currency: 'EUR',
        exchangeRate: 380.5,
        netAmount: 100,
        vatAmount: 27,
        grossAmount: 127,
        items: [],
      };

      (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback({
          invoice: {
            create: jest.fn().mockResolvedValue(mockInvoice),
            findUnique: jest.fn().mockResolvedValue(mockInvoice),
          },
          invoiceItem: { create: jest.fn() },
          organization: {
            update: jest.fn(),
            findUnique: jest.fn().mockResolvedValue({ balanceCredits: 99 }),
          },
          transaction: { create: jest.fn() },
        });
      });

      const result = await invoiceService.createInvoice(eurInput);

      expect(result.currency).toBe('EUR');
      expect(result.exchangeRate).toBe(380.5);
    });

    it('should handle EU reverse charge (0% VAT with AE code)', async () => {
      const euInput: CreateInvoiceInput = {
        ...validInput,
        items: [
          {
            name: 'EU Service',
            quantity: 1,
            netUnitPrice: 1000,
            vatRate: 0,
            vatCode: 'AE', // Article 138 - reverse charge
          },
        ],
      };

      (organizationService.hasEnoughCredits as jest.Mock).mockResolvedValue(true);
      (organizationService.getOrganizationById as jest.Mock).mockResolvedValue(mockOrganization);
      (partnerService.getPartnerById as jest.Mock).mockResolvedValue(mockPartner);

      const mockInvoice: any = {
        id: 'inv-eu',
        netAmount: 1000,
        vatAmount: 0,
        grossAmount: 1000,
        vatSummary: {
          AE: {
            net: '1000.00',
            vat: '0.00',
            gross: '1000.00',
          },
        },
        items: [
          {
            name: 'EU Service',
            vatRate: 0,
            vatCode: 'AE',
            netAmount: 1000,
            vatAmount: 0,
            grossAmount: 1000,
          },
        ],
      };

      (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback({
          invoice: {
            create: jest.fn().mockResolvedValue(mockInvoice),
            findUnique: jest.fn().mockResolvedValue(mockInvoice),
          },
          invoiceItem: { create: jest.fn() },
          organization: {
            update: jest.fn(),
            findUnique: jest.fn().mockResolvedValue({ balanceCredits: 99 }),
          },
          transaction: { create: jest.fn() },
        });
      });

      const result = await invoiceService.createInvoice(euInput);

      expect(result.vatAmount).toBe(0);
      expect(result.vatSummary).toHaveProperty('AE');
    });

    it('should throw error if insufficient credits', async () => {
      (organizationService.hasEnoughCredits as jest.Mock).mockResolvedValue(false);
      (organizationService.getCreditBalance as jest.Mock).mockResolvedValue(0);

      await expect(invoiceService.createInvoice(validInput)).rejects.toThrow(
        InsufficientCreditsError
      );
    });

    it('should throw error if partner not found', async () => {
      (organizationService.hasEnoughCredits as jest.Mock).mockResolvedValue(true);
      (partnerService.getPartnerById as jest.Mock).mockRejectedValue(
        new NotFoundError('Partner', mockPartnerId)
      );

      await expect(invoiceService.createInvoice(validInput)).rejects.toThrow(NotFoundError);
    });

    it('should deduct credit in transaction', async () => {
      (organizationService.hasEnoughCredits as jest.Mock).mockResolvedValue(true);
      (organizationService.getOrganizationById as jest.Mock).mockResolvedValue(mockOrganization);
      (partnerService.getPartnerById as jest.Mock).mockResolvedValue(mockPartner);

      const mockTx = {
        invoice: {
          create: jest.fn().mockResolvedValue({ id: 'inv-123' }),
          findUnique: jest.fn().mockResolvedValue({ id: 'inv-123', items: [] }),
        },
        invoiceItem: { create: jest.fn() },
        organization: {
          update: jest.fn(),
          findUnique: jest.fn().mockResolvedValue({ balanceCredits: 99 }),
        },
        transaction: { create: jest.fn() },
      };

      (db.$transaction as jest.Mock).mockImplementation(async (callback) => callback(mockTx));

      await invoiceService.createInvoice(validInput);

      expect(mockTx.organization.update).toHaveBeenCalledWith({
        where: { id: mockOrgId },
        data: { balanceCredits: { decrement: 1 } },
      });

      expect(mockTx.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: mockOrgId,
          type: 'invoice_charge',
          creditsAmount: -1,
          balanceBeforeCredits: 99,
          balanceAfterCredits: 98,
        }),
      });
    });

    it('should handle mixed VAT rates', async () => {
      const mixedInput: CreateInvoiceInput = {
        ...validInput,
        items: [
          {
            name: 'Standard VAT Item',
            quantity: 1,
            netUnitPrice: 1000,
            vatRate: 27,
          },
          {
            name: 'Reduced VAT Item',
            quantity: 1,
            netUnitPrice: 1000,
            vatRate: 5,
          },
          {
            name: 'Zero VAT Item',
            quantity: 1,
            netUnitPrice: 1000,
            vatRate: 0,
            vatCode: 'AAM', // Export
          },
        ],
      };

      (organizationService.hasEnoughCredits as jest.Mock).mockResolvedValue(true);
      (organizationService.getOrganizationById as jest.Mock).mockResolvedValue(mockOrganization);
      (partnerService.getPartnerById as jest.Mock).mockResolvedValue(mockPartner);

      const mockInvoice: any = {
        id: 'inv-mixed',
        netAmount: 3000,
        vatAmount: 320, // (1000 * 0.27) + (1000 * 0.05) + (1000 * 0)
        grossAmount: 3320,
        vatSummary: {
          '27%': { net: '1000.00', vat: '270.00', gross: '1270.00' },
          '5%': { net: '1000.00', vat: '50.00', gross: '1050.00' },
          AAM: { net: '1000.00', vat: '0.00', gross: '1000.00' },
        },
        items: [],
      };

      (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback({
          invoice: {
            create: jest.fn().mockResolvedValue(mockInvoice),
            findUnique: jest.fn().mockResolvedValue(mockInvoice),
          },
          invoiceItem: { create: jest.fn() },
          organization: {
            update: jest.fn(),
            findUnique: jest.fn().mockResolvedValue({ balanceCredits: 99 }),
          },
          transaction: { create: jest.fn() },
        });
      });

      const result = await invoiceService.createInvoice(mixedInput);

      expect(result.vatSummary).toHaveProperty('27%');
      expect(result.vatSummary).toHaveProperty('5%');
      expect(result.vatSummary).toHaveProperty('AAM');
    });
  });

  describe('createStornoInvoice', () => {
    const originalInvoice: InvoiceWithItems = {
      id: 'inv-original',
      organizationId: mockOrgId,
      partnerId: mockPartnerId,
      invoiceNumber: 'TST-2025-00001',
      invoiceType: 'normal',
      issueDate: new Date('2025-01-15'),
      fulfillmentDate: new Date('2025-01-15'),
      dueDate: new Date('2025-02-15'),
      currency: 'HUF',
      exchangeRate: new Prisma.Decimal(1.0),
      netAmount: new Prisma.Decimal(100000),
      vatAmount: new Prisma.Decimal(27000),
      grossAmount: new Prisma.Decimal(127000),
      paymentMethod: 'transfer',
      paymentStatus: 'unpaid',
      language: 'hu',
      comment: null,
      internalNote: null,
      status: 'finalized',
      navStatus: 'sent',
      originalInvoiceId: null,
      isStorned: false,
      finalizedAt: new Date(),
      paymentDate: null,
      navTransactionId: null,
      navConfirmedAt: null,
      navError: null,
      pdfPath: null,
      navXmlPath: null,
      vatSummary: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      items: [
        {
          id: 'item-1',
          invoiceId: 'inv-original',
          lineNumber: 1,
          name: 'Service',
          description: null,
          sku: null,
          quantity: new Prisma.Decimal(10),
          unit: 'hour',
          netUnitPrice: new Prisma.Decimal(10000),
          vatRate: new Prisma.Decimal(27),
          vatCode: null,
          netAmount: new Prisma.Decimal(100000),
          vatAmount: new Prisma.Decimal(27000),
          grossAmount: new Prisma.Decimal(127000),
          comment: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as InvoiceItem,
      ],
    };

    it('should create storno invoice with negative amounts', async () => {
      (organizationService.hasEnoughCredits as jest.Mock).mockResolvedValue(true);
      (organizationService.getOrganizationById as jest.Mock).mockResolvedValue({
        id: mockOrgId,
        invoicePrefix: 'TST',
      });

      const mockStornoInvoice: any = {
        id: 'inv-storno',
        invoiceNumber: 'TST-2025-00002',
        invoiceType: 'storno',
        originalInvoiceId: 'inv-original',
        netAmount: -100000,
        vatAmount: -27000,
        grossAmount: -127000,
        items: [
          {
            name: 'Service',
            quantity: -10, // Negative
            netAmount: -100000,
            vatAmount: -27000,
            grossAmount: -127000,
          },
        ],
      };

      (db.invoice.findFirst as jest.Mock).mockResolvedValue(originalInvoice);

      (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback({
          invoice: {
            create: jest.fn().mockResolvedValue(mockStornoInvoice),
            update: jest.fn(),
            findUnique: jest.fn().mockResolvedValue(mockStornoInvoice),
          },
          invoiceItem: { create: jest.fn() },
          organization: {
            update: jest.fn(),
            findUnique: jest.fn().mockResolvedValue({ balanceCredits: 99 }),
          },
          transaction: { create: jest.fn() },
        });
      });

      const result = await invoiceService.createStornoInvoice(mockOrgId, 'inv-original', {
        issueDate: new Date('2025-01-20'),
        comment: 'Cancellation',
      });

      expect(result.invoiceType).toBe('storno');
      expect(result.originalInvoiceId).toBe('inv-original');
      expect(result.netAmount).toBe(-100000);
    });

    it('should throw error if invoice already storned', async () => {
      const stornedInvoice = { ...originalInvoice, isStorned: true };
      (db.invoice.findFirst as jest.Mock).mockResolvedValue(stornedInvoice);

      await expect(
        invoiceService.createStornoInvoice(mockOrgId, 'inv-original', {
          issueDate: new Date(),
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw error if trying to storno a storno', async () => {
      const stornoInvoice = { ...originalInvoice, invoiceType: 'storno' };
      (db.invoice.findFirst as jest.Mock).mockResolvedValue(stornoInvoice);

      await expect(
        invoiceService.createStornoInvoice(mockOrgId, 'inv-original', {
          issueDate: new Date(),
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should deduct credit for storno invoice', async () => {
      (organizationService.hasEnoughCredits as jest.Mock).mockResolvedValue(true);
      (organizationService.getOrganizationById as jest.Mock).mockResolvedValue({
        id: mockOrgId,
        invoicePrefix: 'TST',
      });
      (db.invoice.findFirst as jest.Mock).mockResolvedValue(originalInvoice);

      const mockTx = {
        invoice: {
          create: jest.fn().mockResolvedValue({ id: 'inv-storno' }),
          update: jest.fn(),
          findUnique: jest.fn().mockResolvedValue({ id: 'inv-storno', items: [] }),
        },
        invoiceItem: { create: jest.fn() },
        organization: {
          update: jest.fn(),
          findUnique: jest.fn().mockResolvedValue({ balanceCredits: 99 }),
        },
        transaction: { create: jest.fn() },
      };

      (db.$transaction as jest.Mock).mockImplementation(async (callback) => callback(mockTx));

      await invoiceService.createStornoInvoice(mockOrgId, 'inv-original', {
        issueDate: new Date(),
      });

      expect(mockTx.organization.update).toHaveBeenCalledWith({
        where: { id: mockOrgId },
        data: { balanceCredits: { decrement: 1 } },
      });
    });

    it('should mark original invoice as storned', async () => {
      (organizationService.hasEnoughCredits as jest.Mock).mockResolvedValue(true);
      (organizationService.getOrganizationById as jest.Mock).mockResolvedValue({
        id: mockOrgId,
        invoicePrefix: 'TST',
      });
      (db.invoice.findFirst as jest.Mock).mockResolvedValue(originalInvoice);

      const mockTx = {
        invoice: {
          create: jest.fn().mockResolvedValue({ id: 'inv-storno' }),
          update: jest.fn(),
          findUnique: jest.fn().mockResolvedValue({ id: 'inv-storno', items: [] }),
        },
        invoiceItem: { create: jest.fn() },
        organization: {
          update: jest.fn(),
          findUnique: jest.fn().mockResolvedValue({ balanceCredits: 99 }),
        },
        transaction: { create: jest.fn() },
      };

      (db.$transaction as jest.Mock).mockImplementation(async (callback) => callback(mockTx));

      await invoiceService.createStornoInvoice(mockOrgId, 'inv-original', {
        issueDate: new Date(),
      });

      expect(mockTx.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-original' },
        data: { isStorned: true },
      });
    });
  });

  describe('getInvoiceById', () => {
    it('should return invoice with items', async () => {
      const mockInvoice: any = {
        id: 'inv-123',
        organizationId: mockOrgId,
        invoiceNumber: 'TST-2025-00001',
        items: [{ id: 'item-1', name: 'Service' }],
      };

      (db.invoice.findFirst as jest.Mock).mockResolvedValue(mockInvoice);

      const result = await invoiceService.getInvoiceById('inv-123', mockOrgId);

      expect(result).toEqual(mockInvoice);
      expect(db.invoice.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'inv-123',
          organizationId: mockOrgId,
          deletedAt: null,
        },
        include: {
          items: {
            orderBy: { lineNumber: 'asc' },
          },
        },
      });
    });

    it('should throw error if invoice not found', async () => {
      (db.invoice.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(invoiceService.getInvoiceById('non-existent', mockOrgId)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should enforce organization isolation', async () => {
      (db.invoice.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(invoiceService.getInvoiceById('inv-123', 'other-org')).rejects.toThrow(
        NotFoundError
      );

      expect(db.invoice.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'inv-123',
          organizationId: 'other-org',
          deletedAt: null,
        },
        include: expect.any(Object),
      });
    });
  });

  describe('listInvoices', () => {
    it('should list invoices with pagination', async () => {
      const mockInvoices = [
        { id: 'inv-1', invoiceNumber: 'TST-2025-00001' },
        { id: 'inv-2', invoiceNumber: 'TST-2025-00002' },
      ];

      (db.invoice.findMany as jest.Mock).mockResolvedValue(mockInvoices);
      (db.invoice.count as jest.Mock).mockResolvedValue(2);

      const result = await invoiceService.listInvoices({
        organizationId: mockOrgId,
        skip: 0,
        take: 20,
      });

      expect(result.invoices).toEqual(mockInvoices);
      expect(result.total).toBe(2);
    });

    it('should filter by partner', async () => {
      (db.invoice.findMany as jest.Mock).mockResolvedValue([]);
      (db.invoice.count as jest.Mock).mockResolvedValue(0);

      await invoiceService.listInvoices({
        organizationId: mockOrgId,
        partnerId: mockPartnerId,
      });

      const findManyCall = (db.invoice.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.partnerId).toBe(mockPartnerId);
    });

    it('should filter by status', async () => {
      (db.invoice.findMany as jest.Mock).mockResolvedValue([]);
      (db.invoice.count as jest.Mock).mockResolvedValue(0);

      await invoiceService.listInvoices({
        organizationId: mockOrgId,
        status: 'finalized',
      });

      const findManyCall = (db.invoice.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.status).toBe('finalized');
    });

    it('should filter by date range', async () => {
      (db.invoice.findMany as jest.Mock).mockResolvedValue([]);
      (db.invoice.count as jest.Mock).mockResolvedValue(0);

      const from = new Date('2025-01-01');
      const to = new Date('2025-01-31');

      await invoiceService.listInvoices({
        organizationId: mockOrgId,
        issueDateFrom: from,
        issueDateTo: to,
      });

      const findManyCall = (db.invoice.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.issueDate).toEqual({ gte: from, lte: to });
    });

    it('should search by invoice number', async () => {
      (db.invoice.findMany as jest.Mock).mockResolvedValue([]);
      (db.invoice.count as jest.Mock).mockResolvedValue(0);

      await invoiceService.listInvoices({
        organizationId: mockOrgId,
        search: 'TST-2025',
      });

      const findManyCall = (db.invoice.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.OR).toBeDefined();
    });
  });

  describe('finalizeInvoice', () => {
    it('should finalize draft invoice', async () => {
      const draftInvoice: any = {
        id: 'inv-123',
        status: 'draft',
        items: [],
      };

      (db.invoice.findFirst as jest.Mock).mockResolvedValue(draftInvoice);
      (db.invoice.update as jest.Mock).mockResolvedValue({
        ...draftInvoice,
        status: 'finalized',
        finalizedAt: expect.any(Date),
      });

      const result = await invoiceService.finalizeInvoice('inv-123', mockOrgId);

      expect(result.status).toBe('finalized');
      expect(db.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-123' },
        data: {
          status: 'finalized',
          finalizedAt: expect.any(Date),
        },
      });
    });

    it('should throw error if invoice not draft', async () => {
      const finalizedInvoice: any = {
        id: 'inv-123',
        status: 'finalized',
        items: [],
      };

      (db.invoice.findFirst as jest.Mock).mockResolvedValue(finalizedInvoice);

      await expect(invoiceService.finalizeInvoice('inv-123', mockOrgId)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('updatePaymentStatus', () => {
    it('should update payment status', async () => {
      const mockInvoice: any = { id: 'inv-123', items: [] };

      (db.invoice.findFirst as jest.Mock).mockResolvedValue(mockInvoice);
      (db.invoice.update as jest.Mock).mockResolvedValue({
        ...mockInvoice,
        paymentStatus: 'paid',
        paymentDate: expect.any(Date),
      });

      const paymentDate = new Date();
      await invoiceService.updatePaymentStatus('inv-123', mockOrgId, 'paid', paymentDate);

      expect(db.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-123' },
        data: {
          paymentStatus: 'paid',
          paymentDate,
        },
      });
    });
  });

  describe('deleteInvoice', () => {
    it('should soft delete draft invoice', async () => {
      const draftInvoice: any = { id: 'inv-123', status: 'draft', items: [] };

      (db.invoice.findFirst as jest.Mock).mockResolvedValue(draftInvoice);
      (db.invoice.update as jest.Mock).mockResolvedValue({
        ...draftInvoice,
        deletedAt: expect.any(Date),
      });

      await invoiceService.deleteInvoice('inv-123', mockOrgId);

      expect(db.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-123' },
        data: {
          deletedAt: expect.any(Date),
        },
      });
    });

    it('should throw error if invoice is finalized', async () => {
      const finalizedInvoice: any = { id: 'inv-123', status: 'finalized', items: [] };

      (db.invoice.findFirst as jest.Mock).mockResolvedValue(finalizedInvoice);

      await expect(invoiceService.deleteInvoice('inv-123', mockOrgId)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('getInvoiceStats', () => {
    it('should return invoice statistics', async () => {
      const mockInvoices = [
        {
          status: 'draft',
          paymentStatus: 'unpaid',
          grossAmount: 10000,
          dueDate: new Date('2025-12-01'), // Future date
        },
        {
          status: 'finalized',
          paymentStatus: 'paid',
          grossAmount: 20000,
          dueDate: new Date('2025-12-01'), // Future date
        },
        {
          status: 'sent',
          paymentStatus: 'unpaid',
          grossAmount: 15000,
          dueDate: new Date('2024-12-01'), // Overdue
        },
      ];

      (db.invoice.findMany as jest.Mock).mockResolvedValue(mockInvoices);

      const result = await invoiceService.getInvoiceStats(mockOrgId);

      expect(result.total).toBe(3);
      expect(result.draft).toBe(1);
      expect(result.finalized).toBe(2); // finalized + sent
      expect(result.unpaid).toBe(2);
      expect(result.paid).toBe(1);
      expect(result.overdue).toBe(1);
      expect(result.totalRevenue).toBe(20000);
      expect(result.unpaidAmount).toBe(25000); // 10000 + 15000
    });

    it('should return zero stats for no invoices', async () => {
      (db.invoice.findMany as jest.Mock).mockResolvedValue([]);

      const result = await invoiceService.getInvoiceStats(mockOrgId);

      expect(result.total).toBe(0);
      expect(result.totalRevenue).toBe(0);
      expect(result.unpaidAmount).toBe(0);
    });
  });
});
