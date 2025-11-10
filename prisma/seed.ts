import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Credit packages with progressive discounts
  const packages = [
    {
      code: 'STARTER',
      name: 'Starter',
      credits: 50,
      basePricePerCredit: 120.0,
      discountPercent: 0,
      finalPriceHuf: 6000.0, // 50 * 120 * (1 - 0)
      description: 'Perfect for testing and small businesses',
      badge: null,
      features: [
        '50 invoices',
        'Multi-currency support',
        'EU VAT compliance',
        'NAV integration',
        'Email support',
      ],
      isActive: true,
      isFeatured: false,
      sortOrder: 1,
    },
    {
      code: 'BASIC',
      name: 'Basic',
      credits: 100,
      basePricePerCredit: 120.0,
      discountPercent: 20,
      finalPriceHuf: 9600.0, // 100 * 120 * (1 - 0.20)
      description: 'Most popular for small to medium businesses',
      badge: 'Most Popular',
      features: [
        '100 invoices',
        'Multi-currency support',
        'EU VAT compliance',
        'NAV integration',
        'Priority email support',
        '20% savings',
      ],
      isActive: true,
      isFeatured: true,
      sortOrder: 2,
    },
    {
      code: 'PRO',
      name: 'Professional',
      credits: 500,
      basePricePerCredit: 120.0,
      discountPercent: 40,
      finalPriceHuf: 36000.0, // 500 * 120 * (1 - 0.40)
      description: 'Best value for growing businesses',
      badge: 'Best Value',
      features: [
        '500 invoices',
        'Multi-currency support',
        'EU VAT compliance',
        'NAV integration',
        'Priority support',
        '40% savings',
        'Quarterly reports',
      ],
      isActive: true,
      isFeatured: true,
      sortOrder: 3,
    },
    {
      code: 'BUSINESS',
      name: 'Business',
      credits: 1000,
      basePricePerCredit: 120.0,
      discountPercent: 60,
      finalPriceHuf: 48000.0, // 1000 * 120 * (1 - 0.60)
      description: 'For established businesses with high volume',
      badge: null,
      features: [
        '1,000 invoices',
        'Multi-currency support',
        'EU VAT compliance',
        'NAV integration',
        'Dedicated support',
        '60% savings',
        'Monthly reports',
        'API access',
      ],
      isActive: true,
      isFeatured: false,
      sortOrder: 4,
    },
    {
      code: 'ENTERPRISE',
      name: 'Enterprise',
      credits: 10000,
      basePricePerCredit: 120.0,
      discountPercent: 80,
      finalPriceHuf: 240000.0, // 10000 * 120 * (1 - 0.80)
      description: 'Maximum savings for agencies and large organizations',
      badge: 'Best Deal',
      features: [
        '10,000 invoices',
        'Multi-currency support',
        'EU VAT compliance',
        'NAV integration',
        'Dedicated account manager',
        '80% savings (save 960,000 HUF!)',
        'Custom reports',
        'Full API access',
        'White-label options',
        'SLA guarantee',
      ],
      isActive: true,
      isFeatured: false,
      sortOrder: 5,
    },
  ];

  // Upsert packages (create or update)
  for (const pkg of packages) {
    const result = await prisma.creditPackage.upsert({
      where: { code: pkg.code },
      update: pkg,
      create: pkg,
    });
    console.log(`✅ ${result.name}: ${result.credits} credits @ ${result.finalPriceHuf} HUF (${result.discountPercent}% off)`);
  }

  console.log('\n🎉 Seeding completed successfully!');
  console.log('\nCreated packages:');
  console.log('- Starter: 50 credits @ 6,000 HUF (120 HUF/credit)');
  console.log('- Basic: 100 credits @ 9,600 HUF (96 HUF/credit) - 20% off ⭐');
  console.log('- Pro: 500 credits @ 36,000 HUF (72 HUF/credit) - 40% off 💎');
  console.log('- Business: 1,000 credits @ 48,000 HUF (48 HUF/credit) - 60% off');
  console.log('- Enterprise: 10,000 credits @ 240,000 HUF (24 HUF/credit) - 80% off 🚀');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
