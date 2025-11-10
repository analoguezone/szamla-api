import { OrganizationService, CreateOrganizationInput, UpdateOrganizationInput } from '@services/organization.service';
import { encryptionService } from '@services/encryption.service';
import { OrganizationNotFoundError, ValidationError } from '@utils/errors';
import { db } from '@config/database';

// Mock the database
jest.mock('@config/database', () => ({
  db: {
    organization: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  },
}));

describe('OrganizationService', () => {
  let organizationService: OrganizationService;

  beforeEach(() => {
    organizationService = new OrganizationService();
    jest.clearAllMocks();
  });

  describe('createOrganization', () => {
    const validInput: CreateOrganizationInput = {
      name: 'Test Company Ltd',
      taxNumber: '12345678-1-23',
      email: 'test@example.com',
      phone: '+36301234567',
      country: 'HU',
      postalCode: '1234',
      city: 'Budapest',
      address: 'Test Street 1',
      invoicePrefix: 'INV',
      softwareDeveloper: 'Test Developer',
      softwareDeveloperEmail: 'dev@example.com',
      navCredentials: {
        login: 'navuser',
        password: 'navpass',
        signatureKey: 'sigkey',
        exchangeKey: 'exchkey',
      },
    };

    it('should create organization with encrypted NAV credentials', async () => {
      const mockOrganization = {
        id: 'org-123',
        ...validInput,
        navLogin: 'navuser',
        navPasswordEncrypted: 'encrypted-password',
        navSignatureKeyEncrypted: 'encrypted-sig',
        navExchangeKeyEncrypted: 'encrypted-exch',
        balanceCredits: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (db.organization.findUnique as jest.Mock).mockResolvedValue(null);
      (db.organization.create as jest.Mock).mockResolvedValue(mockOrganization);

      const result = await organizationService.createOrganization(validInput);

      expect(db.organization.findUnique).toHaveBeenCalledWith({
        where: { taxNumber: validInput.taxNumber },
      });

      expect(db.organization.create).toHaveBeenCalled();
      expect(result).toEqual(mockOrganization);
    });

    it('should create organization without NAV credentials', async () => {
      const inputWithoutNAV = { ...validInput };
      delete inputWithoutNAV.navCredentials;

      const mockOrganization = {
        id: 'org-456',
        ...inputWithoutNAV,
        navLogin: null,
        navPasswordEncrypted: null,
        balanceCredits: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (db.organization.findUnique as jest.Mock).mockResolvedValue(null);
      (db.organization.create as jest.Mock).mockResolvedValue(mockOrganization);

      const result = await organizationService.createOrganization(inputWithoutNAV);

      expect(result).toEqual(mockOrganization);
    });

    it('should throw error if tax number already exists', async () => {
      const existingOrg = { id: 'org-existing', taxNumber: validInput.taxNumber };
      (db.organization.findUnique as jest.Mock).mockResolvedValue(existingOrg);

      await expect(organizationService.createOrganization(validInput)).rejects.toThrow(ValidationError);
      await expect(organizationService.createOrganization(validInput)).rejects.toThrow(
        'Organization with this tax number already exists'
      );
    });

    it('should use default values for optional fields', async () => {
      const minimalInput: CreateOrganizationInput = {
        name: 'Minimal Company',
        taxNumber: '98765432-1-23',
        email: 'minimal@example.com',
        postalCode: '5678',
        city: 'Debrecen',
        address: 'Address 2',
        softwareDeveloper: 'Developer',
        softwareDeveloperEmail: 'dev@example.com',
      };

      (db.organization.findUnique as jest.Mock).mockResolvedValue(null);
      (db.organization.create as jest.Mock).mockResolvedValue({
        id: 'org-minimal',
        ...minimalInput,
      });

      await organizationService.createOrganization(minimalInput);

      const createCall = (db.organization.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.country).toBe('HU');
      expect(createCall.data.invoicePrefix).toBe('INV');
      expect(createCall.data.defaultCurrency).toBe('HUF');
      expect(createCall.data.defaultLanguage).toBe('hu');
      expect(createCall.data.autoRechargeEnabled).toBe(true);
      expect(createCall.data.autoRechargeThresholdPercent).toBe(20);
      expect(createCall.data.autoRechargePackage).toBe('basic');
    });
  });

  describe('getOrganizationById', () => {
    it('should return organization by ID', async () => {
      const mockOrg = {
        id: 'org-123',
        name: 'Test Org',
        deletedAt: null,
      };

      (db.organization.findFirst as jest.Mock).mockResolvedValue(mockOrg);

      const result = await organizationService.getOrganizationById('org-123');

      expect(db.organization.findFirst).toHaveBeenCalledWith({
        where: { id: 'org-123', deletedAt: null },
      });
      expect(result).toEqual(mockOrg);
    });

    it('should throw error if organization not found', async () => {
      (db.organization.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(organizationService.getOrganizationById('non-existent')).rejects.toThrow(
        OrganizationNotFoundError
      );
    });

    it('should not return deleted organizations', async () => {
      (db.organization.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(organizationService.getOrganizationById('deleted-org')).rejects.toThrow(
        OrganizationNotFoundError
      );
    });
  });

  describe('getOrganizationWithNAVCredentials', () => {
    it('should return organization with decrypted NAV credentials', async () => {
      const encrypted = encryptionService.encryptNAVCredentials({
        technicalUser: 'navuser',
        password: 'navpass',
        signatureKey: 'sigkey',
        exchangeKey: 'exchkey',
      });

      const mockOrg = {
        id: 'org-123',
        name: 'Test Org',
        navLogin: 'navuser',
        navPasswordEncrypted: encrypted.passwordEncrypted,
        navSignatureKeyEncrypted: encrypted.signatureKeyEncrypted,
        navExchangeKeyEncrypted: encrypted.exchangeKeyEncrypted,
        deletedAt: null,
      };

      (db.organization.findFirst as jest.Mock).mockResolvedValue(mockOrg);

      const result = await organizationService.getOrganizationWithNAVCredentials('org-123');

      expect(result.navPassword).toBe('navpass');
      expect(result.navSignatureKey).toBe('sigkey');
      expect(result.navExchangeKey).toBe('exchkey');
    });

    it('should return organization without NAV credentials if not set', async () => {
      const mockOrg = {
        id: 'org-456',
        name: 'Test Org',
        navLogin: null,
        navPasswordEncrypted: null,
        navSignatureKeyEncrypted: null,
        navExchangeKeyEncrypted: null,
        deletedAt: null,
      };

      (db.organization.findFirst as jest.Mock).mockResolvedValue(mockOrg);

      const result = await organizationService.getOrganizationWithNAVCredentials('org-456');

      expect(result.navPassword).toBeUndefined();
      expect(result.navSignatureKey).toBeUndefined();
      expect(result.navExchangeKey).toBeUndefined();
    });
  });

  describe('updateOrganization', () => {
    it('should update organization details', async () => {
      const mockOrg = { id: 'org-123', name: 'Old Name', deletedAt: null };
      const updateInput: UpdateOrganizationInput = { name: 'New Name', email: 'new@example.com' };
      const updatedOrg = { ...mockOrg, ...updateInput };

      (db.organization.findFirst as jest.Mock).mockResolvedValue(mockOrg);
      (db.organization.update as jest.Mock).mockResolvedValue(updatedOrg);

      const result = await organizationService.updateOrganization('org-123', updateInput);

      expect(db.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: expect.objectContaining(updateInput),
      });
      expect(result).toEqual(updatedOrg);
    });

    it('should throw error if organization not found', async () => {
      (db.organization.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        organizationService.updateOrganization('non-existent', { name: 'New Name' })
      ).rejects.toThrow(OrganizationNotFoundError);
    });
  });

  describe('updateNAVCredentials', () => {
    it('should update and encrypt NAV credentials', async () => {
      const mockOrg = { id: 'org-123', deletedAt: null };
      const newCredentials = {
        login: 'newuser',
        password: 'newpass',
        signatureKey: 'newsig',
        exchangeKey: 'newexch',
      };

      (db.organization.findFirst as jest.Mock).mockResolvedValue(mockOrg);
      (db.organization.update as jest.Mock).mockResolvedValue({
        ...mockOrg,
        navLogin: 'newuser',
      });

      await organizationService.updateNAVCredentials('org-123', newCredentials);

      const updateCall = (db.organization.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.navLogin).toBe('newuser');
      expect(updateCall.data.navPasswordEncrypted).toBeDefined();
      expect(updateCall.data.navSignatureKeyEncrypted).toBeDefined();
      expect(updateCall.data.navExchangeKeyEncrypted).toBeDefined();
      expect(updateCall.data.navConnectionTested).toBe(false);
      expect(updateCall.data.navLastTestAt).toBeNull();
    });
  });

  describe('markNAVConnectionTested', () => {
    it('should mark NAV connection as tested', async () => {
      (db.organization.update as jest.Mock).mockResolvedValue({ id: 'org-123' });

      await organizationService.markNAVConnectionTested('org-123', true);

      expect(db.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: expect.objectContaining({
          navConnectionTested: true,
          navLastTestAt: expect.any(Date),
        }),
      });
    });
  });

  describe('credit management', () => {
    describe('addCredits', () => {
      it('should add credits to balance', async () => {
        const mockOrg = { id: 'org-123', balanceCredits: 100, deletedAt: null };
        (db.organization.findFirst as jest.Mock).mockResolvedValue(mockOrg);
        (db.organization.update as jest.Mock).mockResolvedValue({
          ...mockOrg,
          balanceCredits: 150,
        });

        const result = await organizationService.addCredits('org-123', 50);

        expect(db.organization.update).toHaveBeenCalledWith({
          where: { id: 'org-123' },
          data: expect.objectContaining({
            balanceCredits: 150,
          }),
        });
        expect(result.balanceCredits).toBe(150);
      });

      it('should throw error for negative credits', async () => {
        await expect(organizationService.addCredits('org-123', -10)).rejects.toThrow(ValidationError);
      });
    });

    describe('deductCredits', () => {
      it('should deduct credits from balance', async () => {
        const mockOrg = { id: 'org-123', balanceCredits: 100, deletedAt: null };
        (db.organization.findFirst as jest.Mock).mockResolvedValue(mockOrg);
        (db.organization.update as jest.Mock).mockResolvedValue({
          ...mockOrg,
          balanceCredits: 70,
        });

        const result = await organizationService.deductCredits('org-123', 30);

        expect(result.balanceCredits).toBe(70);
      });

      it('should throw error for insufficient credits', async () => {
        const mockOrg = { id: 'org-123', balanceCredits: 10, deletedAt: null };
        (db.organization.findFirst as jest.Mock).mockResolvedValue(mockOrg);

        await expect(organizationService.deductCredits('org-123', 50)).rejects.toThrow(ValidationError);
        await expect(organizationService.deductCredits('org-123', 50)).rejects.toThrow('Insufficient credits');
      });
    });

    describe('hasEnoughCredits', () => {
      it('should return true if enough credits', async () => {
        const mockOrg = { id: 'org-123', balanceCredits: 100, deletedAt: null };
        (db.organization.findFirst as jest.Mock).mockResolvedValue(mockOrg);

        const result = await organizationService.hasEnoughCredits('org-123', 50);

        expect(result).toBe(true);
      });

      it('should return false if insufficient credits', async () => {
        const mockOrg = { id: 'org-123', balanceCredits: 10, deletedAt: null };
        (db.organization.findFirst as jest.Mock).mockResolvedValue(mockOrg);

        const result = await organizationService.hasEnoughCredits('org-123', 50);

        expect(result).toBe(false);
      });
    });

    describe('getCreditBalance', () => {
      it('should return credit balance', async () => {
        const mockOrg = { id: 'org-123', balanceCredits: 250, deletedAt: null };
        (db.organization.findFirst as jest.Mock).mockResolvedValue(mockOrg);

        const result = await organizationService.getCreditBalance('org-123');

        expect(result).toBe(250);
      });
    });
  });

  describe('updateStripeCustomer', () => {
    it('should update Stripe customer information', async () => {
      const mockOrg = { id: 'org-123', deletedAt: null };
      (db.organization.findFirst as jest.Mock).mockResolvedValue(mockOrg);
      (db.organization.update as jest.Mock).mockResolvedValue({
        ...mockOrg,
        stripeCustomerId: 'cus_123',
      });

      await organizationService.updateStripeCustomer('org-123', 'cus_123', 'pm_123', '4242', 'visa');

      expect(db.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: expect.objectContaining({
          stripeCustomerId: 'cus_123',
          stripePaymentMethodId: 'pm_123',
          paymentMethodLast4: '4242',
          paymentMethodBrand: 'visa',
        }),
      });
    });
  });

  describe('updateStatus', () => {
    it('should update organization status', async () => {
      const mockOrg = { id: 'org-123', status: 'active', deletedAt: null };
      (db.organization.findFirst as jest.Mock).mockResolvedValue(mockOrg);
      (db.organization.update as jest.Mock).mockResolvedValue({
        ...mockOrg,
        status: 'suspended',
      });

      await organizationService.updateStatus('org-123', 'suspended');

      expect(db.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: expect.objectContaining({
          status: 'suspended',
        }),
      });
    });
  });

  describe('deleteOrganization', () => {
    it('should soft delete organization', async () => {
      const mockOrg = { id: 'org-123', deletedAt: null };
      (db.organization.findFirst as jest.Mock).mockResolvedValue(mockOrg);
      (db.organization.update as jest.Mock).mockResolvedValue({
        ...mockOrg,
        deletedAt: new Date(),
        status: 'deleted',
      });

      await organizationService.deleteOrganization('org-123');

      expect(db.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
          status: 'deleted',
        }),
      });
    });
  });

  describe('listOrganizations', () => {
    it('should list organizations with pagination', async () => {
      const mockOrgs = [
        { id: 'org-1', name: 'Org 1', deletedAt: null },
        { id: 'org-2', name: 'Org 2', deletedAt: null },
      ];

      (db.organization.findMany as jest.Mock).mockResolvedValue(mockOrgs);
      (db.organization.count as jest.Mock).mockResolvedValue(2);

      const result = await organizationService.listOrganizations({ skip: 0, take: 20 });

      expect(result.organizations).toEqual(mockOrgs);
      expect(result.total).toBe(2);
    });

    it('should filter by status', async () => {
      (db.organization.findMany as jest.Mock).mockResolvedValue([]);
      (db.organization.count as jest.Mock).mockResolvedValue(0);

      await organizationService.listOrganizations({ status: 'active' });

      expect(db.organization.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: 'active',
        }),
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should search by name, tax number, or email', async () => {
      (db.organization.findMany as jest.Mock).mockResolvedValue([]);
      (db.organization.count as jest.Mock).mockResolvedValue(0);

      await organizationService.listOrganizations({ search: 'test' });

      const findManyCall = (db.organization.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.OR).toBeDefined();
      expect(findManyCall.where.OR).toHaveLength(3);
    });
  });
});
