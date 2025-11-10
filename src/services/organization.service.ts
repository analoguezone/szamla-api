import { db } from '@config/database';
import { encryptionService } from './encryption.service';
import { OrganizationNotFoundError, ValidationError } from '@utils/errors';
import { Organization, Prisma } from '@prisma/client';

/**
 * Organization Service
 *
 * Handles CRUD operations for organizations with:
 * - NAV credential encryption/decryption
 * - Credit balance management
 * - Auto-recharge settings
 * - Multi-tenant data isolation
 */

export interface CreateOrganizationInput {
  // Organization Details
  name: string;
  taxNumber: string;
  email: string;
  phone?: string;

  // Address
  country?: string;
  postalCode: string;
  city: string;
  address: string;

  // Invoice Settings
  invoicePrefix?: string;
  defaultCurrency?: string;
  defaultLanguage?: string;

  // Logo
  logoUrl?: string;

  // Software Details (for NAV)
  softwareDeveloper: string;
  softwareDeveloperEmail: string;
  softwareDeveloperTaxNumber?: string;

  // NAV Credentials (will be encrypted)
  navCredentials?: {
    login: string;
    password: string;
    signatureKey: string;
    exchangeKey: string;
  };

  // Billing
  autoRechargeEnabled?: boolean;
  autoRechargeThresholdPercent?: number;
  autoRechargePackage?: string;
}

export interface UpdateOrganizationInput {
  // Organization Details
  name?: string;
  email?: string;
  phone?: string;

  // Address
  country?: string;
  postalCode?: string;
  city?: string;
  address?: string;

  // Invoice Settings
  invoicePrefix?: string;
  defaultCurrency?: string;
  defaultLanguage?: string;

  // Logo
  logoUrl?: string;

  // Software Details
  softwareDeveloper?: string;
  softwareDeveloperEmail?: string;
  softwareDeveloperTaxNumber?: string;

  // Billing
  autoRechargeEnabled?: boolean;
  autoRechargeThresholdPercent?: number;
  autoRechargePackage?: string;
}

export interface UpdateNAVCredentialsInput {
  login: string;
  password: string;
  signatureKey: string;
  exchangeKey: string;
}

export interface OrganizationWithDecryptedNAV extends Omit<Organization, 'navPasswordEncrypted' | 'navSignatureKeyEncrypted' | 'navExchangeKeyEncrypted'> {
  navPassword?: string;
  navSignatureKey?: string;
  navExchangeKey?: string;
}

export class OrganizationService {
  /**
   * Create a new organization
   */
  async createOrganization(input: CreateOrganizationInput): Promise<Organization> {
    // Validate tax number uniqueness
    const existingOrg = await db.organization.findUnique({
      where: { taxNumber: input.taxNumber },
    });

    if (existingOrg) {
      throw new ValidationError(
        'Organization with this tax number already exists',
        { taxNumber: input.taxNumber }
      );
    }

    // Prepare encrypted NAV credentials if provided
    let navLogin: string | undefined;
    let navPasswordEncrypted: string | undefined;
    let navSignatureKeyEncrypted: string | undefined;
    let navExchangeKeyEncrypted: string | undefined;

    if (input.navCredentials) {
      const encrypted = encryptionService.encryptNAVCredentials({
        technicalUser: input.navCredentials.login,
        password: input.navCredentials.password,
        signatureKey: input.navCredentials.signatureKey,
        exchangeKey: input.navCredentials.exchangeKey,
      });

      navLogin = encrypted.technicalUser;
      navPasswordEncrypted = encrypted.passwordEncrypted;
      navSignatureKeyEncrypted = encrypted.signatureKeyEncrypted;
      navExchangeKeyEncrypted = encrypted.exchangeKeyEncrypted;
    }

    // Create organization
    const organization = await db.organization.create({
      data: {
        // Organization Details
        name: input.name,
        taxNumber: input.taxNumber,
        email: input.email,
        phone: input.phone,

        // Address
        country: input.country || 'HU',
        postalCode: input.postalCode,
        city: input.city,
        address: input.address,

        // Invoice Settings
        invoicePrefix: input.invoicePrefix || 'INV',
        defaultCurrency: input.defaultCurrency || 'HUF',
        defaultLanguage: input.defaultLanguage || 'hu',

        // Logo
        logoUrl: input.logoUrl,

        // NAV Credentials
        navLogin,
        navPasswordEncrypted,
        navSignatureKeyEncrypted,
        navExchangeKeyEncrypted,

        // Software Details
        softwareDeveloper: input.softwareDeveloper,
        softwareDeveloperEmail: input.softwareDeveloperEmail,
        softwareDeveloperTaxNumber: input.softwareDeveloperTaxNumber,

        // Billing
        autoRechargeEnabled: input.autoRechargeEnabled ?? true,
        autoRechargeThresholdPercent: input.autoRechargeThresholdPercent ?? 20,
        autoRechargePackage: input.autoRechargePackage ?? 'basic',
      },
    });

    return organization;
  }

