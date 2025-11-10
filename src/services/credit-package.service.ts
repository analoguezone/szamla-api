import { db } from '@config/database';
import { NotFoundError } from '@utils/errors';
import { CreditPackage } from '@prisma/client';

/**
 * Credit Package Service
 *
 * Manages credit packages available for purchase
 */

export class CreditPackageService {
  /**
   * Get all active credit packages
   */
  async listActivePackages(): Promise<CreditPackage[]> {
    return db.creditPackage.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });
  }

  /**
   * Get featured packages
   */
  async getFeaturedPackages(): Promise<CreditPackage[]> {
    return db.creditPackage.findMany({
      where: {
        isActive: true,
        isFeatured: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });
  }

  /**
   * Get package by code
   */
  async getPackageByCode(code: string): Promise<CreditPackage> {
    const pkg = await db.creditPackage.findUnique({
      where: { code },
    });

    if (!pkg) {
      throw new NotFoundError('Credit Package', code);
    }

    if (!pkg.isActive) {
      throw new NotFoundError('Credit Package', code);
    }

    return pkg;
  }

  /**
   * Get package by ID
   */
  async getPackageById(id: string): Promise<CreditPackage> {
    const pkg = await db.creditPackage.findUnique({
      where: { id },
    });

    if (!pkg) {
      throw new NotFoundError('Credit Package', id);
    }

    return pkg;
  }

  /**
   * Calculate final price with discount
   */
  calculateFinalPrice(credits: number, basePricePerCredit: number, discountPercent: number): number {
    const basePrice = credits * Number(basePricePerCredit);
    const discount = (basePrice * discountPercent) / 100;
    return basePrice - discount;
  }
}

// Export singleton instance
export const creditPackageService = new CreditPackageService();
