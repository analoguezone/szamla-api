import { db } from '@config/database';
import { NotFoundError, ValidationError } from '@utils/errors';
import { Partner, Prisma } from '@prisma/client';

/**
 * Partner Service
 *
 * Handles CRUD operations for partners (customers/suppliers)
 * with multi-tenant data isolation
 */

export interface CreatePartnerInput {
  organizationId: string;
  name: string;
  taxNumber?: string;
  taxNumberEu?: string;
  isIndividual?: boolean;
  isForeign?: boolean;
  email?: string;
  phone?: string;
  country?: string;
  postalCode: string;
  city: string;
  address: string;
  bankAccountNumber?: string;
  bankName?: string;
  swiftBic?: string;
  notes?: string;
}

export interface UpdatePartnerInput {
  name?: string;
  taxNumber?: string | null;
  taxNumberEu?: string | null;
  isIndividual?: boolean;
  isForeign?: boolean;
  email?: string | null;
  phone?: string | null;
  country?: string;
  postalCode?: string;
  city?: string;
  address?: string;
  bankAccountNumber?: string | null;
  bankName?: string | null;
  swiftBic?: string | null;
  notes?: string | null;
}

export class PartnerService {
  /**
   * Create a new partner
   */
  async createPartner(input: CreatePartnerInput): Promise<Partner> {
    // Check for duplicate tax number within organization
    if (input.taxNumber) {
      const existingPartner = await db.partner.findFirst({
        where: {
          organizationId: input.organizationId,
          taxNumber: input.taxNumber,
          deletedAt: null,
        },
      });

      if (existingPartner) {
        throw new ValidationError(
          'A partner with this tax number already exists in your organization',
          { taxNumber: input.taxNumber }
        );
      }
    }

    // Create partner
    const partner = await db.partner.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        taxNumber: input.taxNumber,
        taxNumberEu: input.taxNumberEu,
        isIndividual: input.isIndividual ?? false,
        isForeign: input.isForeign ?? false,
        email: input.email,
        phone: input.phone,
        country: input.country ?? 'HU',
        postalCode: input.postalCode,
        city: input.city,
        address: input.address,
        bankAccountNumber: input.bankAccountNumber,
        bankName: input.bankName,
        swiftBic: input.swiftBic,
        notes: input.notes,
      },
    });

    return partner;
  }

  /**
   * Get partner by ID (with organization isolation)
   */
  async getPartnerById(id: string, organizationId: string): Promise<Partner> {
    const partner = await db.partner.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });

    if (!partner) {
      throw new NotFoundError('Partner', id);
    }

    return partner;
  }

  /**
   * Get partner by tax number (within organization)
   */
  async getPartnerByTaxNumber(
    taxNumber: string,
    organizationId: string
  ): Promise<Partner | null> {
    return db.partner.findFirst({
      where: {
        organizationId,
        taxNumber,
        deletedAt: null,
      },
    });
  }

  /**
   * Update partner
   */
  async updatePartner(
    id: string,
    organizationId: string,
    input: UpdatePartnerInput
  ): Promise<Partner> {
    // Check if partner exists and belongs to organization
    await this.getPartnerById(id, organizationId);

    // Check for duplicate tax number if updating
    if (input.taxNumber) {
      const existingPartner = await db.partner.findFirst({
        where: {
          organizationId,
          taxNumber: input.taxNumber,
          deletedAt: null,
          id: { not: id }, // Exclude current partner
        },
      });

      if (existingPartner) {
        throw new ValidationError(
          'A partner with this tax number already exists in your organization',
          { taxNumber: input.taxNumber }
        );
      }
    }

    // Update partner
    const partner = await db.partner.update({
      where: { id },
      data: {
        ...input,
        updatedAt: new Date(),
      },
    });

    return partner;
  }

  /**
   * Delete partner (soft delete)
   */
  async deletePartner(id: string, organizationId: string): Promise<Partner> {
    // Check if partner exists and belongs to organization
    await this.getPartnerById(id, organizationId);

    // Check if partner has any invoices
    const invoiceCount = await db.invoice.count({
      where: {
        partnerId: id,
      },
    });

    if (invoiceCount > 0) {
      throw new ValidationError(
        `Cannot delete partner with ${invoiceCount} existing invoice(s). Consider archiving instead.`,
        { invoiceCount }
      );
    }

    // Soft delete partner
    const partner = await db.partner.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return partner;
  }

  /**
   * List partners (with pagination and filtering)
   */
  async listPartners(params: {
    organizationId: string;
    skip?: number;
    take?: number;
    search?: string;
    isIndividual?: boolean;
    isForeign?: boolean;
    country?: string;
  }): Promise<{ partners: Partner[]; total: number }> {
    const { organizationId, skip = 0, take = 20, search, isIndividual, isForeign, country } = params;

    const where: Prisma.PartnerWhereInput = {
      organizationId,
      deletedAt: null,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { taxNumber: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(isIndividual !== undefined && { isIndividual }),
      ...(isForeign !== undefined && { isForeign }),
      ...(country && { country }),
    };

    const [partners, total] = await Promise.all([
      db.partner.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
      }),
      db.partner.count({ where }),
    ]);

    return { partners, total };
  }

  /**
   * Count partners for an organization
   */
  async countPartners(organizationId: string): Promise<number> {
    return db.partner.count({
      where: {
        organizationId,
        deletedAt: null,
      },
    });
  }

  /**
   * Search partners by name or tax number
   */
  async searchPartners(
    organizationId: string,
    query: string,
    limit: number = 10
  ): Promise<Partner[]> {
    return db.partner.findMany({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { taxNumber: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get partners statistics
   */
  async getPartnerStats(organizationId: string): Promise<{
    total: number;
    individuals: number;
    companies: number;
    foreign: number;
    domestic: number;
  }> {
    const partners = await db.partner.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      select: {
        isIndividual: true,
        isForeign: true,
      },
    });

    return {
      total: partners.length,
      individuals: partners.filter((p) => p.isIndividual).length,
      companies: partners.filter((p) => !p.isIndividual).length,
      foreign: partners.filter((p) => p.isForeign).length,
      domestic: partners.filter((p) => !p.isForeign).length,
    };
  }
}

// Export singleton instance
export const partnerService = new PartnerService();