  /**
   * Get organization by ID
   */
  async getOrganizationById(id: string): Promise<Organization> {
    const organization = await db.organization.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!organization) {
      throw new OrganizationNotFoundError(id);
    }

    return organization;
  }

  /**
   * Get organization by ID with decrypted NAV credentials
   */
  async getOrganizationWithNAVCredentials(id: string): Promise<OrganizationWithDecryptedNAV> {
    const organization = await this.getOrganizationById(id);

    // Decrypt NAV credentials if they exist
    const result: OrganizationWithDecryptedNAV = {
      ...organization,
    };

    if (organization.navPasswordEncrypted && organization.navSignatureKeyEncrypted && organization.navExchangeKeyEncrypted) {
      const decrypted = encryptionService.decryptNAVCredentials({
        technicalUser: organization.navLogin || '',
        passwordEncrypted: organization.navPasswordEncrypted,
        signatureKeyEncrypted: organization.navSignatureKeyEncrypted,
        exchangeKeyEncrypted: organization.navExchangeKeyEncrypted,
      });

      result.navPassword = decrypted.password;
      result.navSignatureKey = decrypted.signatureKey;
      result.navExchangeKey = decrypted.exchangeKey;
    }

    return result;
  }

  /**
   * Get organization by tax number
   */
  async getOrganizationByTaxNumber(taxNumber: string): Promise<Organization | null> {
    return db.organization.findFirst({
      where: {
        taxNumber,
        deletedAt: null,
      },
    });
  }

  /**
   * Update organization details
   */
  async updateOrganization(id: string, input: UpdateOrganizationInput): Promise<Organization> {
    // Check if organization exists
    await this.getOrganizationById(id);

    // Update organization
    const organization = await db.organization.update({
      where: { id },
      data: {
        ...input,
        updatedAt: new Date(),
      },
    });

    return organization;
  }

  /**
   * Update NAV credentials
   */
  async updateNAVCredentials(id: string, credentials: UpdateNAVCredentialsInput): Promise<Organization> {
    // Check if organization exists
    await this.getOrganizationById(id);

    // Encrypt credentials
    const encrypted = encryptionService.encryptNAVCredentials({
      technicalUser: credentials.login,
      password: credentials.password,
      signatureKey: credentials.signatureKey,
      exchangeKey: credentials.exchangeKey,
    });

    // Update organization
    const organization = await db.organization.update({
      where: { id },
      data: {
        navLogin: encrypted.technicalUser,
        navPasswordEncrypted: encrypted.passwordEncrypted,
        navSignatureKeyEncrypted: encrypted.signatureKeyEncrypted,
        navExchangeKeyEncrypted: encrypted.exchangeKeyEncrypted,
        navConnectionTested: false, // Reset connection test flag
        navLastTestAt: null,
        updatedAt: new Date(),
      },
    });

    return organization;
  }

  /**
   * Mark NAV connection as tested
   */
  async markNAVConnectionTested(id: string, success: boolean): Promise<Organization> {
    return db.organization.update({
      where: { id },
      data: {
        navConnectionTested: success,
        navLastTestAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Add credits to organization balance
   */
  async addCredits(id: string, credits: number): Promise<Organization> {
    if (credits <= 0) {
      throw new ValidationError('Credits must be a positive number', { credits });
    }

    const organization = await this.getOrganizationById(id);

    return db.organization.update({
      where: { id },
      data: {
        balanceCredits: organization.balanceCredits + credits,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Deduct credits from organization balance
   */
  async deductCredits(id: string, credits: number): Promise<Organization> {
    if (credits <= 0) {
      throw new ValidationError('Credits must be a positive number', { credits });
    }

    const organization = await this.getOrganizationById(id);

    if (organization.balanceCredits < credits) {
      throw new ValidationError(
        'Insufficient credits',
        { available: organization.balanceCredits, required: credits }
      );
    }

    return db.organization.update({
      where: { id },
      data: {
        balanceCredits: organization.balanceCredits - credits,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Check if organization has enough credits
   */
  async hasEnoughCredits(id: string, requiredCredits: number): Promise<boolean> {
    const organization = await this.getOrganizationById(id);
    return organization.balanceCredits >= requiredCredits;
  }

  /**
   * Get credit balance
   */
  async getCreditBalance(id: string): Promise<number> {
    const organization = await this.getOrganizationById(id);
    return organization.balanceCredits;
  }

  /**
   * Check if low balance alert should be sent
   */
  async shouldSendLowBalanceAlert(id: string): Promise<boolean> {
    const organization = await this.getOrganizationById(id);

    // If auto-recharge is enabled, don't send alert
    if (organization.autoRechargeEnabled) {
      return false;
    }

    // Calculate threshold
    const threshold = organization.autoRechargeThresholdPercent;
    const currentPercentage = organization.balanceCredits;

    // Simple check: if balance < threshold, send alert
    // (You may want to adjust this logic based on your business rules)
    return currentPercentage < threshold;
  }

  /**
   * Update Stripe customer information
   */
  async updateStripeCustomer(
    id: string,
    stripeCustomerId: string,
    paymentMethodId?: string,
    last4?: string,
    brand?: string
  ): Promise<Organization> {
    await this.getOrganizationById(id);

    return db.organization.update({
      where: { id },
      data: {
        stripeCustomerId,
        stripePaymentMethodId: paymentMethodId,
        paymentMethodLast4: last4,
        paymentMethodBrand: brand,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Update organization status
   */
  async updateStatus(id: string, status: 'active' | 'suspended' | 'deleted'): Promise<Organization> {
    await this.getOrganizationById(id);

    return db.organization.update({
      where: { id },
      data: {
        status,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Update billing status
   */
  async updateBillingStatus(
    id: string,
    billingStatus: 'active' | 'suspended' | 'delinquent'
  ): Promise<Organization> {
    await this.getOrganizationById(id);

    return db.organization.update({
      where: { id },
      data: {
        billingStatus,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Soft delete organization
   */
  async deleteOrganization(id: string): Promise<Organization> {
    await this.getOrganizationById(id);

    return db.organization.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'deleted',
        updatedAt: new Date(),
      },
    });
  }

  /**
   * List organizations (with pagination)
   */
  async listOrganizations(params: {
    skip?: number;
    take?: number;
    status?: string;
    search?: string;
  }): Promise<{ organizations: Organization[]; total: number }> {
    const { skip = 0, take = 20, status, search } = params;

    const where: Prisma.OrganizationWhereInput = {
      deletedAt: null,
      ...(status && { status }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { taxNumber: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [organizations, total] = await Promise.all([
      db.organization.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      db.organization.count({ where }),
    ]);

    return { organizations, total };
  }
}

// Export singleton instance
export const organizationService = new OrganizationService();
