import { PartnerService, CreatePartnerInput, UpdatePartnerInput } from '@services/partner.service';
import { NotFoundError, ValidationError } from '@utils/errors';
import { db } from '@config/database';

// Mock the database
jest.mock('@config/database', () => ({
  db: {
    partner: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    invoice: {
      count: jest.fn(),
    },
  },
}));

describe('PartnerService', () => {
  let partnerService: PartnerService;
  const mockOrgId = 'org-123';

  beforeEach(() => {
    partnerService = new PartnerService();
    jest.clearAllMocks();
  });

  describe('createPartner', () => {
    const validInput: CreatePartnerInput = {
      organizationId: mockOrgId,
      name: 'Test Customer Ltd',
      taxNumber: '12345678-1-23',
      email: 'customer@example.com',
      phone: '+36301234567',
      country: 'HU',
      postalCode: '1234',
      city: 'Budapest',
      address: 'Test Street 1',
    };

    it('should create a partner successfully', async () => {
      const mockPartner = {
        id: 'partner-123',
        ...validInput,
        isIndividual: false,
        isForeign: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      (db.partner.findFirst as jest.Mock).mockResolvedValue(null);
      (db.partner.create as jest.Mock).mockResolvedValue(mockPartner);

      const result = await partnerService.createPartner(validInput);

      expect(db.partner.findFirst).toHaveBeenCalledWith({
        where: {
          organizationId: mockOrgId,
          taxNumber: validInput.taxNumber,
          deletedAt: null,
        },
      });

      expect(db.partner.create).toHaveBeenCalled();
      expect(result).toEqual(mockPartner);
    });

    it('should create a partner without tax number', async () => {
      const inputWithoutTaxNumber = { ...validInput };
      delete inputWithoutTaxNumber.taxNumber;

      const mockPartner = {
        id: 'partner-456',
        ...inputWithoutTaxNumber,
        taxNumber: null,
      };

      (db.partner.create as jest.Mock).mockResolvedValue(mockPartner);

      const result = await partnerService.createPartner(inputWithoutTaxNumber);

      expect(db.partner.findFirst).not.toHaveBeenCalled();
      expect(result).toEqual(mockPartner);
    });

    it('should throw error if tax number already exists', async () => {
      const existingPartner = { id: 'partner-existing', taxNumber: validInput.taxNumber };
      (db.partner.findFirst as jest.Mock).mockResolvedValue(existingPartner);

      await expect(partnerService.createPartner(validInput)).rejects.toThrow(ValidationError);
      await expect(partnerService.createPartner(validInput)).rejects.toThrow(
        'A partner with this tax number already exists'
      );
    });

    it('should use default values for optional fields', async () => {
      const minimalInput: CreatePartnerInput = {
        organizationId: mockOrgId,
        name: 'Minimal Partner',
        postalCode: '5678',
        city: 'Debrecen',
        address: 'Address 2',
      };

      (db.partner.create as jest.Mock).mockResolvedValue({
        id: 'partner-minimal',
        ...minimalInput,
      });

      await partnerService.createPartner(minimalInput);

      const createCall = (db.partner.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.country).toBe('HU');
      expect(createCall.data.isIndividual).toBe(false);
      expect(createCall.data.isForeign).toBe(false);
    });
  });

  describe('getPartnerById', () => {
    it('should return partner by ID', async () => {
      const mockPartner = {
        id: 'partner-123',
        organizationId: mockOrgId,
        name: 'Test Partner',
        deletedAt: null,
      };

      (db.partner.findFirst as jest.Mock).mockResolvedValue(mockPartner);

      const result = await partnerService.getPartnerById('partner-123', mockOrgId);

      expect(db.partner.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'partner-123',
          organizationId: mockOrgId,
          deletedAt: null,
        },
      });
      expect(result).toEqual(mockPartner);
    });

    it('should throw error if partner not found', async () => {
      (db.partner.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(partnerService.getPartnerById('non-existent', mockOrgId)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should not return partner from different organization', async () => {
      (db.partner.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(partnerService.getPartnerById('partner-123', 'other-org')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should not return deleted partners', async () => {
      (db.partner.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(partnerService.getPartnerById('deleted-partner', mockOrgId)).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('getPartnerByTaxNumber', () => {
    it('should return partner by tax number', async () => {
      const mockPartner = {
        id: 'partner-123',
        taxNumber: '12345678-1-23',
        organizationId: mockOrgId,
      };

      (db.partner.findFirst as jest.Mock).mockResolvedValue(mockPartner);

      const result = await partnerService.getPartnerByTaxNumber('12345678-1-23', mockOrgId);

      expect(result).toEqual(mockPartner);
    });

    it('should return null if not found', async () => {
      (db.partner.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await partnerService.getPartnerByTaxNumber('99999999-9-99', mockOrgId);

      expect(result).toBeNull();
    });
  });

  describe('updatePartner', () => {
    it('should update partner details', async () => {
      const mockPartner = {
        id: 'partner-123',
        organizationId: mockOrgId,
        name: 'Old Name',
        deletedAt: null,
      };
      const updateInput: UpdatePartnerInput = {
        name: 'New Name',
        email: 'newemail@example.com',
      };
      const updatedPartner = { ...mockPartner, ...updateInput };

      (db.partner.findFirst as jest.Mock).mockResolvedValue(mockPartner);
      (db.partner.update as jest.Mock).mockResolvedValue(updatedPartner);

      const result = await partnerService.updatePartner('partner-123', mockOrgId, updateInput);

      expect(db.partner.update).toHaveBeenCalledWith({
        where: { id: 'partner-123' },
        data: expect.objectContaining(updateInput),
      });
      expect(result).toEqual(updatedPartner);
    });

    it('should throw error if partner not found', async () => {
      (db.partner.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        partnerService.updatePartner('non-existent', mockOrgId, { name: 'New Name' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should check for duplicate tax number on update', async () => {
      const existingPartner = { id: 'partner-123', organizationId: mockOrgId, deletedAt: null };
      const duplicatePartner = { id: 'partner-456', taxNumber: '12345678-1-23' };

      (db.partner.findFirst as jest.Mock)
        .mockResolvedValueOnce(existingPartner) // getPartnerById
        .mockResolvedValueOnce(duplicatePartner); // duplicate check

      await expect(
        partnerService.updatePartner('partner-123', mockOrgId, { taxNumber: '12345678-1-23' })
      ).rejects.toThrow(ValidationError);
    });

    it('should allow updating to same tax number (no duplicate)', async () => {
      const mockPartner = {
        id: 'partner-123',
        organizationId: mockOrgId,
        taxNumber: '12345678-1-23',
        deletedAt: null,
      };

      (db.partner.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockPartner) // getPartnerById
        .mockResolvedValueOnce(null); // duplicate check (should exclude self)

      (db.partner.update as jest.Mock).mockResolvedValue(mockPartner);

      await partnerService.updatePartner('partner-123', mockOrgId, { taxNumber: '12345678-1-23' });

      expect(db.partner.update).toHaveBeenCalled();
    });
  });

  describe('deletePartner', () => {
    it('should soft delete partner', async () => {
      const mockPartner = { id: 'partner-123', organizationId: mockOrgId, deletedAt: null };

      (db.partner.findFirst as jest.Mock).mockResolvedValue(mockPartner);
      (db.invoice.count as jest.Mock).mockResolvedValue(0);
      (db.partner.update as jest.Mock).mockResolvedValue({
        ...mockPartner,
        deletedAt: new Date(),
      });

      await partnerService.deletePartner('partner-123', mockOrgId);

      expect(db.invoice.count).toHaveBeenCalledWith({
        where: { partnerId: 'partner-123' },
      });

      expect(db.partner.update).toHaveBeenCalledWith({
        where: { id: 'partner-123' },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
        }),
      });
    });

    it('should throw error if partner has invoices', async () => {
      const mockPartner = { id: 'partner-123', organizationId: mockOrgId, deletedAt: null };

      (db.partner.findFirst as jest.Mock).mockResolvedValue(mockPartner);
      (db.invoice.count as jest.Mock).mockResolvedValue(5);

      await expect(partnerService.deletePartner('partner-123', mockOrgId)).rejects.toThrow(
        ValidationError
      );
      await expect(partnerService.deletePartner('partner-123', mockOrgId)).rejects.toThrow(
        'Cannot delete partner with 5 existing invoice'
      );
    });

    it('should throw error if partner not found', async () => {
      (db.partner.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(partnerService.deletePartner('non-existent', mockOrgId)).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('listPartners', () => {
    it('should list partners with pagination', async () => {
      const mockPartners = [
        { id: 'partner-1', name: 'Partner A', organizationId: mockOrgId, deletedAt: null },
        { id: 'partner-2', name: 'Partner B', organizationId: mockOrgId, deletedAt: null },
      ];

      (db.partner.findMany as jest.Mock).mockResolvedValue(mockPartners);
      (db.partner.count as jest.Mock).mockResolvedValue(2);

      const result = await partnerService.listPartners({
        organizationId: mockOrgId,
        skip: 0,
        take: 20,
      });

      expect(result.partners).toEqual(mockPartners);
      expect(result.total).toBe(2);
    });

    it('should filter by search query', async () => {
      (db.partner.findMany as jest.Mock).mockResolvedValue([]);
      (db.partner.count as jest.Mock).mockResolvedValue(0);

      await partnerService.listPartners({
        organizationId: mockOrgId,
        search: 'test',
      });

      const findManyCall = (db.partner.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.OR).toBeDefined();
      expect(findManyCall.where.OR.length).toBeGreaterThan(0);
    });

    it('should filter by isIndividual', async () => {
      (db.partner.findMany as jest.Mock).mockResolvedValue([]);
      (db.partner.count as jest.Mock).mockResolvedValue(0);

      await partnerService.listPartners({
        organizationId: mockOrgId,
        isIndividual: true,
      });

      const findManyCall = (db.partner.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.isIndividual).toBe(true);
    });

    it('should filter by country', async () => {
      (db.partner.findMany as jest.Mock).mockResolvedValue([]);
      (db.partner.count as jest.Mock).mockResolvedValue(0);

      await partnerService.listPartners({
        organizationId: mockOrgId,
        country: 'DE',
      });

      const findManyCall = (db.partner.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.country).toBe('DE');
    });
  });

  describe('countPartners', () => {
    it('should count partners for organization', async () => {
      (db.partner.count as jest.Mock).mockResolvedValue(42);

      const result = await partnerService.countPartners(mockOrgId);

      expect(result).toBe(42);
      expect(db.partner.count).toHaveBeenCalledWith({
        where: {
          organizationId: mockOrgId,
          deletedAt: null,
        },
      });
    });
  });

  describe('searchPartners', () => {
    it('should search partners by query', async () => {
      const mockPartners = [
        { id: 'partner-1', name: 'Test Company' },
        { id: 'partner-2', name: 'Test Industries' },
      ];

      (db.partner.findMany as jest.Mock).mockResolvedValue(mockPartners);

      const result = await partnerService.searchPartners(mockOrgId, 'test', 10);

      expect(result).toEqual(mockPartners);
      expect(db.partner.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: mockOrgId,
          deletedAt: null,
          OR: expect.any(Array),
        },
        take: 10,
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('getPartnerStats', () => {
    it('should return partner statistics', async () => {
      const mockPartners = [
        { isIndividual: true, isForeign: false },
        { isIndividual: false, isForeign: false },
        { isIndividual: false, isForeign: true },
        { isIndividual: true, isForeign: true },
      ];

      (db.partner.findMany as jest.Mock).mockResolvedValue(mockPartners);

      const result = await partnerService.getPartnerStats(mockOrgId);

      expect(result).toEqual({
        total: 4,
        individuals: 2,
        companies: 2,
        foreign: 2,
        domestic: 2,
      });
    });

    it('should return zero stats for no partners', async () => {
      (db.partner.findMany as jest.Mock).mockResolvedValue([]);

      const result = await partnerService.getPartnerStats(mockOrgId);

      expect(result).toEqual({
        total: 0,
        individuals: 0,
        companies: 0,
        foreign: 0,
        domestic: 0,
      });
    });
  });
});
