import { Router } from 'express';
import { healthRoutes } from './health.routes';

const router = Router();

// Mount routes
router.use('/', healthRoutes);

// API routes (to be added)
// router.use('/organizations', organizationRoutes);
// router.use('/partners', partnerRoutes);
// router.use('/invoices', invoiceRoutes);
// router.use('/billing', billingRoutes);
// router.use('/nav', navRoutes);

export { router };
